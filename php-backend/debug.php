<?php
/**
 * TempMail Debug & Diagnostics Script
 * 
 * This is a minimal diagnostic script that will work even when other files fail.
 * It checks PHP configuration and logs all errors to help troubleshoot issues.
 * 
 * DELETE THIS FILE AFTER TROUBLESHOOTING!
 */

// Absolute minimum error handling - show everything
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Set content type based on request
$isJson = isset($_GET['json']) || (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false);

if ($isJson) {
    header('Content-Type: application/json');
} else {
    header('Content-Type: text/html; charset=utf-8');
}

// Collect diagnostic information
$diagnostics = [];
$errors = [];
$warnings = [];

// ============================================
// 1. PHP VERSION
// ============================================
$diagnostics['php_version'] = PHP_VERSION;
$diagnostics['php_version_ok'] = version_compare(PHP_VERSION, '8.0.0', '>=');
if (!$diagnostics['php_version_ok']) {
    $errors[] = "PHP 8.0+ required, you have " . PHP_VERSION;
}

// ============================================
// 2. PHP EXTENSIONS
// ============================================
$requiredExtensions = ['pdo_mysql', 'mbstring', 'json', 'openssl'];
$optionalExtensions = ['imap', 'curl', 'gd', 'zip'];

$diagnostics['extensions'] = [
    'required' => [],
    'optional' => []
];

foreach ($requiredExtensions as $ext) {
    $loaded = extension_loaded($ext);
    $diagnostics['extensions']['required'][$ext] = $loaded;
    if (!$loaded) {
        $errors[] = "Missing required extension: $ext";
    }
}

foreach ($optionalExtensions as $ext) {
    $loaded = extension_loaded($ext);
    $diagnostics['extensions']['optional'][$ext] = $loaded;
    if (!$loaded) {
        $warnings[] = "Missing optional extension: $ext";
    }
}

// ============================================
// 3. DIRECTORIES & PERMISSIONS
// ============================================
$baseDir = __DIR__;
$diagnostics['directories'] = [];

$dirsToCheck = [
    '.' => $baseDir,
    'logs' => $baseDir . '/logs',
    'storage' => $baseDir . '/storage',
    'storage/attachments' => $baseDir . '/storage/attachments',
    'storage/avatars' => $baseDir . '/storage/avatars',
    'includes' => $baseDir . '/includes',
    'routes' => $baseDir . '/routes',
    'cron' => $baseDir . '/cron'
];

foreach ($dirsToCheck as $name => $path) {
    $exists = is_dir($path);
    $writable = $exists ? is_writable($path) : false;
    $perms = $exists ? substr(sprintf('%o', fileperms($path)), -4) : 'N/A';
    
    $diagnostics['directories'][$name] = [
        'exists' => $exists,
        'writable' => $writable,
        'permissions' => $perms
    ];
    
    if ($name === 'logs' && !$writable) {
        $errors[] = "logs/ directory is not writable";
    }
}

// ============================================
// 4. KEY FILES
// ============================================
$diagnostics['files'] = [];

$filesToCheck = [
    'config.php' => $baseDir . '/config.php',
    'index.php' => $baseDir . '/index.php',
    'install.php' => $baseDir . '/install.php',
    'schema.sql' => $baseDir . '/schema.sql',
    '.htaccess' => $baseDir . '/.htaccess',
    '.install_lock' => $baseDir . '/.install_lock',
    'error-logger.php' => $baseDir . '/error-logger.php',
    'includes/db.php' => $baseDir . '/includes/db.php',
    'includes/helpers.php' => $baseDir . '/includes/helpers.php'
];

foreach ($filesToCheck as $name => $path) {
    $exists = file_exists($path);
    $readable = $exists ? is_readable($path) : false;
    $size = $exists ? filesize($path) : 0;
    
    $diagnostics['files'][$name] = [
        'exists' => $exists,
        'readable' => $readable,
        'size' => $size
    ];
}

