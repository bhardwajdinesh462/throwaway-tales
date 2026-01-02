<?php
/**
 * Main PHP Backend Entry Point
 * Self-hosted REST API for TempMail
 * Security-hardened for production use
 */

// Security headers
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");
header("Referrer-Policy: strict-origin-when-cross-origin");

// Block suspicious requests
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$blockedAgents = ['sqlmap', 'nikto', 'nessus', 'nmap', 'hydra', 'acunetix'];
foreach ($blockedAgents as $blocked) {
    if (stripos($userAgent, $blocked) !== false) {
        http_response_code(403);
        exit;
    }
}

// Rate limiting check (basic)
session_start();
$rateLimit = 100; // requests per minute
$ratePeriod = 60; // seconds
$clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateKey = 'rate_' . md5($clientIp);

if (!isset($_SESSION[$rateKey])) {
    $_SESSION[$rateKey] = ['count' => 0, 'start' => time()];
}

if (time() - $_SESSION[$rateKey]['start'] > $ratePeriod) {
    $_SESSION[$rateKey] = ['count' => 1, 'start' => time()];
} else {
    $_SESSION[$rateKey]['count']++;
    if ($_SESSION[$rateKey]['count'] > $rateLimit) {
        http_response_code(429);
        header('Retry-After: ' . ($ratePeriod - (time() - $_SESSION[$rateKey]['start'])));
        echo json_encode(['error' => 'Too many requests']);
        exit;
    }
}

// Parse request path early (for health check before config)
$requestUri = $_SERVER['REQUEST_URI'];
$basePath = '/api';
$earlyPath = parse_url($requestUri, PHP_URL_PATH);
$earlyPath = str_replace($basePath, '', $earlyPath);
$earlyPath = trim($earlyPath, '/');

// Basic health endpoint (works even without config/DB)
if ($earlyPath === 'health') {
    header("Content-Type: application/json");
    $configExists = file_exists(__DIR__ . '/config.php');
    $healthResponse = [
        'status' => 'ok',
        'timestamp' => date('c'),
        'version' => '1.0.0',
        'php_version' => phpversion(),
        'config_present' => $configExists,
    ];
    
    // Try DB connection if config exists
    if ($configExists) {
        try {
            $config = require __DIR__ . '/config.php';
            $dsn = "mysql:host={$config['db']['host']};dbname={$config['db']['name']};charset={$config['db']['charset']}";
            $testPdo = new PDO($dsn, $config['db']['user'], $config['db']['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 5,
            ]);
            $healthResponse['db_connected'] = true;
            $testPdo = null;
        } catch (Exception $e) {
            $healthResponse['db_connected'] = false;
            $healthResponse['db_error'] = $e->getMessage();
        }
    } else {
        $healthResponse['db_connected'] = false;
        $healthResponse['db_error'] = 'Configuration not found';
    }
    
    echo json_encode($healthResponse);
    exit;
}

