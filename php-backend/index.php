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

// Load routes
require_once __DIR__ . '/routes/auth.php';
require_once __DIR__ . '/routes/data.php';
require_once __DIR__ . '/routes/rpc.php';
require_once __DIR__ . '/routes/storage.php';
require_once __DIR__ . '/routes/functions.php';
require_once __DIR__ . '/routes/admin.php';

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

// Check IP blocking
$clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
if ($clientIp) {
    $stmt = $pdo->prepare('SELECT 1 FROM blocked_ips WHERE ip_address = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())');
    $stmt->execute([$clientIp]);
    if ($stmt->fetch()) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied']);
        exit;
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
            handleAuthRoute($segments[1] ?? '', $method, $body, $pdo, $config);
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
            
        case 'functions':
            handleFunction($segments[1] ?? '', $body, $pdo, $config);
            break;
            
        case 'admin':
            handleAdminRoute($segments[1] ?? '', $body, $pdo, $config);
            break;
            
        case 'sse':
            require_once __DIR__ . '/sse.php';
            break;
            
        case 'health':
            echo json_encode([
                'status' => 'ok', 
                'timestamp' => date('c'),
                'version' => '1.0.0'
            ]);
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
