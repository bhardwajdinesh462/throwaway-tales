<?php
/**
 * Session Cleanup Cron Job
 * Removes expired user sessions
 * 
 * Run hourly: 0 * * * * php /path/to/api/cron/sessions.php
 */

if (php_sapi_name() !== 'cli') {
    die('This script must be run from command line');
}

require_once dirname(__DIR__) . '/core/database.php';

echo "[" . date('Y-m-d H:i:s') . "] Cleaning expired sessions...\n";

try {
    $result = Database::query(
        "DELETE FROM sessions WHERE expires_at < NOW()"
    );
    
    $count = $result->rowCount();
    echo "Deleted " . $count . " expired sessions\n";
    
} catch (Exception $e) {
    error_log("Session cleanup error: " . $e->getMessage());
    echo "Error: " . $e->getMessage() . "\n";
}

echo "[" . date('Y-m-d H:i:s') . "] Session cleanup completed\n";
