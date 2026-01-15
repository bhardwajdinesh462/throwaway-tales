<?php
/**
 * Comprehensive Error Logging System
 * GUARANTEED to create log files with detailed, accurate error information
 * Compatible with PHP 8.0+
 * 
 * Log files created:
 * - logs/error-YYYY-MM-DD.log - Errors and critical issues
 * - logs/app-YYYY-MM-DD.log - Info, debug, and warnings
 * - logs/api-YYYY-MM-DD.log - API request/response logs
 * - logs/php-errors.log - Raw PHP errors
 */

class ErrorLogger {
    private static $instance = null;
    private $logDir;
    private $maxFileSize = 10485760; // 10MB
    private $maxFiles = 10;
    private $isWritable = true;
    private $initErrors = [];

    public const DEBUG = 'DEBUG';
    public const INFO = 'INFO';
    public const WARNING = 'WARNING';
    public const ERROR = 'ERROR';
    public const CRITICAL = 'CRITICAL';
    public const API = 'API';

    private function __construct($logDir) {
        $this->logDir = $logDir;
        $this->ensureLogDirectory();
        $this->registerErrorHandler();
        
        // Log initialization
        $this->writeDirectLog('INFO', 'ErrorLogger initialized', [
            'log_dir' => $this->logDir,
            'writable' => $this->isWritable,
            'php_version' => PHP_VERSION,
            'init_errors' => $this->initErrors
        ]);
    }

    public static function getInstance($logDir = null) {
        if (self::$instance === null) {
            self::$instance = new self($logDir ?? __DIR__ . '/logs');
        }
        return self::$instance;
    }

    private function ensureLogDirectory() {
        // Multiple attempts to create the directory
        if (!is_dir($this->logDir)) {
            // Try with full permissions first
            if (!@mkdir($this->logDir, 0777, true)) {
                // Try parent directory creation
                $parent = dirname($this->logDir);
                if (is_writable($parent)) {
                    if (!@mkdir($this->logDir, 0755, true)) {
                        $this->initErrors[] = "Failed to create logs directory: {$this->logDir}";
                        $this->isWritable = false;
                        error_log("ErrorLogger CRITICAL: Cannot create log directory: {$this->logDir}");
                        return;
                    }
                } else {
                    $this->initErrors[] = "Parent directory not writable: {$parent}";
                    $this->isWritable = false;
                    error_log("ErrorLogger CRITICAL: Parent directory not writable: {$parent}");
                    return;
                }
            }
            // Set permissions after creation
            @chmod($this->logDir, 0755);
        }
        
        if (!is_writable($this->logDir)) {
            // Try to fix permissions
            @chmod($this->logDir, 0755);
            if (!is_writable($this->logDir)) {
                $this->initErrors[] = "Log directory not writable: {$this->logDir}";
                $this->isWritable = false;
                error_log("ErrorLogger CRITICAL: Log directory not writable: {$this->logDir}");
                return;
            }
        }
        
        // Create protective files
        $this->createProtectiveFiles();
        
        // Create an initial test file to verify writing works
        $testFile = $this->logDir . '/test-write-' . time() . '.tmp';
        if (@file_put_contents($testFile, 'test') === false) {
            $this->initErrors[] = "Cannot write to log directory";
            $this->isWritable = false;
        } else {
            @unlink($testFile);
            $this->isWritable = true;
        }
    }
    
    private function createProtectiveFiles() {
        // Create .htaccess to protect log files
        $htaccess = $this->logDir . '/.htaccess';
        if (!file_exists($htaccess)) {
            $content = "Order deny,allow\nDeny from all\n\n# Allow internal access for log viewing\n<Files \"*.php\">\n    Order allow,deny\n    Allow from all\n</Files>";
            @file_put_contents($htaccess, $content);
        }
        
        // Create index.php to prevent directory listing
        $indexFile = $this->logDir . '/index.php';
        if (!file_exists($indexFile)) {
            @file_put_contents($indexFile, '<?php http_response_code(403); echo "Access denied";');
        }
        
        // Create a README
        $readmeFile = $this->logDir . '/README.txt';
        if (!file_exists($readmeFile)) {
            $content = "LOG FILES DIRECTORY\n==================\n\n";
            $content .= "error-YYYY-MM-DD.log - Errors and critical issues\n";
            $content .= "app-YYYY-MM-DD.log - General application logs\n";
            $content .= "api-YYYY-MM-DD.log - API request logs\n";
            $content .= "php-errors.log - Raw PHP error log\n\n";
            $content .= "Log Format: JSON (one entry per line)\n";
            $content .= "Rotation: Files rotate at 10MB\n";
            @file_put_contents($readmeFile, $content);
        }
    }