// ============================================
// 5. PHP CONFIGURATION
// ============================================
$diagnostics['php_config'] = [
    'memory_limit' => ini_get('memory_limit'),
    'max_execution_time' => ini_get('max_execution_time'),
    'post_max_size' => ini_get('post_max_size'),
    'upload_max_filesize' => ini_get('upload_max_filesize'),
    'display_errors' => ini_get('display_errors'),
    'log_errors' => ini_get('log_errors'),
    'error_log' => ini_get('error_log'),
    'session.save_handler' => ini_get('session.save_handler'),
    'session.save_path' => ini_get('session.save_path')
];

// ============================================
// 6. SERVER INFO
// ============================================
$diagnostics['server'] = [
    'software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
    'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'Unknown',
    'script_filename' => $_SERVER['SCRIPT_FILENAME'] ?? 'Unknown',
    'request_uri' => $_SERVER['REQUEST_URI'] ?? 'Unknown',
    'php_sapi' => php_sapi_name()
];

// ============================================
// 7. TRY TO CREATE LOG FILE
// ============================================
$testLogFile = $baseDir . '/logs/debug-test.log';
$logTestResult = false;
$logError = null;

if (!is_dir($baseDir . '/logs')) {
    if (@mkdir($baseDir . '/logs', 0755, true)) {
        $diagnostics['directories']['logs']['created'] = true;
    }
}

if (is_dir($baseDir . '/logs')) {
    $testContent = date('Y-m-d H:i:s') . " - Debug test log entry\n";
    if (@file_put_contents($testLogFile, $testContent, FILE_APPEND)) {
        $logTestResult = true;
    } else {
        $logError = error_get_last()['message'] ?? 'Unknown error';
    }
}

$diagnostics['log_test'] = [
    'success' => $logTestResult,
    'error' => $logError
];

// ============================================
// 8. TRY TO INCLUDE FILES
// ============================================
$includeTests = [];

// Test including error-logger.php
try {
    if (file_exists($baseDir . '/error-logger.php')) {
        include_once $baseDir . '/error-logger.php';
        $includeTests['error-logger.php'] = 'OK';
    } else {
        $includeTests['error-logger.php'] = 'File not found';
    }
} catch (Throwable $e) {
    $includeTests['error-logger.php'] = 'Error: ' . $e->getMessage();
    $errors[] = "error-logger.php: " . $e->getMessage();
}

// Test including helpers.php
try {
    if (file_exists($baseDir . '/includes/helpers.php')) {
        include_once $baseDir . '/includes/helpers.php';
        $includeTests['includes/helpers.php'] = 'OK';
    } else {
        $includeTests['includes/helpers.php'] = 'File not found';
    }
} catch (Throwable $e) {
    $includeTests['includes/helpers.php'] = 'Error: ' . $e->getMessage();
    $errors[] = "includes/helpers.php: " . $e->getMessage();
}

$diagnostics['include_tests'] = $includeTests;

// ============================================
// 9. CHECK LAST PHP ERROR
// ============================================
$lastError = error_get_last();
if ($lastError) {
    $diagnostics['last_php_error'] = [
        'type' => $lastError['type'],
        'message' => $lastError['message'],
        'file' => $lastError['file'],
        'line' => $lastError['line']
    ];
}

// ============================================
// 10. WRITE ERROR LOG
// ============================================
$logContent = "=== TempMail Debug Log ===\n";
$logContent .= "Timestamp: " . date('Y-m-d H:i:s') . "\n";
$logContent .= "PHP Version: " . PHP_VERSION . "\n";
$logContent .= "Server: " . ($_SERVER['SERVER_SOFTWARE'] ?? 'Unknown') . "\n\n";

if (!empty($errors)) {
    $logContent .= "ERRORS:\n";
    foreach ($errors as $err) {
        $logContent .= "  - $err\n";
    }
    $logContent .= "\n";
}

if (!empty($warnings)) {
    $logContent .= "WARNINGS:\n";
    foreach ($warnings as $warn) {
        $logContent .= "  - $warn\n";
    }
    $logContent .= "\n";
}

$logContent .= "DIAGNOSTICS:\n";
$logContent .= print_r($diagnostics, true);
$logContent .= "\n=== End Debug Log ===\n\n";

@file_put_contents($baseDir . '/logs/debug.log', $logContent, FILE_APPEND);

// ============================================
// OUTPUT RESULTS
// ============================================
$result = [
    'status' => empty($errors) ? 'ok' : 'error',
    'timestamp' => date('c'),
    'errors' => $errors,
    'warnings' => $warnings,
    'diagnostics' => $diagnostics
];

