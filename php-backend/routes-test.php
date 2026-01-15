<?php
/**
 * API Routes Diagnostic Tool
 * Tests all API routes to verify proper .htaccess routing
 * 
 * Usage: https://yourdomain.com/api/routes-test.php
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-store, must-revalidate');

// Disable error display for clean JSON output
ini_set('display_errors', 0);
error_reporting(E_ALL);

$results = [
    'timestamp' => date('c'),
    'server' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
    'php_version' => PHP_VERSION,
    'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'Unknown',
    'script_path' => __FILE__,
    'request_uri' => $_SERVER['REQUEST_URI'] ?? 'Unknown',
];

// Check .htaccess existence and configuration
$htaccessPaths = [
    'public_html' => dirname(__DIR__) . '/.htaccess',
    'api_folder' => __DIR__ . '/.htaccess',
];

$results['htaccess'] = [];
foreach ($htaccessPaths as $name => $path) {
    $exists = file_exists($path);
    $results['htaccess'][$name] = [
        'path' => $path,
        'exists' => $exists,
        'readable' => $exists ? is_readable($path) : false,
        'size' => $exists ? filesize($path) : 0,
    ];
    
    // Check for key directives if readable
    if ($exists && is_readable($path)) {
        $content = file_get_contents($path);
        $results['htaccess'][$name]['has_rewrite_engine'] = stripos($content, 'RewriteEngine On') !== false;
        $results['htaccess'][$name]['has_api_routing'] = stripos($content, 'api/index.php') !== false;
        $results['htaccess'][$name]['has_spa_routing'] = stripos($content, 'index.html') !== false;
    }
}

// Check mod_rewrite status
$results['mod_rewrite'] = [
    'apache_get_modules' => function_exists('apache_get_modules'),
    'enabled' => function_exists('apache_get_modules') ? in_array('mod_rewrite', apache_get_modules()) : 'unknown',
];

// Check key files
$keyFiles = [
    'index.php' => __DIR__ . '/index.php',
    'config.php' => __DIR__ . '/config.php',
    'config.example.php' => __DIR__ . '/config.example.php',
    'error-logger.php' => __DIR__ . '/error-logger.php',
    'routes/auth.php' => __DIR__ . '/routes/auth.php',
    'routes/data.php' => __DIR__ . '/routes/data.php',
    'routes/logs.php' => __DIR__ . '/routes/logs.php',
    'includes/db.php' => __DIR__ . '/includes/db.php',
    'includes/helpers.php' => __DIR__ . '/includes/helpers.php',
];

$results['files'] = [];
foreach ($keyFiles as $name => $path) {
    $exists = file_exists($path);
    $results['files'][$name] = [
        'exists' => $exists,
        'readable' => $exists ? is_readable($path) : false,
    ];
}

// Check directories
$keyDirs = [
    'logs' => __DIR__ . '/logs',
    'storage' => __DIR__ . '/storage',
    'routes' => __DIR__ . '/routes',
    'includes' => __DIR__ . '/includes',
    'cron' => __DIR__ . '/cron',
];

$results['directories'] = [];
foreach ($keyDirs as $name => $path) {
    $exists = is_dir($path);
    $results['directories'][$name] = [
        'exists' => $exists,
        'writable' => $exists ? is_writable($path) : false,
    ];
}

// Test internal API routes by simulating requests
$baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') 
           . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '/api';

$routesToTest = [
    'health' => '/health',
    'health_diag' => '/health/diag',
    'logs_status' => '/logs/status',
];

$results['route_tests'] = [];

foreach ($routesToTest as $name => $path) {
    $url = $baseUrl . $path;
    $results['route_tests'][$name] = [
        'url' => $url,
        'status' => 'pending',
    ];
    
    // Use cURL if available
    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        $results['route_tests'][$name]['http_code'] = $httpCode;
        $results['route_tests'][$name]['status'] = $httpCode === 200 ? 'ok' : 'failed';
        $results['route_tests'][$name]['curl_error'] = $error ?: null;
        
        // Try to decode JSON response
        if ($response) {
            $decoded = json_decode($response, true);
            if ($decoded !== null) {
                $results['route_tests'][$name]['response_valid_json'] = true;
                // Only include small responses
                if (strlen($response) < 500) {
                    $results['route_tests'][$name]['response'] = $decoded;
                }
            } else {
                $results['route_tests'][$name]['response_valid_json'] = false;
                $results['route_tests'][$name]['response_preview'] = substr($response, 0, 200);
            }
        }
    } else {
        $results['route_tests'][$name]['status'] = 'skipped';
        $results['route_tests'][$name]['reason'] = 'cURL not available';
    }
}

// Database connectivity test
$results['database'] = [
    'config_exists' => file_exists(__DIR__ . '/config.php'),
    'connected' => false,
];

if (file_exists(__DIR__ . '/config.php')) {
    try {
        $config = require __DIR__ . '/config.php';
        if (isset($config['db'])) {
            $dsn = "mysql:host={$config['db']['host']};dbname={$config['db']['name']};charset={$config['db']['charset']}";
            $pdo = new PDO($dsn, $config['db']['user'], $config['db']['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 5,
            ]);
            $results['database']['connected'] = true;
            
            // Check required tables
            $requiredTables = ['users', 'profiles', 'domains', 'temp_emails', 'app_settings'];
            $results['database']['tables'] = [];
            
            foreach ($requiredTables as $table) {
                try {
                    $stmt = $pdo->query("SELECT COUNT(*) FROM `{$table}`");
                    $count = $stmt->fetchColumn();
                    $results['database']['tables'][$table] = ['exists' => true, 'count' => (int)$count];
                } catch (PDOException $e) {
                    $results['database']['tables'][$table] = ['exists' => false, 'error' => $e->getMessage()];
                }
            }
            
            $pdo = null;
        }
    } catch (Exception $e) {
        $results['database']['error'] = $e->getMessage();
    }
}

// Summary
$issues = [];

// Check critical issues
if (!$results['files']['config.php']['exists']) {
    $issues[] = 'config.php is missing - copy config.example.php to config.php';
}

if (!$results['directories']['logs']['writable']) {
    $issues[] = 'logs directory is not writable - run: chmod 755 logs';
}

if (!$results['database']['connected'] && $results['database']['config_exists']) {
    $issues[] = 'Database connection failed - check config.php credentials';
}

// Check route test results
foreach ($results['route_tests'] as $name => $test) {
    if ($test['status'] === 'failed') {
        if ($test['http_code'] === 404) {
            $issues[] = "Route '{$name}' returns 404 - .htaccess rewriting may not be working";
        } else {
            $issues[] = "Route '{$name}' failed with HTTP {$test['http_code']}";
        }
    }
}

// Check htaccess
if (!$results['htaccess']['public_html']['exists']) {
    $issues[] = 'Main .htaccess is missing from public_html - SPA and API routing will fail';
}

$results['issues'] = $issues;
$results['status'] = count($issues) === 0 ? 'healthy' : 'issues_found';
$results['issue_count'] = count($issues);

// Output
echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