    private function registerErrorHandler() {
        // Custom error handler
        set_error_handler(function($severity, $message, $file, $line) {
            $level = self::WARNING;
            $severityName = 'UNKNOWN';
            
            switch ($severity) {
                case E_ERROR:
                case E_USER_ERROR:
                    $level = self::ERROR;
                    $severityName = 'E_ERROR';
                    break;
                case E_CORE_ERROR:
                case E_COMPILE_ERROR:
                    $level = self::CRITICAL;
                    $severityName = 'E_CORE_ERROR';
                    break;
                case E_WARNING:
                case E_USER_WARNING:
                case E_CORE_WARNING:
                case E_COMPILE_WARNING:
                    $level = self::WARNING;
                    $severityName = 'E_WARNING';
                    break;
                case E_NOTICE:
                case E_USER_NOTICE:
                    $level = self::INFO;
                    $severityName = 'E_NOTICE';
                    break;
                case E_DEPRECATED:
                case E_USER_DEPRECATED:
                    $level = self::DEBUG;
                    $severityName = 'E_DEPRECATED';
                    break;
                case E_PARSE:
                    $level = self::CRITICAL;
                    $severityName = 'E_PARSE';
                    break;
            }
            
            $this->log($level, "[PHP {$severityName}] {$message}", [
                'file' => $file,
                'line' => $line,
                'severity_code' => $severity,
                'severity_name' => $severityName,
                'backtrace' => $this->getCleanBacktrace()
            ]);
            
            return false; // Continue with PHP's internal handler
        });

        // Exception handler
        set_exception_handler(function($exception) {
            $this->log(self::CRITICAL, "Uncaught Exception: " . $exception->getMessage(), [
                'exception_class' => get_class($exception),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'code' => $exception->getCode(),
                'trace' => $exception->getTraceAsString(),
                'previous' => $exception->getPrevious() ? $exception->getPrevious()->getMessage() : null
            ]);
        });

        // Shutdown handler for fatal errors
        register_shutdown_function(function() {
            $error = error_get_last();
            if ($error && in_array($error['type'], [E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_PARSE])) {
                $this->log(self::CRITICAL, "FATAL ERROR: " . $error['message'], [
                    'file' => $error['file'],
                    'line' => $error['line'],
                    'type' => $error['type'],
                    'type_name' => $this->getErrorTypeName($error['type'])
                ]);
            }
        });
    }
    
    private function getErrorTypeName($type) {
        $types = [
            E_ERROR => 'E_ERROR',
            E_WARNING => 'E_WARNING',
            E_PARSE => 'E_PARSE',
            E_NOTICE => 'E_NOTICE',
            E_CORE_ERROR => 'E_CORE_ERROR',
            E_CORE_WARNING => 'E_CORE_WARNING',
            E_COMPILE_ERROR => 'E_COMPILE_ERROR',
            E_COMPILE_WARNING => 'E_COMPILE_WARNING',
            E_USER_ERROR => 'E_USER_ERROR',
            E_USER_WARNING => 'E_USER_WARNING',
            E_USER_NOTICE => 'E_USER_NOTICE',
            E_DEPRECATED => 'E_DEPRECATED',
            E_USER_DEPRECATED => 'E_USER_DEPRECATED',
        ];
        return $types[$type] ?? 'UNKNOWN';
    }
    