// Comprehensive diagnostics endpoint (works without DB, requires token in production)
if ($earlyPath === 'health/diag') {
    header("Content-Type: application/json");
    
    $configExists = file_exists(__DIR__ . '/config.php');
    $config = $configExists ? require __DIR__ . '/config.php' : [];
    
    // Token validation (skip if no config yet - installer mode)
    $diagToken = $config['diag_token'] ?? '';
    $providedToken = $_GET['token'] ?? '';
    
    if ($configExists && !empty($diagToken) && $providedToken !== $diagToken) {
        http_response_code(403);
        echo json_encode(['error' => 'Invalid or missing diagnostic token', 'hint' => 'Add ?token=YOUR_DIAG_TOKEN']);
        exit;
    }
    
    $diag = [
        'status' => 'ok',
        'timestamp' => date('c'),
        'php_version' => phpversion(),
        'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
    ];
    
    // Check PHP extensions
    $requiredExtensions = ['pdo_mysql', 'openssl', 'mbstring', 'json'];
    $optionalExtensions = ['imap', 'curl', 'gd', 'zip'];
    
    $diag['extensions'] = [
        'required' => [],
        'optional' => [],
    ];
    
    foreach ($requiredExtensions as $ext) {
        $diag['extensions']['required'][$ext] = extension_loaded($ext);
        if (!extension_loaded($ext)) {
            $diag['status'] = 'error';
        }
    }
    
    foreach ($optionalExtensions as $ext) {
        $diag['extensions']['optional'][$ext] = extension_loaded($ext);
    }
    
    // Check directories
    $diag['directories'] = [];
    $dirs = [
        'logs' => __DIR__ . '/logs',
        'storage' => __DIR__ . '/storage',
        'storage/avatars' => __DIR__ . '/storage/avatars',
        'storage/attachments' => __DIR__ . '/storage/attachments',
    ];
    
    foreach ($dirs as $name => $path) {
        $exists = is_dir($path);
        $writable = $exists ? is_writable($path) : false;
        $diag['directories'][$name] = [
            'exists' => $exists,
            'writable' => $writable,
        ];
        if (!$writable && $diag['status'] !== 'error') {
            $diag['status'] = 'warning';
        }
    }
    
    // Configuration check
    $diag['config'] = [
        'present' => $configExists,
        'db_configured' => !empty($config['db']['host']),
        'smtp_configured' => !empty($config['smtp']['host'] ?? ''),
        'imap_configured' => !empty($config['imap']['host'] ?? ''),
        'jwt_configured' => !empty($config['jwt']['secret'] ?? ''),
    ];
    
    // Database connection and tables check
    $diag['database'] = [
        'connected' => false,
        'tables' => [],
        'missing_tables' => [],
    ];
    
    $requiredTables = [
        'users', 'profiles', 'user_roles', 'domains', 'temp_emails', 'received_emails',
        'email_attachments', 'app_settings', 'blogs', 'subscription_tiers', 'user_subscriptions',
        'email_stats', 'email_logs', 'mailboxes', 'user_suspensions', 'admin_audit_logs',
        'friendly_websites', 'homepage_sections', 'email_verifications', 'backup_history',
        'rate_limits', 'user_2fa', 'blocked_ips', 'alert_logs', 'status_incidents',
        'scheduled_maintenance', 'uptime_records', 'cron_logs', 'email_restrictions',
        'banners', 'saved_emails', 'user_invoices'
    ];
    
    if ($configExists && !empty($config['db']['host'])) {
        try {
            $dsn = "mysql:host={$config['db']['host']};dbname={$config['db']['name']};charset={$config['db']['charset']}";
            $testPdo = new PDO($dsn, $config['db']['user'], $config['db']['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 5,
            ]);
            $diag['database']['connected'] = true;
            
            // Check each required table
            foreach ($requiredTables as $table) {
                try {
                    $stmt = $testPdo->query("SELECT 1 FROM `$table` LIMIT 1");
                    $diag['database']['tables'][$table] = true;
                } catch (Exception $e) {
                    $diag['database']['tables'][$table] = false;
                    $diag['database']['missing_tables'][] = $table;
                }
            }
            
            if (!empty($diag['database']['missing_tables']) && $diag['status'] !== 'error') {
                $diag['status'] = 'warning';
            }
            
            $testPdo = null;
        } catch (Exception $e) {
            $diag['database']['connected'] = false;
            $diag['database']['error'] = $e->getMessage();
            $diag['status'] = 'error';
        }
    }
    
    // SMTP connectivity check (if configured)
    $diag['smtp'] = ['configured' => false, 'reachable' => null];
    if (!empty($config['smtp']['host'] ?? '')) {
        $diag['smtp']['configured'] = true;
        $smtpHost = $config['smtp']['host'];
        $smtpPort = $config['smtp']['port'] ?? 587;
        $socket = @fsockopen($smtpHost, $smtpPort, $errno, $errstr, 5);
        if ($socket) {
            $diag['smtp']['reachable'] = true;
            fclose($socket);
        } else {
            $diag['smtp']['reachable'] = false;
            $diag['smtp']['error'] = "$errstr ($errno)";
        }
    }
    
    // IMAP connectivity check (if configured)
    $diag['imap'] = ['configured' => false, 'reachable' => null];
    if (!empty($config['imap']['host'] ?? '')) {
        $diag['imap']['configured'] = true;
        $imapHost = $config['imap']['host'];
        $imapPort = $config['imap']['port'] ?? 993;
        $socket = @fsockopen($imapHost, $imapPort, $errno, $errstr, 5);
        if ($socket) {
            $diag['imap']['reachable'] = true;
            fclose($socket);
        } else {
            $diag['imap']['reachable'] = false;
            $diag['imap']['error'] = "$errstr ($errno)";
        }
    }
    
    echo json_encode($diag, JSON_PRETTY_PRINT);
    exit;
}

