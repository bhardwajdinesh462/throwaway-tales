<?php
/**
 * Self-Hosted Temp Email - Diagnostic API Endpoint
 * 
 * Returns JSON with system status for debugging.
 * 
 * Usage: GET /api/diagnostic.php
 * Optional: ?key=your-diagnostic-key (for protected access)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Configuration
$configExists = file_exists(__DIR__ . '/config.php');
$config = null;
$db = null;
$dbConnected = false;
$dbError = null;

if ($configExists) {
    $config = require __DIR__ . '/config.php';
    
    // Optional: Require diagnostic key for security
    $diagnosticKey = $config['diagnostic_key'] ?? null;
    if ($diagnosticKey && ($_GET['key'] ?? '') !== $diagnosticKey) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid or missing diagnostic key. Add ?key=YOUR_KEY to the URL.'
        ]);
        exit;
    }
    
    require_once __DIR__ . '/core/database.php';
    
    try {
        $db = Database::getConnection();
        $dbConnected = true;
    } catch (Exception $e) {
        $dbError = $e->getMessage();
    }
}

// Gather diagnostic data
$diagnostic = [
    'timestamp' => date('c'),
    'success' => true,
    
    // PHP Environment
    'environment' => [
        'php_version' => PHP_VERSION,
        'php_version_ok' => version_compare(PHP_VERSION, '8.0.0', '>='),
        'memory_limit' => ini_get('memory_limit'),
        'max_execution_time' => ini_get('max_execution_time'),
        'upload_max_filesize' => ini_get('upload_max_filesize'),
        'extensions' => [
            'pdo_mysql' => extension_loaded('pdo_mysql'),
            'json' => extension_loaded('json'),
            'mbstring' => extension_loaded('mbstring'),
            'openssl' => extension_loaded('openssl'),
            'curl' => extension_loaded('curl'),
            'imap' => extension_loaded('imap'),
        ],
        'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
    ],
    
    // Configuration
    'config' => [
        'exists' => $configExists,
        'app_name' => $config['app']['name'] ?? 'Not set',
        'debug_mode' => $config['app']['debug'] ?? false,
        'cors_configured' => isset($config['cors']),
        'smtp_configured' => isset($config['smtp']['host']) && !empty($config['smtp']['host']),
        'imap_configured' => isset($config['imap']['host']) && !empty($config['imap']['host']),
        'webhooks_configured' => isset($config['webhook_secrets']) || isset($config['webhooks']['secrets']),
    ],
    
    // Database
    'database' => [
        'connected' => $dbConnected,
        'error' => $dbError,
        'tables' => [],
        'row_counts' => [],
    ],
    
    // File System
    'filesystem' => [
        'api_writable' => is_writable(__DIR__),
        'uploads_writable' => is_writable(dirname(__DIR__) . '/uploads'),
        'attachments_writable' => is_writable(dirname(__DIR__) . '/uploads/attachments'),
        'htaccess_exists' => file_exists(dirname(__DIR__) . '/.htaccess'),
        'api_htaccess_exists' => file_exists(__DIR__ . '/.htaccess'),
    ],
    
    // Feature Status
    'features' => [
        'domains' => 0,
        'active_domains' => 0,
        'users' => 0,
        'admins' => 0,
        'temp_emails' => 0,
        'received_emails' => 0,
        'settings' => 0,
    ],
    
    // Issues Found
    'issues' => [],
    'warnings' => [],
];

// Check database tables and counts
if ($dbConnected) {
    try {
        // Get all tables
        $stmt = $db->query("SHOW TABLES");
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $diagnostic['database']['tables'] = $tables;
        
        // Get row counts for important tables
        $importantTables = ['users', 'domains', 'temp_emails', 'received_emails', 'app_settings', 'user_roles', 'email_attachments'];
        foreach ($importantTables as $table) {
            if (in_array($table, $tables)) {
                $countStmt = $db->query("SELECT COUNT(*) FROM `$table`");
                $count = (int)$countStmt->fetchColumn();
                $diagnostic['database']['row_counts'][$table] = $count;
                
                // Update features
                if ($table === 'domains') $diagnostic['features']['domains'] = $count;
                if ($table === 'users') $diagnostic['features']['users'] = $count;
                if ($table === 'temp_emails') $diagnostic['features']['temp_emails'] = $count;
                if ($table === 'received_emails') $diagnostic['features']['received_emails'] = $count;
                if ($table === 'app_settings') $diagnostic['features']['settings'] = $count;
            }
        }
        
        // Count active domains
        if (in_array('domains', $tables)) {
            $stmt = $db->query("SELECT COUNT(*) FROM domains WHERE is_active = 1");
            $diagnostic['features']['active_domains'] = (int)$stmt->fetchColumn();
        }
        
        // Count admins
        if (in_array('user_roles', $tables)) {
            $stmt = $db->query("SELECT COUNT(*) FROM user_roles WHERE role IN ('admin', 'super_admin')");
            $diagnostic['features']['admins'] = (int)$stmt->fetchColumn();
        }
        
        // Check for missing required tables
        $requiredTables = ['users', 'domains', 'temp_emails', 'received_emails', 'app_settings'];
        foreach ($requiredTables as $reqTable) {
            if (!in_array($reqTable, $tables)) {
                $diagnostic['issues'][] = "Missing required table: $reqTable";
            }
        }
        
    } catch (Exception $e) {
        $diagnostic['issues'][] = 'Database query error: ' . $e->getMessage();
    }
}

// Check for common issues
if (!$configExists) {
    $diagnostic['issues'][] = 'config.php not found - copy config.example.php to config.php';
}

if (!$dbConnected && $configExists) {
    $diagnostic['issues'][] = 'Database connection failed: ' . $dbError;
}

if ($diagnostic['features']['domains'] === 0) {
    $diagnostic['issues'][] = 'No domains configured - email generation will fail';
}

if ($diagnostic['features']['active_domains'] === 0 && $diagnostic['features']['domains'] > 0) {
    $diagnostic['issues'][] = 'No active domains - enable at least one domain';
}

if ($diagnostic['features']['admins'] === 0) {
    $diagnostic['warnings'][] = 'No admin users found - admin panel access may be limited';
}

if (!$diagnostic['filesystem']['uploads_writable']) {
    $diagnostic['warnings'][] = 'Uploads directory is not writable - file uploads will fail';
}

// Check PHP extensions
foreach ($diagnostic['environment']['extensions'] as $ext => $loaded) {
    if (!$loaded && $ext !== 'imap') { // imap is optional
        $diagnostic['issues'][] = "Required PHP extension missing: $ext";
    }
}

// Webhook URL
$protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$diagnostic['webhook_url'] = "$protocol://$host/api/emails/webhook.php";

// Summary
$diagnostic['summary'] = [
    'status' => count($diagnostic['issues']) === 0 ? 'healthy' : 'issues_found',
    'issues_count' => count($diagnostic['issues']),
    'warnings_count' => count($diagnostic['warnings']),
    'ready_for_use' => count($diagnostic['issues']) === 0 && $dbConnected && $diagnostic['features']['active_domains'] > 0,
];

// Output
echo json_encode($diagnostic, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
