<?php
/**
 * Comprehensive Error Logging System
 * Logs all errors, warnings, and debug info to files
 * Compatible with PHP 8.0+
 */

class ErrorLogger {
    private static $instance = null;
    private $logDir;
    private $maxFileSize = 10485760; // 10MB
    private $maxFiles = 5;
    private $isWritable = true;

    public const DEBUG = 'DEBUG';
    public const INFO = 'INFO';
    public const WARNING = 'WARNING';
    public const ERROR = 'ERROR';
    public const CRITICAL = 'CRITICAL';

    private function __construct($logDir) {
        $this->logDir = $logDir;
        $this->ensureLogDirectory();
        $this->registerErrorHandler();
    }

    public static function getInstance($logDir = null) {
        if (self::$instance === null) {
            self::$instance = new self($logDir ?? __DIR__ . '/logs');
        }
        return self::$instance;
    }

    private function ensureLogDirectory() {
        if (!is_dir($this->logDir)) {
            if (!@mkdir($this->logDir, 0755, true)) {
                $this->isWritable = false;
                error_log("ErrorLogger: Cannot create log directory: {$this->logDir}");
                return;
            }
        }
        
        if (!is_writable($this->logDir)) {
            $this->isWritable = false;
            error_log("ErrorLogger: Log directory not writable: {$this->logDir}");
            return;
        }
        
        // Create .htaccess to protect log files
        $htaccess = $this->logDir . '/.htaccess';
        if (!file_exists($htaccess)) {
            @file_put_contents($htaccess, "Order deny,allow\nDeny from all\n");
        }
        
        // Create index.php to prevent directory listing
        $indexFile = $this->logDir . '/index.php';
        if (!file_exists($indexFile)) {
            @file_put_contents($indexFile, '<?php // Silence is golden');
        }
    }

    private function registerErrorHandler() {
        set_error_handler(function($severity, $message, $file, $line) {
            // Map PHP error severity to log level
            $level = self::WARNING;
            switch ($severity) {
                case E_ERROR:
                case E_USER_ERROR:
                case E_CORE_ERROR:
                case E_COMPILE_ERROR:
                    $level = self::ERROR;
                    break;
                case E_WARNING:
                case E_USER_WARNING:
                case E_CORE_WARNING:
                case E_COMPILE_WARNING:
                    $level = self::WARNING;
                    break;
                case E_NOTICE:
                case E_USER_NOTICE:
                    $level = self::INFO;
                    break;
                case E_DEPRECATED:
                case E_USER_DEPRECATED:
                    $level = self::DEBUG;
                    break;
            }
            
            $this->log($level, $message, ['file' => $file, 'line' => $line]);
            return false; // Continue with PHP's internal handler
        });

        set_exception_handler(function($exception) {
            $this->log(self::CRITICAL, $exception->getMessage(), [
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'trace' => $exception->getTraceAsString()
            ]);
        });

        register_shutdown_function(function() {
            $error = error_get_last();
            if ($error && in_array($error['type'], [E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_PARSE])) {
                $this->log(self::CRITICAL, $error['message'], [
                    'file' => $error['file'],
                    'line' => $error['line'],
                    'type' => $error['type']
                ]);
            }
        });
    }

    public function log($level, $message, array $context = []) {
        // If logs directory isn't writable, fall back to error_log
        if (!$this->isWritable) {
            error_log("[{$level}] {$message} " . json_encode($context));
            return;
        }
        
        $timestamp = date('Y-m-d H:i:s');
        $clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $requestUri = $_SERVER['REQUEST_URI'] ?? 'cli';
        $method = $_SERVER['REQUEST_METHOD'] ?? 'CLI';

        $logEntry = [
            'timestamp' => $timestamp,
            'level' => $level,
            'message' => $message,
            'ip' => $clientIp,
            'method' => $method,
            'uri' => $requestUri,
            'context' => $context
        ];

        $logLine = json_encode($logEntry, JSON_UNESCAPED_SLASHES) . "\n";
        
        $logFile = $this->getLogFile($level);
        $this->rotateLogFile($logFile);
        
        @file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
    }

    private function getLogFile($level) {
        $date = date('Y-m-d');
        
        // Critical and error go to error.log, others to app.log
        if (in_array($level, [self::ERROR, self::CRITICAL])) {
            return $this->logDir . "/error-{$date}.log";
        }
        return $this->logDir . "/app-{$date}.log";
    }

    private function rotateLogFile($logFile) {
        if (file_exists($logFile) && filesize($logFile) > $this->maxFileSize) {
            $info = pathinfo($logFile);
            $rotatedName = $info['dirname'] . '/' . $info['filename'] . '-' . date('His') . '.' . ($info['extension'] ?? 'log');
            @rename($logFile, $rotatedName);
            
            // Clean up old files
            $this->cleanupOldLogs();
        }
    }

    private function cleanupOldLogs() {
        $files = glob($this->logDir . '/*.log');
        if ($files && count($files) > $this->maxFiles * 2) {
            usort($files, function($a, $b) {
                return filemtime($a) - filemtime($b);
            });
            
            $toDelete = array_slice($files, 0, count($files) - $this->maxFiles);
            foreach ($toDelete as $file) {
                @unlink($file);
            }
        }
    }

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
            $files = array_filter($files, fn($f) => strpos($f, 'error-') !== false);
        } elseif ($type === 'app') {
            $files = array_filter($files, fn($f) => strpos($f, 'app-') !== false);
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
            if ($type === 'all') {
                @unlink($file);
            } elseif ($type === 'error' && strpos($file, 'error-') !== false) {
                @unlink($file);
            } elseif ($type === 'app' && strpos($file, 'app-') !== false) {
                @unlink($file);
            }
        }
        
        return true;
    }

    public function getLogStats() {
        $stats = [
            'total_files' => 0,
            'total_size_bytes' => 0,
            'error_count_today' => 0,
            'warning_count_today' => 0,
            'oldest_log' => null,
            'newest_log' => null,
            'writable' => $this->isWritable,
        ];
        
        $files = glob($this->logDir . '/*.log');
        if (!$files) return $stats;
        
        $stats['total_files'] = count($files);
        
        foreach ($files as $file) {
            $stats['total_size_bytes'] += filesize($file);
            
            $mtime = filemtime($file);
            if (!$stats['oldest_log'] || $mtime < strtotime($stats['oldest_log'])) {
                $stats['oldest_log'] = date('Y-m-d H:i:s', $mtime);
            }
            if (!$stats['newest_log'] || $mtime > strtotime($stats['newest_log'])) {
                $stats['newest_log'] = date('Y-m-d H:i:s', $mtime);
            }
        }
        
        // Count today's errors
        $todayErrorFile = $this->logDir . '/error-' . date('Y-m-d') . '.log';
        if (file_exists($todayErrorFile)) {
            $lines = @file($todayErrorFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines) {
                foreach ($lines as $line) {
                    $entry = json_decode($line, true);
                    if ($entry) {
                        if ($entry['level'] === 'ERROR' || $entry['level'] === 'CRITICAL') {
                            $stats['error_count_today']++;
                        }
                        if ($entry['level'] === 'WARNING') {
                            $stats['warning_count_today']++;
                        }
                    }
                }
            }
        }
        
        return $stats;
    }
    
    /**
     * Check if logging is available
     */
    public function isAvailable(): bool {
        return $this->isWritable;
    }
}

// Global helper functions
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
