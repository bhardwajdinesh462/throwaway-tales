<?php
/**
 * Logs Routes - Comprehensive error log access and diagnostics
 * Provides detailed error information for debugging
 */

function handleLogsRoute($action, $method, $body, $pdo, $config) {
    $logDir = __DIR__ . '/../logs';
    
    // Ensure logs directory exists
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    
    // Initialize logger
    $logger = ErrorLogger::getInstance($logDir);
    
    // ============================================
    // PUBLIC DEBUG ENDPOINTS (for troubleshooting)
    // ============================================
    
    // Check if accessing a public debug endpoint
    $publicEndpoints = ['errors', 'status', 'test-write', 'files'];
    $isPublicEndpoint = in_array($action, $publicEndpoints);
    
    // Allow access to public endpoints with debug token or during setup
    $debugToken = $config['debug_token'] ?? '';
    $providedToken = $_GET['token'] ?? '';
    $configExists = file_exists(__DIR__ . '/../config.php');
    
    // Check admin auth
    $user = null;
    $userId = null;
    $isAdmin = false;
    
    try {
        $user = getAuthUser($pdo, $config);
        $userId = $user['id'] ?? null;
        $isAdmin = $userId ? checkIsAdmin($pdo, $userId) : false;
    } catch (Exception $e) {
        // Auth check failed - continue for public endpoints
    }
    
    // Determine access
    $hasDebugToken = !empty($debugToken) && $providedToken === $debugToken;
    $isSetupMode = !$configExists;
    $allowPublicAccess = $isPublicEndpoint && ($isSetupMode || $hasDebugToken || $isAdmin);
    
    // ============================================
    // HANDLE ENDPOINTS
    // ============================================
    
    switch ($action) {
        // ----------------------------------------
        // STATUS - Check logging system health
        // ----------------------------------------
        case 'status':
            $writable = is_writable($logDir);
            $files = glob($logDir . '/*.log') ?: [];
            
            echo json_encode([
                'success' => true,
                'logging_available' => $writable,
                'log_directory' => $logDir,
                'directory_exists' => is_dir($logDir),
                'directory_writable' => $writable,
                'log_files_count' => count($files),
                'log_files' => array_map(function($f) {
                    return [
                        'name' => basename($f),
                        'size' => filesize($f),
                        'size_human' => formatBytes(filesize($f)),
                        'modified' => date('Y-m-d H:i:s', filemtime($f))
                    ];
                }, $files),
                'php_error_log' => ini_get('error_log'),
                'error_reporting' => error_reporting(),
                'display_errors' => ini_get('display_errors'),
                'log_errors' => ini_get('log_errors'),
                'server_time' => date('Y-m-d H:i:s'),
                'timezone' => date_default_timezone_get()
            ], JSON_PRETTY_PRINT);
            return;
            
        // ----------------------------------------
        // TEST-WRITE - Verify log writing works
        // ----------------------------------------
        case 'test-write':
            $testFile = $logDir . '/test-' . time() . '.log';
            $testContent = json_encode([
                'timestamp' => date('Y-m-d H:i:s'),
                'level' => 'TEST',
                'message' => 'Log write test',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
            ]) . "\n";
            
            $result = @file_put_contents($testFile, $testContent);
            
            if ($result !== false) {
                // Verify we can read it back
                $readBack = @file_get_contents($testFile);
                @unlink($testFile); // Clean up
                
                // Also write a real test entry
                $logger->info('Log test successful', [
                    'triggered_by' => $userId ?? 'public',
                    'test_time' => date('Y-m-d H:i:s')
                ]);
                $logger->error('Test error entry', [
                    'purpose' => 'Verifying error logging works',
                    'triggered_by' => $userId ?? 'public'
                ]);
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Log writing is working correctly',
                    'test_file_created' => true,
                    'test_file_readable' => $readBack === $testContent,
                    'entries_logged' => true,
                    'check_files' => [
                        'app-' . date('Y-m-d') . '.log',
                        'error-' . date('Y-m-d') . '.log'
                    ],
                    'hint' => 'Check /api/logs/errors to see the test entries'
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'error' => 'Cannot write to log directory',
                    'log_directory' => $logDir,
                    'directory_exists' => is_dir($logDir),
                    'directory_writable' => is_writable($logDir),
                    'parent_writable' => is_writable(dirname($logDir)),
                    'hint' => 'Check directory permissions. Run: chmod 755 logs/'
                ]);
            }
            return;
            
        // ----------------------------------------
        // FILES - List all log files
        // ----------------------------------------
        case 'files':
            if (!$allowPublicAccess && !$isAdmin) {
                http_response_code(403);
                echo json_encode(['error' => 'Access denied', 'hint' => 'Add ?token=YOUR_DEBUG_TOKEN']);
                return;
            }
            
            $files = glob($logDir . '/*.log') ?: [];
            usort($files, function($a, $b) {
                return filemtime($b) - filemtime($a);
            });
            
            echo json_encode([
                'success' => true,
                'directory' => $logDir,
                'writable' => is_writable($logDir),
                'files' => array_map(function($f) {
                    return [
                        'name' => basename($f),
                        'size' => filesize($f),
                        'size_human' => formatBytes(filesize($f)),
                        'lines' => count(@file($f) ?: []),
                        'modified' => date('Y-m-d H:i:s', filemtime($f)),
                        'age_hours' => round((time() - filemtime($f)) / 3600, 1)
                    ];
                }, $files)
            ], JSON_PRETTY_PRINT);
            return;
            
        // ----------------------------------------
        // ERRORS - View recent errors (PUBLIC with token)
        // ----------------------------------------
        case 'errors':
            if (!$allowPublicAccess && !$isAdmin) {
                http_response_code(403);
                echo json_encode([
                    'error' => 'Access denied',
                    'hint' => 'Add ?token=YOUR_DEBUG_TOKEN or login as admin'
                ]);
                return;
            }
            
            $limit = min(intval($_GET['limit'] ?? 100), 500);
            $search = $_GET['search'] ?? null;
            $level = $_GET['level'] ?? null;
            
            // Get errors from structured logs
            $logs = $logger->getRecentLogs('error', $limit, $search, $level);
            
            // Also get raw PHP errors
            $phpErrorLog = $logDir . '/php-errors.log';
            $phpErrors = [];
            if (file_exists($phpErrorLog)) {
                $lines = @file($phpErrorLog, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                if ($lines) {
                    $phpErrors = array_slice(array_reverse($lines), 0, 50);
                }
            }
            
            // Get app-level logs too
            $appLogs = $logger->getRecentLogs('app', min($limit, 50), $search, $level);
            
            // API logs
            $apiLogs = $logger->getRecentLogs('api', min($limit, 50), $search, $level);
            
            echo json_encode([
                'success' => true,
                'summary' => [
                    'error_count' => count($logs),
                    'app_log_count' => count($appLogs),
                    'api_log_count' => count($apiLogs),
                    'php_error_count' => count($phpErrors)
                ],
                'errors' => $logs,
                'app_logs' => $appLogs,
                'api_logs' => $apiLogs,
                'php_errors' => $phpErrors,
                'log_stats' => $logger->getLogStats(),
                'files' => [
                    'error_log' => 'error-' . date('Y-m-d') . '.log',
                    'app_log' => 'app-' . date('Y-m-d') . '.log',
                    'api_log' => 'api-' . date('Y-m-d') . '.log',
                    'php_errors' => 'php-errors.log'
                ]
            ], JSON_PRETTY_PRINT);
            return;
            
        // ----------------------------------------
        // ADMIN-ONLY ENDPOINTS BELOW
        // ----------------------------------------
        default:
            break;
    }
    
    // All other endpoints require admin auth
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    switch ($action) {
        case 'recent':
            $type = $_GET['type'] ?? 'all';
            $limit = min(intval($_GET['limit'] ?? 100), 500);
            $search = $_GET['search'] ?? null;
            $level = $_GET['level'] ?? null;
            
            $logs = $logger->getRecentLogs($type, $limit, $search, $level);
            echo json_encode([
                'success' => true,
                'logs' => $logs, 
                'count' => count($logs),
                'type' => $type,
                'filters' => ['search' => $search, 'level' => $level]
            ]);
            break;

        case 'stats':
            $stats = $logger->getLogStats();
            $stats['success'] = true;
            echo json_encode($stats, JSON_PRETTY_PRINT);
            break;

        case 'clear':
            if ($method !== 'POST' && $method !== 'DELETE') {
                http_response_code(405);
                echo json_encode(['error' => 'Method not allowed']);
                return;
            }
            
            $type = $body['type'] ?? 'all';
            $logger->clearLogs($type);
            
            // Log the clear action
            $logger->info('Logs cleared by admin', ['type' => $type, 'admin_id' => $userId]);
            
            echo json_encode(['success' => true, 'message' => "Logs cleared (type: $type)"]);
            break;

        case 'download':
            $type = $_GET['type'] ?? 'error';
            $date = $_GET['date'] ?? date('Y-m-d');
            
            // Sanitize inputs
            $type = preg_replace('/[^a-z]/', '', $type);
            $date = preg_replace('/[^0-9\-]/', '', $date);
            
            $filename = $type . '-' . $date . '.log';
            $filepath = $logDir . '/' . $filename;
            
            if (!file_exists($filepath)) {
                http_response_code(404);
                echo json_encode([
                    'error' => 'Log file not found',
                    'file' => $filename,
                    'available' => array_map('basename', glob($logDir . '/*.log') ?: [])
                ]);
                return;
            }
            
            header('Content-Type: text/plain');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Content-Length: ' . filesize($filepath));
            readfile($filepath);
            exit;
            
        case 'view':
            $type = $_GET['type'] ?? 'error';
            $date = $_GET['date'] ?? date('Y-m-d');
            $lines = min(intval($_GET['lines'] ?? 100), 1000);
            
            $type = preg_replace('/[^a-z]/', '', $type);
            $date = preg_replace('/[^0-9\-]/', '', $date);
            
            $filename = $type . '-' . $date . '.log';
            $filepath = $logDir . '/' . $filename;
            
            if (!file_exists($filepath)) {
                http_response_code(404);
                echo json_encode([
                    'error' => 'Log file not found',
                    'file' => $filename
                ]);
                return;
            }
            
            $allLines = @file($filepath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            $recentLines = array_slice(array_reverse($allLines), 0, $lines);
            
            $entries = [];
            foreach ($recentLines as $line) {
                $entry = json_decode($line, true);
                if ($entry) {
                    $entries[] = $entry;
                } else {
                    $entries[] = ['raw' => $line];
                }
            }
            
            echo json_encode([
                'success' => true,
                'file' => $filename,
                'total_lines' => count($allLines),
                'showing' => count($entries),
                'entries' => $entries
            ], JSON_PRETTY_PRINT);
            break;
            
        case 'test':
            // Create test log entries at all levels
            $testId = uniqid('test_');
            
            $logger->debug('Test DEBUG entry', ['test_id' => $testId, 'admin_id' => $userId]);
            $logger->info('Test INFO entry', ['test_id' => $testId, 'admin_id' => $userId]);
            $logger->warning('Test WARNING entry', ['test_id' => $testId, 'admin_id' => $userId]);
            $logger->error('Test ERROR entry', ['test_id' => $testId, 'admin_id' => $userId]);
            $logger->api('Test API entry', ['test_id' => $testId, 'admin_id' => $userId]);
            
            // Trigger a PHP warning to test error handling
            @trigger_error('Test triggered warning', E_USER_WARNING);
            
            echo json_encode([
                'success' => true,
                'message' => 'Test log entries created at all levels',
                'test_id' => $testId,
                'entries_created' => ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'API'],
                'log_files' => [
                    'app-' . date('Y-m-d') . '.log',
                    'error-' . date('Y-m-d') . '.log',
                    'api-' . date('Y-m-d') . '.log'
                ],
                'check' => '/api/logs/errors?token=YOUR_TOKEN'
            ]);
            break;

        default:
            // Default: show log status and stats
            echo json_encode([
                'success' => true,
                'endpoints' => [
                    'GET /api/logs/status' => 'Check logging system status',
                    'GET /api/logs/test-write' => 'Test log writing capability',
                    'GET /api/logs/files' => 'List all log files',
                    'GET /api/logs/errors' => 'View recent errors (requires token)',
                    'GET /api/logs/recent' => 'View recent logs (admin)',
                    'GET /api/logs/stats' => 'Get log statistics (admin)',
                    'GET /api/logs/view?type=error&date=YYYY-MM-DD' => 'View specific log file (admin)',
                    'GET /api/logs/download?type=error&date=YYYY-MM-DD' => 'Download log file (admin)',
                    'POST /api/logs/test' => 'Create test log entries (admin)',
                    'POST /api/logs/clear' => 'Clear logs (admin)'
                ],
                'stats' => $logger->getLogStats()
            ], JSON_PRETTY_PRINT);
    }
}

/**
 * Format bytes to human readable
 */
function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    return round($bytes / (1024 ** $pow), $precision) . ' ' . $units[$pow];
}
