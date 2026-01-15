<?php
/**
 * LOG SYSTEM DIAGNOSTIC TOOL
 * Access this at: https://yourdomain.com/api/test-logs.php
 * 
 * This script tests and verifies the logging system is working correctly.
 * DELETE THIS FILE after confirming logs work!
 */

header('Content-Type: application/json');

$logsDir = __DIR__ . '/logs';
$results = [
    'success' => true,
    'timestamp' => date('Y-m-d H:i:s'),
    'php_version' => PHP_VERSION,
    'tests' => [],
    'errors' => [],
    'recommendations' => []
];

// ============================================
// TEST 1: Check logs directory
// ============================================
$results['tests']['logs_directory'] = [
    'path' => $logsDir,
    'exists' => is_dir($logsDir),
    'writable' => false,
    'status' => 'unknown'
];

if (!is_dir($logsDir)) {
    // Try to create it
    if (@mkdir($logsDir, 0755, true)) {
        $results['tests']['logs_directory']['exists'] = true;
        $results['tests']['logs_directory']['created'] = true;
    } else {
        $results['tests']['logs_directory']['status'] = 'FAILED';
        $results['errors'][] = "Cannot create logs directory: $logsDir";
        $results['recommendations'][] = "Run: mkdir -p $logsDir && chmod 755 $logsDir";
    }
}

if (is_dir($logsDir)) {
    $results['tests']['logs_directory']['writable'] = is_writable($logsDir);
    $results['tests']['logs_directory']['status'] = is_writable($logsDir) ? 'OK' : 'NOT_WRITABLE';
    
    if (!is_writable($logsDir)) {
        $results['errors'][] = "Logs directory exists but is not writable";
        $results['recommendations'][] = "Run: chmod 755 $logsDir";
    }
}

// ============================================
// TEST 2: Test file writing
// ============================================
$testFile = $logsDir . '/test-write-' . time() . '.tmp';
$testContent = "Test write at " . date('Y-m-d H:i:s');

$results['tests']['file_write'] = [
    'test_file' => $testFile,
    'write_result' => false,
    'read_back' => false,
    'status' => 'unknown'
];

$writeResult = @file_put_contents($testFile, $testContent);
if ($writeResult !== false) {
    $results['tests']['file_write']['write_result'] = true;
    $results['tests']['file_write']['bytes_written'] = $writeResult;
    
    // Test read back
    $readBack = @file_get_contents($testFile);
    $results['tests']['file_write']['read_back'] = ($readBack === $testContent);
    
    // Clean up
    @unlink($testFile);
    $results['tests']['file_write']['status'] = 'OK';
} else {
    $results['tests']['file_write']['status'] = 'FAILED';
    $results['errors'][] = "Cannot write to log directory";
    
    // Try to diagnose
    $results['tests']['file_write']['diagnostics'] = [
        'parent_exists' => is_dir(dirname($logsDir)),
        'parent_writable' => is_writable(dirname($logsDir)),
        'open_basedir' => ini_get('open_basedir'),
        'safe_mode' => ini_get('safe_mode')
    ];
}

// ============================================
// TEST 3: Create actual log entries
// ============================================
$results['tests']['log_entries'] = [
    'status' => 'unknown',
    'entries_created' => []
];

// Load the error logger
if (file_exists(__DIR__ . '/error-logger.php')) {
    require_once __DIR__ . '/error-logger.php';
    
    try {
        $logger = ErrorLogger::getInstance($logsDir);
        
        $testId = 'diag_' . uniqid();
        
        // Create test entries
        $logger->info("Diagnostic test - INFO level", ['test_id' => $testId, 'source' => 'test-logs.php']);
        $results['tests']['log_entries']['entries_created'][] = 'INFO';
        
        $logger->warning("Diagnostic test - WARNING level", ['test_id' => $testId, 'source' => 'test-logs.php']);
        $results['tests']['log_entries']['entries_created'][] = 'WARNING';
        
        $logger->error("Diagnostic test - ERROR level", ['test_id' => $testId, 'source' => 'test-logs.php']);
        $results['tests']['log_entries']['entries_created'][] = 'ERROR';
        
        $results['tests']['log_entries']['test_id'] = $testId;
        $results['tests']['log_entries']['status'] = 'OK';
        $results['tests']['log_entries']['logger_available'] = $logger->isAvailable();
        $results['tests']['log_entries']['init_errors'] = $logger->getInitErrors();
        
    } catch (Exception $e) {
        $results['tests']['log_entries']['status'] = 'FAILED';
        $results['tests']['log_entries']['error'] = $e->getMessage();
        $results['errors'][] = "Logger initialization failed: " . $e->getMessage();
    }
} else {
    $results['tests']['log_entries']['status'] = 'SKIPPED';
    $results['errors'][] = "error-logger.php not found";
}

// ============================================
// TEST 4: Verify log files exist
// ============================================
$results['tests']['log_files'] = [
    'status' => 'unknown',
    'files' => []
];

$logFiles = glob($logsDir . '/*.log') ?: [];
foreach ($logFiles as $file) {
    $results['tests']['log_files']['files'][] = [
        'name' => basename($file),
        'size' => filesize($file),
        'size_human' => formatBytes(filesize($file)),
        'modified' => date('Y-m-d H:i:s', filemtime($file)),
        'lines' => count(@file($file) ?: [])
    ];
}

$results['tests']['log_files']['count'] = count($logFiles);
$results['tests']['log_files']['status'] = count($logFiles) > 0 ? 'OK' : 'NO_FILES';

if (count($logFiles) === 0) {
    $results['recommendations'][] = "No log files found. Try accessing /api/logs/test-write to create test entries.";
}

// ============================================
// TEST 5: PHP error logging
// ============================================
$phpErrorLog = ini_get('error_log');
$results['tests']['php_error_log'] = [
    'path' => $phpErrorLog,
    'exists' => file_exists($phpErrorLog),
    'writable' => is_writable($phpErrorLog),
    'size' => file_exists($phpErrorLog) ? filesize($phpErrorLog) : 0
];

// ============================================
// TEST 6: Sample last entries
// ============================================
$errorLogFile = $logsDir . '/error-' . date('Y-m-d') . '.log';
$appLogFile = $logsDir . '/app-' . date('Y-m-d') . '.log';

$results['tests']['recent_entries'] = [
    'error_log' => [],
    'app_log' => []
];

if (file_exists($errorLogFile)) {
    $lines = @file($errorLogFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $results['tests']['recent_entries']['error_log'] = array_slice(array_reverse($lines), 0, 5);
}

if (file_exists($appLogFile)) {
    $lines = @file($appLogFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $results['tests']['recent_entries']['app_log'] = array_slice(array_reverse($lines), 0, 5);
}

// ============================================
// SUMMARY
// ============================================
$allPassed = empty($results['errors']);
$results['success'] = $allPassed;
$results['summary'] = $allPassed 
    ? "✅ All logging tests passed! Logs are working correctly." 
    : "❌ Some tests failed. Check errors and recommendations.";

$results['next_steps'] = [
    "1. View logs: GET /api/logs/errors",
    "2. View log files: GET /api/logs/files",
    "3. Test logging: GET /api/logs/test-write",
    "4. View stats: GET /api/logs/stats (admin only)",
    "5. DELETE this test file after confirming logs work!"
];

// Output
echo json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

// Helper function
function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    return round($bytes / (1024 ** $pow), $precision) . ' ' . $units[$pow];
}
