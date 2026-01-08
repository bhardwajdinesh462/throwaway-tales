<?php
/**
 * Logs Routes - Error log access with optional public debug mode
 */

function handleLogsRoute($action, $method, $body, $pdo, $config) {
    $logger = ErrorLogger::getInstance(__DIR__ . '/../logs');
    
    // Special case: 'errors' endpoint can be accessed without auth during setup
    // or with a debug token from config
    if ($action === 'errors') {
        $debugToken = $config['debug_token'] ?? '';
        $providedToken = $_GET['token'] ?? '';
        $configExists = file_exists(__DIR__ . '/../config.php');
        
        // Allow access if: no config yet (setup mode), or valid debug token, or admin auth
        $user = getAuthUser($pdo, $config);
        $userId = $user['id'] ?? null;
        $isAdmin = $userId ? checkIsAdmin($pdo, $userId) : false;
        
        $allowAccess = !$configExists || 
                       (!empty($debugToken) && $providedToken === $debugToken) || 
                       $isAdmin;
        
        if (!$allowAccess) {
            http_response_code(403);
            echo json_encode([
                'error' => 'Access denied',
                'hint' => 'Add ?token=YOUR_DEBUG_TOKEN or login as admin'
            ]);
            return;
        }
        
        // Return recent errors in a readable format
        $limit = min(intval($_GET['limit'] ?? 50), 200);
        $logs = $logger->getRecentLogs('error', $limit);
        
        // Also check for PHP error log
        $phpErrorLog = __DIR__ . '/../logs/php-errors.log';
        $phpErrors = [];
        if (file_exists($phpErrorLog)) {
            $lines = @file($phpErrorLog, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines) {
                $phpErrors = array_slice(array_reverse($lines), 0, 20);
            }
        }
        
        echo json_encode([
            'success' => true,
            'error_count' => count($logs),
            'logs' => $logs,
            'php_errors' => $phpErrors,
            'log_stats' => $logger->getLogStats(),
            'hint' => 'Errors are stored in logs/error-YYYY-MM-DD.log files'
        ], JSON_PRETTY_PRINT);
        return;
    }
    
    // All other log endpoints require admin auth
    $user = getAuthUser($pdo, $config);
    $userId = $user['id'] ?? null;
    $isAdmin = $userId ? checkIsAdmin($pdo, $userId) : false;

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
            echo json_encode(['logs' => $logs, 'count' => count($logs)]);
            break;

        case 'stats':
            $stats = $logger->getLogStats();
            echo json_encode($stats);
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
            
            echo json_encode(['success' => true, 'message' => 'Logs cleared']);
            break;

        case 'download':
            $type = $_GET['type'] ?? 'error';
            $date = $_GET['date'] ?? date('Y-m-d');
            
            $logDir = __DIR__ . '/../logs';
            $filename = ($type === 'error' ? 'error-' : 'app-') . $date . '.log';
            $filepath = $logDir . '/' . $filename;
            
            if (!file_exists($filepath)) {
                http_response_code(404);
                echo json_encode(['error' => 'Log file not found']);
                return;
            }
            
            header('Content-Type: text/plain');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            readfile($filepath);
            exit;
            
        case 'test':
            // Test logging - creates a test error entry
            $logger->error('Test error log entry', [
                'triggered_by' => $userId,
                'purpose' => 'Testing error logging system'
            ]);
            $logger->warning('Test warning log entry', ['triggered_by' => $userId]);
            $logger->info('Test info log entry', ['triggered_by' => $userId]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Test log entries created',
                'check' => '/api/logs/errors to view'
            ]);
            break;

        default:
            // Default: return recent errors
            $logs = $logger->getRecentLogs('error', 50);
            echo json_encode(['logs' => $logs, 'count' => count($logs)]);
    }
}
