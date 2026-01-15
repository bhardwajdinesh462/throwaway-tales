<?php
/**
 * Configuration Verification Script
 * Run this after installation to verify database connection and PHP extensions
 * DELETE THIS FILE after verification for security!
 */

header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

$checks = [
    'php_version' => phpversion(),
    'php_version_ok' => version_compare(phpversion(), '8.1.0', '>='),
    'config_exists' => false,
    'db_connected' => false,
    'db_error' => null,
    'tables' => [],
    'missing_tables' => [],
    'extensions' => [],
    'directories' => [],
];

// 1. Check config.php exists
$configPath = __DIR__ . '/config.php';
$checks['config_exists'] = file_exists($configPath);

if (!$checks['config_exists']) {
    $checks['hint'] = 'Copy config.example.php to config.php and update with your database credentials';
    echo json_encode(['success' => false, 'checks' => $checks], JSON_PRETTY_PRINT);
    exit;
}

// 2. Load config
$config = require $configPath;

// 3. Check required PHP extensions
$requiredExtensions = ['pdo', 'pdo_mysql', 'json', 'mbstring', 'openssl'];
$optionalExtensions = ['imap', 'curl', 'gd', 'zip'];

foreach ($requiredExtensions as $ext) {
    $checks['extensions'][$ext] = [
        'loaded' => extension_loaded($ext),
        'required' => true
    ];
}

foreach ($optionalExtensions as $ext) {
    $checks['extensions'][$ext] = [
        'loaded' => extension_loaded($ext),
        'required' => false
    ];
}

// 4. Try database connection with detailed error
try {
    $db = $config['db'] ?? [];
    
    if (empty($db['host']) || empty($db['name']) || empty($db['user'])) {
        throw new Exception('Database configuration incomplete. Check db.host, db.name, db.user in config.php');
    }
    
    $dsn = "mysql:host={$db['host']};dbname={$db['name']};charset=" . ($db['charset'] ?? 'utf8mb4');
    $pdo = new PDO($dsn, $db['user'], $db['pass'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 10,
    ]);
    
    $checks['db_connected'] = true;
    $checks['db_host'] = $db['host'];
    $checks['db_name'] = $db['name'];
    
    // Test query
    $stmt = $pdo->query('SELECT 1 as test');
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $checks['db_query_works'] = ($result['test'] == 1);
    
} catch (PDOException $e) {
    $checks['db_connected'] = false;
    $checks['db_error'] = $e->getMessage();
    
    // Provide helpful hints based on error
    if (strpos($e->getMessage(), 'Access denied') !== false) {
        $checks['hint'] = 'Check your database username and password in config.php';
    } elseif (strpos($e->getMessage(), 'Unknown database') !== false) {
        $checks['hint'] = 'Create the database first, or check the database name in config.php';
    } elseif (strpos($e->getMessage(), 'Connection refused') !== false) {
        $checks['hint'] = 'MySQL server may not be running, or check db.host (try "localhost" or "127.0.0.1")';
    } else {
        $checks['hint'] = 'Verify all database credentials in config.php';
    }
} catch (Exception $e) {
    $checks['db_connected'] = false;
    $checks['db_error'] = $e->getMessage();
}

// 5. Check required tables (if connected)
if ($checks['db_connected']) {
    $requiredTables = [
        'users', 'profiles', 'user_roles', 'domains', 'temp_emails', 'received_emails',
        'email_attachments', 'app_settings', 'blogs', 'subscription_tiers', 'user_subscriptions',
        'email_stats', 'email_logs', 'mailboxes', 'user_suspensions', 'admin_audit_logs',
        'friendly_websites', 'homepage_sections', 'email_verifications', 'backup_history',
        'rate_limits', 'user_2fa', 'blocked_ips', 'blocked_emails', 'blocked_countries',
        'banners', 'saved_emails', 'user_invoices', 'email_templates', 'email_forwarding',
        'push_subscriptions', 'user_usage', 'admin_role_requests', 'blog_subscribers'
    ];
    
    foreach ($requiredTables as $table) {
        try {
            $stmt = $pdo->query("SELECT 1 FROM `$table` LIMIT 1");
            $checks['tables'][$table] = true;
        } catch (PDOException $e) {
            $checks['tables'][$table] = false;
            $checks['missing_tables'][] = $table;
        }
    }
    
    if (!empty($checks['missing_tables'])) {
        $checks['tables_hint'] = 'Run install.php to create missing tables, or import schema.sql manually';
    }
}

// 6. Check directories
$directories = [
    'logs' => __DIR__ . '/logs',
    'storage' => __DIR__ . '/storage',
    'storage/avatars' => __DIR__ . '/storage/avatars',
    'storage/attachments' => __DIR__ . '/storage/attachments',
];

foreach ($directories as $name => $path) {
    $exists = is_dir($path);
    $writable = $exists ? is_writable($path) : false;
    $checks['directories'][$name] = [
        'exists' => $exists,
        'writable' => $writable,
        'path' => $path
    ];
}

// 7. Overall success
$checks['success'] = $checks['config_exists'] 
    && $checks['db_connected'] 
    && empty($checks['missing_tables'])
    && $checks['php_version_ok'];

// Security warning
$checks['security_warning'] = 'DELETE THIS FILE (verify-config.php) after verification!';

echo json_encode($checks, JSON_PRETTY_PRINT);