if ($isJson) {
    echo json_encode($result, JSON_PRETTY_PRINT);
} else {
    // HTML output
    ?>
<!DOCTYPE html>
<html>
<head>
    <title>TempMail Debug Diagnostics</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; max-width: 1000px; margin: 40px auto; padding: 20px; background: #1a1a2e; color: #eee; }
        h1 { color: #00d9ff; }
        h2 { color: #ffc107; border-bottom: 1px solid #333; padding-bottom: 10px; margin-top: 30px; }
        .ok { color: #4caf50; }
        .error { color: #f44336; }
        .warning { color: #ff9800; }
        .box { background: #16213e; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .box.error-box { border-left: 4px solid #f44336; }
        .box.warning-box { border-left: 4px solid #ff9800; }
        .box.success-box { border-left: 4px solid #4caf50; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #333; }
        th { background: #0f3460; }
        tr:hover { background: #1f4068; }
        code { background: #0f3460; padding: 2px 6px; border-radius: 4px; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 12px; }
        .badge-ok { background: #1b5e20; color: #fff; }
        .badge-error { background: #b71c1c; color: #fff; }
        .badge-warn { background: #e65100; color: #fff; }
        pre { background: #0f3460; padding: 15px; border-radius: 8px; overflow-x: auto; font-size: 13px; }
        .important { background: #ff5722; color: white; padding: 15px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>🔧 TempMail Debug Diagnostics</h1>
    <p>Generated: <?= date('Y-m-d H:i:s') ?></p>
    
    <?php if (!empty($errors)): ?>
    <div class="important">
        <strong>⚠️ ERRORS FOUND:</strong>
        <ul>
            <?php foreach ($errors as $err): ?>
            <li><?= htmlspecialchars($err) ?></li>
            <?php endforeach; ?>
        </ul>
    </div>
    <?php else: ?>
    <div class="box success-box">
        <strong>✅ No critical errors detected!</strong>
    </div>
    <?php endif; ?>
    
    <?php if (!empty($warnings)): ?>
    <div class="box warning-box">
        <strong>⚠️ Warnings:</strong>
        <ul>
            <?php foreach ($warnings as $warn): ?>
            <li><?= htmlspecialchars($warn) ?></li>
            <?php endforeach; ?>
        </ul>
    </div>
    <?php endif; ?>
    
    <h2>PHP Version</h2>
    <div class="box">
        <strong>Version:</strong> <?= PHP_VERSION ?> 
        <span class="badge <?= $diagnostics['php_version_ok'] ? 'badge-ok' : 'badge-error' ?>">
            <?= $diagnostics['php_version_ok'] ? 'OK' : 'UPGRADE REQUIRED' ?>
        </span>
    </div>
    
    <h2>PHP Extensions</h2>
    <table>
        <tr><th>Extension</th><th>Type</th><th>Status</th></tr>
        <?php foreach ($diagnostics['extensions']['required'] as $ext => $loaded): ?>
        <tr>
            <td><code><?= $ext ?></code></td>
            <td>Required</td>
            <td><span class="badge <?= $loaded ? 'badge-ok' : 'badge-error' ?>"><?= $loaded ? 'Loaded' : 'MISSING' ?></span></td>
        </tr>
        <?php endforeach; ?>
        <?php foreach ($diagnostics['extensions']['optional'] as $ext => $loaded): ?>
        <tr>
            <td><code><?= $ext ?></code></td>
            <td>Optional</td>
            <td><span class="badge <?= $loaded ? 'badge-ok' : 'badge-warn' ?>"><?= $loaded ? 'Loaded' : 'Not loaded' ?></span></td>
        </tr>
        <?php endforeach; ?>
    </table>
    
    <h2>Directories</h2>
    <table>
        <tr><th>Directory</th><th>Exists</th><th>Writable</th><th>Permissions</th></tr>
        <?php foreach ($diagnostics['directories'] as $name => $info): ?>
        <tr>
            <td><code><?= $name ?></code></td>
            <td><span class="badge <?= $info['exists'] ? 'badge-ok' : 'badge-error' ?>"><?= $info['exists'] ? 'Yes' : 'No' ?></span></td>
            <td><span class="badge <?= $info['writable'] ? 'badge-ok' : 'badge-warn' ?>"><?= $info['writable'] ? 'Yes' : 'No' ?></span></td>
            <td><code><?= $info['permissions'] ?></code></td>
        </tr>
        <?php endforeach; ?>
    </table>
    
    <h2>Key Files</h2>
    <table>
        <tr><th>File</th><th>Exists</th><th>Readable</th><th>Size</th></tr>
        <?php foreach ($diagnostics['files'] as $name => $info): ?>
        <tr>
            <td><code><?= $name ?></code></td>
            <td><span class="badge <?= $info['exists'] ? 'badge-ok' : 'badge-warn' ?>"><?= $info['exists'] ? 'Yes' : 'No' ?></span></td>
            <td><span class="badge <?= $info['readable'] ? 'badge-ok' : 'badge-warn' ?>"><?= $info['readable'] ? 'Yes' : 'No' ?></span></td>
            <td><?= number_format($info['size']) ?> bytes</td>
        </tr>
        <?php endforeach; ?>
    </table>
    
    <h2>Include Tests</h2>
    <table>
        <tr><th>File</th><th>Result</th></tr>
        <?php foreach ($diagnostics['include_tests'] as $file => $result): ?>
        <tr>
            <td><code><?= $file ?></code></td>
            <td><span class="badge <?= $result === 'OK' ? 'badge-ok' : 'badge-error' ?>"><?= htmlspecialchars($result) ?></span></td>
        </tr>
        <?php endforeach; ?>
    </table>
    
    <h2>PHP Configuration</h2>
    <table>
        <tr><th>Setting</th><th>Value</th></tr>
        <?php foreach ($diagnostics['php_config'] as $key => $value): ?>
        <tr>
            <td><code><?= $key ?></code></td>
            <td><code><?= htmlspecialchars($value ?: 'Not set') ?></code></td>
        </tr>
        <?php endforeach; ?>
    </table>
    
    <h2>Server Info</h2>
    <table>
        <tr><th>Property</th><th>Value</th></tr>
        <?php foreach ($diagnostics['server'] as $key => $value): ?>
        <tr>
            <td><code><?= $key ?></code></td>
            <td><code><?= htmlspecialchars($value) ?></code></td>
        </tr>
        <?php endforeach; ?>
    </table>
    
    <?php if (!empty($diagnostics['last_php_error'])): ?>
    <h2>Last PHP Error</h2>
    <div class="box error-box">
        <pre><?= htmlspecialchars(print_r($diagnostics['last_php_error'], true)) ?></pre>
    </div>
    <?php endif; ?>
    
    <h2>Log Test</h2>
    <div class="box <?= $diagnostics['log_test']['success'] ? 'success-box' : 'error-box' ?>">
        <strong>Status:</strong> <?= $diagnostics['log_test']['success'] ? '✅ Log file write successful' : '❌ Failed to write log file' ?>
        <?php if ($diagnostics['log_test']['error']): ?>
        <br><strong>Error:</strong> <?= htmlspecialchars($diagnostics['log_test']['error']) ?>
        <?php endif; ?>
    </div>
    
    <h2>Next Steps</h2>
    <div class="box">
        <ol>
            <li>Fix any <span class="error">ERRORS</span> shown above</li>
            <li>Check the <code>logs/debug.log</code> file for more details</li>
            <li>Once all checks pass, try the <a href="install.php" style="color: #00d9ff;">installer</a> again</li>
            <li><strong>DELETE this debug.php file after troubleshooting!</strong></li>
        </ol>
    </div>
    
    <h2>Useful Commands for cPanel</h2>
    <div class="box">
        <p><strong>Fix directory permissions:</strong></p>
        <pre>chmod 755 logs storage storage/attachments storage/avatars
chmod 644 config.php .htaccess</pre>
        <p><strong>Create missing directories:</strong></p>
        <pre>mkdir -p logs storage/attachments storage/avatars</pre>
    </div>
    
    <p style="margin-top: 40px; color: #888;">
        <strong>Security Notice:</strong> Delete this file (<code>debug.php</code>) after troubleshooting!
    </p>
</body>
</html>
    <?php
}