    private function getCleanBacktrace() {
        $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 10);
        $clean = [];
        foreach ($trace as $i => $frame) {
            if ($i < 2) continue; // Skip error handler frames
            $clean[] = [
                'file' => $frame['file'] ?? 'unknown',
                'line' => $frame['line'] ?? 0,
                'function' => $frame['function'] ?? 'unknown',
                'class' => $frame['class'] ?? null
            ];
        }
        return $clean;
    }

    /**
     * Direct write to log file - bypasses all checks for guaranteed writing
     */
    private function writeDirectLog($level, $message, $context = []) {
        $timestamp = date('Y-m-d H:i:s.') . substr(microtime(), 2, 3);
        $logEntry = json_encode([
            'timestamp' => $timestamp,
            'level' => $level,
            'message' => $message,
            'context' => $context
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
        
        $logFile = $this->logDir . '/app-' . date('Y-m-d') . '.log';
        @file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
    }

    public function log($level, $message, array $context = []) {
        $timestamp = date('Y-m-d H:i:s.') . substr(microtime(), 2, 3);
        $clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'cli';
        $requestUri = $_SERVER['REQUEST_URI'] ?? 'cli';
        $method = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
        $userAgent = substr($_SERVER['HTTP_USER_AGENT'] ?? 'unknown', 0, 200);

        $logEntry = [
            'timestamp' => $timestamp,
            'level' => $level,
            'message' => $message,
            'ip' => $clientIp,
            'method' => $method,
            'uri' => $requestUri,
            'user_agent' => $userAgent,
            'context' => $context,
            'memory_usage' => memory_get_usage(true),
            'peak_memory' => memory_get_peak_usage(true)
        ];

        $logLine = json_encode($logEntry, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n";
        
        // Determine log file based on level
        $logFile = $this->getLogFile($level);
        
        // Rotate if needed
        $this->rotateLogFile($logFile);
        
        // Write to file
        $result = @file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
        
        if ($result === false) {
            // Fallback to PHP error log
            error_log("[{$level}] {$message} " . json_encode($context));
            
            // Try to recreate the log directory
            $this->ensureLogDirectory();
            
            // One more attempt
            @file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
        }
        
        // For critical/error, also write to PHP error log for redundancy
        if (in_array($level, [self::ERROR, self::CRITICAL])) {
            error_log("[{$level}] {$message} - {$requestUri}");
        }
    }

    private function getLogFile($level) {
        $date = date('Y-m-d');
        
        switch ($level) {
            case self::ERROR:
            case self::CRITICAL:
                return $this->logDir . "/error-{$date}.log";
            case self::API:
                return $this->logDir . "/api-{$date}.log";
            default:
                return $this->logDir . "/app-{$date}.log";
        }
    }

    private function rotateLogFile($logFile) {
        if (!file_exists($logFile)) return;
        
        $size = @filesize($logFile);
        if ($size && $size > $this->maxFileSize) {
            $info = pathinfo($logFile);
            $rotatedName = $info['dirname'] . '/' . $info['filename'] . '-' . date('His') . '.' . ($info['extension'] ?? 'log');
            @rename($logFile, $rotatedName);
            $this->cleanupOldLogs();
        }
    }

    private function cleanupOldLogs() {
        $files = glob($this->logDir . '/*.log');
        if ($files && count($files) > $this->maxFiles * 3) {
            usort($files, function($a, $b) {
                return filemtime($a) - filemtime($b);
            });
            
            $toDelete = array_slice($files, 0, count($files) - $this->maxFiles * 2);
            foreach ($toDelete as $file) {
                @unlink($file);
            }
        }
    }

    // Convenience methods
    public function debug($message, array $context = []) {
        $this->log(self::DEBUG, $message, $context);
    }

    public function info($message, array $context = []) {
        $this->log(self::INFO, $message, $context);
    }

    public function warning($message, array $context = []) {
        $this->log(self::WARNING, $message, $context);
    }

    public function error($message, array $context = []) {
        $this->log(self::ERROR, $message, $context);
    }

    public function critical($message, array $context = []) {
        $this->log(self::CRITICAL, $message, $context);
    }
    
    public function api($message, array $context = []) {
        $this->log(self::API, $message, $context);
    }
    
    /**
     * Log an API request with full details
     */
    public function logApiRequest($endpoint, $method, $statusCode, $responseTime = null, $error = null) {
        $context = [
            'endpoint' => $endpoint,
            'method' => $method,
            'status_code' => $statusCode,
            'response_time_ms' => $responseTime,
            'request_size' => $_SERVER['CONTENT_LENGTH'] ?? 0,
            'query_string' => $_SERVER['QUERY_STRING'] ?? ''
        ];
        
        if ($error) {
            $context['error'] = $error;
            $this->log(self::ERROR, "API Error: {$endpoint}", $context);
        } else {
            $this->log(self::API, "API Request: {$endpoint}", $context);
        }
    }
    
    /**
     * Log a database error with query details
     */
    public function logDbError($error, $query = null, $params = []) {
        $this->log(self::ERROR, "Database Error: " . $error, [
            'query' => $query ? substr($query, 0, 500) : null,
            'params' => $params,
            'backtrace' => $this->getCleanBacktrace()
        ]);
    }

    public function getRecentLogs($type = 'all', $limit = 100, $search = null, $level = null) {
        $logs = [];
        $files = glob($this->logDir . '/*.log');
        
        if (!$files) return $logs;
        
        // Sort by modification time, newest first
        usort($files, function($a, $b) {
            return filemtime($b) - filemtime($a);
        });
        
        // Filter by type
        if ($type === 'error') {
            $files = array_filter($files, fn($f) => strpos(basename($f), 'error-') === 0);
        } elseif ($type === 'app') {
            $files = array_filter($files, fn($f) => strpos(basename($f), 'app-') === 0);
        } elseif ($type === 'api') {
            $files = array_filter($files, fn($f) => strpos(basename($f), 'api-') === 0);
        }
        
        foreach ($files as $file) {
            if (count($logs) >= $limit) break;
            
            $lines = @file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if (!$lines) continue;
            
            $lines = array_reverse($lines); // Newest first
            
            foreach ($lines as $line) {
                if (count($logs) >= $limit) break;
                
                $entry = json_decode($line, true);
                if (!$entry) continue;
                
                // Filter by level
                if ($level && $entry['level'] !== strtoupper($level)) continue;
                
                // Filter by search term
                if ($search) {
                    $searchLower = strtolower($search);
                    $haystack = strtolower($entry['message'] . ' ' . json_encode($entry['context']));
                    if (strpos($haystack, $searchLower) === false) continue;
                }
                
                $logs[] = $entry;
            }
        }
        
        return $logs;
    }

    public function clearLogs($type = 'all') {
        $files = glob($this->logDir . '/*.log');
        
        if (!$files) return true;
        
        foreach ($files as $file) {
            $basename = basename($file);
            if ($type === 'all') {
                @unlink($file);
            } elseif ($type === 'error' && strpos($basename, 'error-') === 0) {
                @unlink($file);
            } elseif ($type === 'app' && strpos($basename, 'app-') === 0) {
                @unlink($file);
            } elseif ($type === 'api' && strpos($basename, 'api-') === 0) {
                @unlink($file);
            }
        }
        
        return true;
    }

    public function getLogStats() {
        $stats = [
            'total_files' => 0,
            'total_size_bytes' => 0,
            'total_size_human' => '0 B',
            'error_count_today' => 0,
            'warning_count_today' => 0,
            'api_requests_today' => 0,
            'oldest_log' => null,
            'newest_log' => null,
            'writable' => $this->isWritable,
            'log_dir' => $this->logDir,
            'files' => []
        ];
        
        $files = glob($this->logDir . '/*.log');
        if (!$files) return $stats;
        
        $stats['total_files'] = count($files);
        
        foreach ($files as $file) {
            $size = filesize($file);
            $stats['total_size_bytes'] += $size;
            
            $mtime = filemtime($file);
            $stats['files'][] = [
                'name' => basename($file),
                'size' => $size,
                'modified' => date('Y-m-d H:i:s', $mtime)
            ];
            
            if (!$stats['oldest_log'] || $mtime < strtotime($stats['oldest_log'])) {
                $stats['oldest_log'] = date('Y-m-d H:i:s', $mtime);
            }
            if (!$stats['newest_log'] || $mtime > strtotime($stats['newest_log'])) {
                $stats['newest_log'] = date('Y-m-d H:i:s', $mtime);
            }
        }
        
        // Human readable size
        $bytes = $stats['total_size_bytes'];
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = 0;
        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }
        $stats['total_size_human'] = round($bytes, 2) . ' ' . $units[$i];
        
        // Count today's entries
        $today = date('Y-m-d');
        $todayErrorFile = $this->logDir . "/error-{$today}.log";
        $todayAppFile = $this->logDir . "/app-{$today}.log";
        $todayApiFile = $this->logDir . "/api-{$today}.log";
        
        if (file_exists($todayErrorFile)) {
            $lines = @file($todayErrorFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines) {
                foreach ($lines as $line) {
                    $entry = json_decode($line, true);
                    if ($entry) {
                        if (in_array($entry['level'], ['ERROR', 'CRITICAL'])) {
                            $stats['error_count_today']++;
                        }
                    }
                }
            }
        }
        
        if (file_exists($todayAppFile)) {
            $lines = @file($todayAppFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines) {
                foreach ($lines as $line) {
                    $entry = json_decode($line, true);
                    if ($entry && $entry['level'] === 'WARNING') {
                        $stats['warning_count_today']++;
                    }
                }
            }
        }
        
        if (file_exists($todayApiFile)) {
            $stats['api_requests_today'] = count(@file($todayApiFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []);
        }
        
        return $stats;
    }
    
    public function isAvailable(): bool {
        return $this->isWritable;
    }
    
    public function getInitErrors(): array {
        return $this->initErrors;
    }
}

// Global helper functions for easy access
function logError($message, array $context = []) {
    ErrorLogger::getInstance()->error($message, $context);
}

function logInfo($message, array $context = []) {
    ErrorLogger::getInstance()->info($message, $context);
}

function logDebug($message, array $context = []) {
    ErrorLogger::getInstance()->debug($message, $context);
}

function logWarning($message, array $context = []) {
    ErrorLogger::getInstance()->warning($message, $context);
}

function logCritical($message, array $context = []) {
    ErrorLogger::getInstance()->critical($message, $context);
}

function logApi($message, array $context = []) {
    ErrorLogger::getInstance()->api($message, $context);
}

function logDbError($error, $query = null, $params = []) {
    ErrorLogger::getInstance()->logDbError($error, $query, $params);
}

function logApiRequest($endpoint, $method, $statusCode, $responseTime = null, $error = null) {
    ErrorLogger::getInstance()->logApiRequest($endpoint, $method, $statusCode, $responseTime, $error);
}