// Load configuration
if (!file_exists(__DIR__ . '/config.php')) {
    // Redirect to installer if not configured
    if (file_exists(__DIR__ . '/install.php')) {
        header('Location: /api/install.php');
        exit;
    }
    http_response_code(500);
    echo json_encode(['error' => 'Configuration not found']);
    exit;
}

$config = require __DIR__ . '/config.php';

// Initialize error logging
require_once __DIR__ . '/error-logger.php';
$logger = ErrorLogger::getInstance(__DIR__ . '/logs');

// Load routes with include guards to prevent redeclaration errors
require_once __DIR__ . '/routes/auth.php';
require_once __DIR__ . '/routes/data.php';
require_once __DIR__ . '/routes/rpc.php';
require_once __DIR__ . '/routes/storage.php';
require_once __DIR__ . '/routes/functions.php';
require_once __DIR__ . '/routes/admin.php';
require_once __DIR__ . '/routes/forwarding.php';
require_once __DIR__ . '/routes/attachments.php';
require_once __DIR__ . '/routes/webhooks.php';
require_once __DIR__ . '/routes/logs.php';

// CORS Headers
$allowedOrigins = $config['cors']['origins'] ?? ['*'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins) || in_array('*', $allowedOrigins)) {
    header("Access-Control-Allow-Origin: " . ($origin ?: '*'));
}
header("Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, apikey, X-Temp-Email-Id, X-Secret-Token");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database connection
try {
    $dsn = "mysql:host={$config['db']['host']};dbname={$config['db']['name']};charset={$config['db']['charset']}";
    $pdo = new PDO($dsn, $config['db']['user'], $config['db']['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Check IP blocking (graceful if table doesn't exist)
$clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
if ($clientIp) {
    try {
        $stmt = $pdo->prepare('SELECT 1 FROM blocked_ips WHERE ip_address = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())');
        $stmt->execute([$clientIp]);
        if ($stmt->fetch()) {
            http_response_code(403);
            echo json_encode(['error' => 'Access denied']);
            exit;
        }
    } catch (PDOException $e) {
        // Table may not exist yet - log warning and continue
        if (function_exists('logWarning')) {
            logWarning('IP blocking check skipped: ' . $e->getMessage());
        }
    }
}

// Parse request
$requestUri = $_SERVER['REQUEST_URI'];
$basePath = '/api';
$path = parse_url($requestUri, PHP_URL_PATH);
$path = str_replace($basePath, '', $path);
$path = trim($path, '/');
$segments = explode('/', $path);
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?: [];

// Sanitize input
array_walk_recursive($body, function(&$value) {
    if (is_string($value)) {
        $value = trim($value);
    }
});

// Route handling
try {
    switch ($segments[0] ?? '') {
        case 'auth':
            handleAuth($segments[1] ?? '', $method, $body, $pdo, $config);
            break;
            
        case 'rest':
        case 'data':
            handleDataRoute($segments, $method, $body, $pdo, $config);
            break;
            
        case 'rpc':
            handleRpcRoute($segments[1] ?? '', $body, $pdo, $config);
            break;
            
        case 'storage':
            handleStorageRoute($segments, $method, $pdo, $config);
            break;
            
        case 'health':
            // Detailed health endpoint (after DB connection)
            if (isset($segments[1]) && $segments[1] === 'diag') {
                // Already handled above before config loading
                echo json_encode(['error' => 'Use /api/health/diag endpoint directly']);
            } else {
                // Basic health already handled, but if we reach here with DB connected:
                echo json_encode([
                    'status' => 'ok', 
                    'timestamp' => date('c'),
                    'version' => '1.0.0',
                    'db_connected' => true
                ]);
            }
            break;
            
        case 'functions':
            handleFunction($segments[1] ?? '', $body, $pdo, $config);
            break;
            
        case 'admin':
            handleAdminRoute($segments[1] ?? '', $body, $pdo, $config);
            break;
            
        case 'forwarding':
            handleForwarding($segments[1] ?? '', $method, $body, $pdo, $config);
            break;
            
        case 'attachments':
            handleAttachments($segments[1] ?? '', $method, $body, $pdo, $config);
            break;
            
        case 'sse':
            require_once __DIR__ . '/sse.php';
            break;
            
        case 'webhook':
            handleWebhook($segments[1] ?? '', $body, $pdo, $config);
            break;
            
        case 'logs':
            handleLogsRoute($segments[1] ?? '', $method, $body, $pdo, $config);
            break;
            
        // Note: 'health' case is handled above in the first switch block
            
        case 'public-status':
            handlePublicStatus($pdo);
            break;
            
        case 'badge':
            handleBadge($segments[1] ?? '', $pdo);
            break;
            
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
    }
} catch (Exception $e) {
    error_log('API Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error']);
}

// =========== HELPER FUNCTIONS ===========

function generateUUID() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function generateJWT($userId, $config) {
    $header = rtrim(strtr(base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT'])), '+/', '-_'), '=');
    $payload = rtrim(strtr(base64_encode(json_encode([
        'sub' => $userId,
        'user_id' => $userId,
        'iat' => time(),
        'exp' => time() + ($config['jwt']['expiry'] ?? 604800)
    ])), '+/', '-_'), '=');
    $signature = rtrim(strtr(base64_encode(hash_hmac('sha256', "$header.$payload", $config['jwt']['secret'], true)), '+/', '-_'), '=');
    return "$header.$payload.$signature";
}

function getAuthUser($pdo, $config) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
        return null;
    }
    
    $token = $matches[1];
    $secret = $config['jwt']['secret'] ?? '';
    
    try {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        
        $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
        
        if (!$payload || ($payload['exp'] ?? 0) < time()) {
            return null;
        }
        
        // Verify signature
        $signatureInput = $parts[0] . '.' . $parts[1];
        $expectedSignature = rtrim(strtr(base64_encode(hash_hmac('sha256', $signatureInput, $secret, true)), '+/', '-_'), '=');
        
        if (!hash_equals($expectedSignature, $parts[2])) {
            return null;
        }
        
        $userId = $payload['sub'] ?? $payload['user_id'] ?? null;
        
        if ($userId) {
            $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        }
        
        return null;
    } catch (Exception $e) {
        return null;
    }
}

function checkIsAdmin($pdo, $userId) {
    if (!$userId) return false;
    $stmt = $pdo->prepare("SELECT 1 FROM user_roles WHERE user_id = ? AND role IN ('admin', 'moderator')");
    $stmt->execute([$userId]);
    return (bool) $stmt->fetch();
}

function sendEmail($to, $subject, $body, $config) {
    $smtp = $config['smtp'] ?? [];
    $from = $smtp['from'] ?? 'noreply@localhost';
    
    $headers = [
        'From' => $from,
        'Reply-To' => $from,
        'Content-Type' => 'text/plain; charset=UTF-8',
        'X-Mailer' => 'PHP/' . phpversion()
    ];
    
    return @mail($to, $subject, $body, implode("\r\n", array_map(fn($k, $v) => "$k: $v", array_keys($headers), $headers)));
}

// =========== PUBLIC STATUS ENDPOINT ===========

function handlePublicStatus($pdo) {
    // Get uptime stats (calculate from uptime_records if available, otherwise use defaults)
    $uptimeStats = [
        'overall' => 99.9,
        'imap' => 99.8,
        'smtp' => 99.9,
        'database' => 100,
    ];
    
    try {
        // Check uptime_records table
        $stmt = $pdo->query("
            SELECT service, 
                   COUNT(*) as total,
                   SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as operational
            FROM uptime_records 
            WHERE checked_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY service
        ");
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($records as $record) {
            $uptime = $record['total'] > 0 
                ? round(($record['operational'] / $record['total']) * 100, 1)
                : 99.9;
            $service = strtolower($record['service']);
            if (isset($uptimeStats[$service])) {
                $uptimeStats[$service] = $uptime;
            }
        }
        
        // Calculate overall
        $uptimeStats['overall'] = round(
            ($uptimeStats['imap'] + $uptimeStats['smtp'] + $uptimeStats['database']) / 3, 
            1
        );
    } catch (Exception $e) {
        // Use defaults
    }
    
    // Get active/recent incidents
    $incidents = [];
    try {
        $stmt = $pdo->query("
            SELECT id, title, status, service, created_at, resolved_at 
            FROM status_incidents 
            ORDER BY created_at DESC 
            LIMIT 10
        ");
        $incidents = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        // No incidents table yet
    }
    
    // Get active maintenance
    $maintenance = [];
    try {
        $stmt = $pdo->query("
            SELECT id, title, description, scheduled_start, scheduled_end, 
                   affected_services, status, created_at
            FROM scheduled_maintenance 
            WHERE status IN ('scheduled', 'in_progress')
            ORDER BY scheduled_start ASC
        ");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $row) {
            $row['affected_services'] = json_decode($row['affected_services'] ?? '[]', true);
            $maintenance[] = $row;
        }
    } catch (Exception $e) {
        // No maintenance table yet
    }
    
    echo json_encode([
        'uptime' => $uptimeStats,
        'incidents' => $incidents,
        'maintenance' => $maintenance,
        'timestamp' => date('c')
    ]);
}

// =========== UPTIME BADGE ENDPOINT ===========

function handleBadge($type, $pdo) {
    if ($type !== 'uptime') {
        http_response_code(404);
        echo json_encode(['error' => 'Unknown badge type']);
        return;
    }
    
    $service = $_GET['service'] ?? 'overall';
    $format = $_GET['format'] ?? 'svg';
    $size = $_GET['size'] ?? 'medium';
    
    // Get uptime for service
    $uptime = 99.9;
    $status = 'operational';
    
    try {
        $stmt = $pdo->prepare("
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as operational
            FROM uptime_records 
            WHERE service = ? AND checked_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
        ");
        $stmt->execute([$service]);
        $record = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($record && $record['total'] > 0) {
            $uptime = round(($record['operational'] / $record['total']) * 100, 1);
        }
        
        // Determine status
        if ($uptime >= 99.5) {
            $status = 'operational';
        } elseif ($uptime >= 95) {
            $status = 'degraded';
        } else {
            $status = 'outage';
        }
    } catch (Exception $e) {
        // Use defaults
    }
    
    if ($format === 'json') {
        header('Content-Type: application/json');
        header('Cache-Control: public, max-age=60');
        echo json_encode([
            'service' => $service,
            'status' => $status,
            'uptime' => $uptime,
            'color' => $status === 'operational' ? 'green' : ($status === 'degraded' ? 'yellow' : 'red'),
            'updated' => date('c')
        ]);
        return;
    }
    
    // SVG Badge
    header('Content-Type: image/svg+xml');
    header('Cache-Control: public, max-age=60');
    
    $statusColor = $status === 'operational' ? '#22c55e' : ($status === 'degraded' ? '#eab308' : '#ef4444');
    $statusText = $status;
    
    // Size configs
    $sizes = [
        'small' => ['width' => 90, 'height' => 18, 'fontSize' => 9],
        'medium' => ['width' => 110, 'height' => 20, 'fontSize' => 11],
        'large' => ['width' => 130, 'height' => 24, 'fontSize' => 13],
    ];
    $s = $sizes[$size] ?? $sizes['medium'];
    
    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<svg xmlns="http://www.w3.org/2000/svg" width="' . $s['width'] . '" height="' . $s['height'] . '">';
    echo '<linearGradient id="bg" x2="0" y2="100%">';
    echo '<stop offset="0" stop-color="#bbb" stop-opacity=".1"/>';
    echo '<stop offset="1" stop-opacity=".1"/>';
    echo '</linearGradient>';
    echo '<clipPath id="r"><rect width="' . $s['width'] . '" height="' . $s['height'] . '" rx="3" fill="#fff"/></clipPath>';
    echo '<g clip-path="url(#r)">';
    echo '<rect width="50" height="' . $s['height'] . '" fill="#555"/>';
    echo '<rect x="50" width="' . ($s['width'] - 50) . '" height="' . $s['height'] . '" fill="' . $statusColor . '"/>';
    echo '<rect width="' . $s['width'] . '" height="' . $s['height'] . '" fill="url(#bg)"/>';
    echo '</g>';
    echo '<g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="' . $s['fontSize'] . '">';
    echo '<text x="25" y="' . ($s['height'] * 0.7) . '" fill="#010101" fill-opacity=".3">status</text>';
    echo '<text x="25" y="' . ($s['height'] * 0.65) . '">status</text>';
    echo '<text x="' . (($s['width'] + 50) / 2) . '" y="' . ($s['height'] * 0.7) . '" fill="#010101" fill-opacity=".3">' . $statusText . '</text>';
    echo '<text x="' . (($s['width'] + 50) / 2) . '" y="' . ($s['height'] * 0.65) . '">' . $statusText . '</text>';
    echo '</g>';
    echo '</svg>';
}
