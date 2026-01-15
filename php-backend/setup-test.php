<?php
/**
 * Setup Test Script
 * Tests if the API is properly configured and accessible
 * DELETE THIS FILE AFTER TESTING!
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Collect environment info
$results = [
    'success' => true,
    'timestamp' => date('Y-m-d H:i:s'),
    'checks' => [],
    'hints' => []
];

// 1. PHP Version Check
$phpVersion = PHP_VERSION;
$phpOk = version_compare($phpVersion, '8.1.0', '>=');
$results['checks']['php_version'] = [
    'status' => $phpOk ? 'ok' : 'error',
    'value' => $phpVersion,
    'required' => '8.1.0+'
];
if (!$phpOk) {
    $results['success'] = false;
    $results['hints'][] = 'Upgrade PHP to version 8.1 or higher';
}

// 2. Required Extensions
$requiredExtensions = ['pdo', 'pdo_mysql', 'json', 'mbstring', 'openssl'];
$missingExtensions = [];
foreach ($requiredExtensions as $ext) {
    if (!extension_loaded($ext)) {
        $missingExtensions[] = $ext;
    }
}
$results['checks']['extensions'] = [
    'status' => empty($missingExtensions) ? 'ok' : 'error',
    'loaded' => array_filter($requiredExtensions, fn($e) => extension_loaded($e)),
    'missing' => $missingExtensions
];
if (!empty($missingExtensions)) {
    $results['success'] = false;
    $results['hints'][] = 'Install missing PHP extensions: ' . implode(', ', $missingExtensions);
}

// 3. Config File Check
$configPath = __DIR__ . '/config.php';
$configExamplePath = __DIR__ . '/config.example.php';
$configExists = file_exists($configPath);
$configExampleExists = file_exists($configExamplePath);

$results['checks']['config'] = [
    'status' => $configExists ? 'ok' : 'error',
    'config_exists' => $configExists,
    'config_example_exists' => $configExampleExists
];
if (!$configExists) {
    $results['success'] = false;
    $results['hints'][] = 'Copy config.example.php to config.php and edit with your database credentials';
}

// 4. Database Connection Test
if ($configExists) {
    try {
        $config = require $configPath;
        
        $dsn = "mysql:host={$config['db']['host']};port={$config['db']['port']};dbname={$config['db']['database']};charset=utf8mb4";
        $pdo = new PDO($dsn, $config['db']['username'], $config['db']['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 5
        ]);
        
        // Test query
        $pdo->query('SELECT 1');
        
        $results['checks']['database'] = [
            'status' => 'ok',
            'connected' => true,
            'host' => $config['db']['host'],
            'database' => $config['db']['database']
        ];
        
        // 5. Check Required Tables
        $stmt = $pdo->query('SHOW TABLES');
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        $requiredTables = ['users', 'profiles', 'domains', 'temp_emails', 'mailboxes', 'app_settings'];
        $missingTables = array_diff($requiredTables, $tables);
        
        $results['checks']['tables'] = [
            'status' => empty($missingTables) ? 'ok' : 'warning',
            'found' => array_intersect($requiredTables, $tables),
            'missing' => array_values($missingTables)
        ];
        
        if (!empty($missingTables)) {
            $results['hints'][] = 'Run install.php to create missing tables: ' . implode(', ', $missingTables);
        }
        
    } catch (PDOException $e) {
        $results['success'] = false;
        $errorMsg = $e->getMessage();
        
        $results['checks']['database'] = [
            'status' => 'error',
            'connected' => false,
            'error' => $errorMsg
        ];
        
        // Provide specific hints based on error
        if (strpos($errorMsg, 'Access denied') !== false) {
            $results['hints'][] = 'Database credentials are incorrect. Check username and password in config.php';
        } elseif (strpos($errorMsg, 'Unknown database') !== false) {
            $results['hints'][] = 'Database does not exist. Create it in cPanel or update database name in config.php';
        } elseif (strpos($errorMsg, 'Connection refused') !== false) {
            $results['hints'][] = 'MySQL server is not running or host is incorrect. Try "localhost" or "127.0.0.1"';
        } elseif (strpos($errorMsg, 'No such file or directory') !== false) {
            $results['hints'][] = 'MySQL socket not found. Contact your hosting provider or try IP address instead of localhost';
        } else {
            $results['hints'][] = 'Database connection failed: ' . $errorMsg;
        }
    }
} else {
    $results['checks']['database'] = [
        'status' => 'skipped',
        'reason' => 'config.php not found'
    ];
}

// 6. Directory Permissions
$directories = ['logs', 'storage', 'storage/avatars', 'storage/attachments'];
$dirResults = [];
foreach ($directories as $dir) {
    $fullPath = __DIR__ . '/' . $dir;
    if (!is_dir($fullPath)) {
        @mkdir($fullPath, 0755, true);
    }
    $dirResults[$dir] = is_writable($fullPath);
}

$results['checks']['directories'] = [
    'status' => !in_array(false, $dirResults) ? 'ok' : 'warning',
    'writable' => $dirResults
];

$notWritable = array_keys(array_filter($dirResults, fn($v) => !$v));
if (!empty($notWritable)) {
    $results['hints'][] = 'Set permissions to 755 or 775 for directories: ' . implode(', ', $notWritable);
}

// 7. .htaccess Check
$htaccessPath = __DIR__ . '/.htaccess';
$htaccessExists = file_exists($htaccessPath);
$results['checks']['htaccess'] = [
    'status' => $htaccessExists ? 'ok' : 'error',
    'exists' => $htaccessExists
];
if (!$htaccessExists) {
    $results['hints'][] = '.htaccess file is missing. This is required for URL routing.';
}

// 8. Mod Rewrite Check (basic test)
$modRewriteCheck = function_exists('apache_get_modules') ? in_array('mod_rewrite', apache_get_modules()) : null;
$results['checks']['mod_rewrite'] = [
    'status' => $modRewriteCheck === null ? 'unknown' : ($modRewriteCheck ? 'ok' : 'error'),
    'enabled' => $modRewriteCheck,
    'note' => $modRewriteCheck === null ? 'Cannot detect - running in CGI/FastCGI mode' : null
];

// Summary
echo json_encode([
    'api_test' => 'success',
    'message' => $results['success'] 
        ? 'All critical checks passed! Your API should be working.' 
        : 'Some checks failed. Please review the hints below.',
    'results' => $results,
    'next_steps' => [
        'If database checks passed, try: /api/health',
        'If you see 404 errors, check .htaccess and mod_rewrite',
        'Delete this file (setup-test.php) after testing!'
    ]
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
