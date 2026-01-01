<?php
/**
 * Maintenance Cron Script
 * 
 * Handles automated cleanup and maintenance tasks:
 * - Delete expired temporary emails
 * - Clean up old received emails (48 hours by default)
 * - Remove orphaned attachments
 * - Reset rate limit counters
 * - Clean up expired sessions
 * - Update email statistics
 * 
 * Cron example (every hour):
 * 0 * * * * /usr/bin/php /path/to/php-backend/cron/maintenance.php
 */

require_once __DIR__ . '/../config.php';

set_time_limit(300);

// Configuration
$EMAIL_RETENTION_HOURS = 48;
$TEMP_EMAIL_CLEANUP_BATCH = 1000;
$ATTACHMENT_RETENTION_DAYS = 7;

// Log function
function logMessage(string $message, string $level = 'INFO'): void {
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[$timestamp] [$level] $message\n";
    
    $logFile = __DIR__ . '/../logs/maintenance.log';
    $logDir = dirname($logFile);
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    file_put_contents($logFile, $logEntry, FILE_APPEND);
    
    if (php_sapi_name() === 'cli') {
        echo $logEntry;
    }
}

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
} catch (PDOException $e) {
    logMessage("Database connection failed: " . $e->getMessage(), 'ERROR');
    exit(1);
}

logMessage("Starting maintenance tasks...");

$stats = [
    'expired_temp_emails' => 0,
    'old_emails_deleted' => 0,
    'attachments_cleaned' => 0,
    'rate_limits_cleared' => 0,
    'sessions_cleaned' => 0,
];

// ============================================
// 1. Delete expired temporary emails
// ============================================
logMessage("Task 1: Cleaning expired temporary emails...");

try {
    // First, get IDs of expired temp emails
    $stmt = $pdo->prepare("
        SELECT id FROM temp_emails 
        WHERE expires_at < NOW() OR is_active = 0
        LIMIT ?
    ");
    $stmt->execute([$TEMP_EMAIL_CLEANUP_BATCH]);
    $expiredEmails = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (!empty($expiredEmails)) {
        // Delete associated received emails first (due to foreign key)
        $placeholders = implode(',', array_fill(0, count($expiredEmails), '?'));
        
        // Get attachments to delete from filesystem
        $stmt = $pdo->prepare("
            SELECT ea.storage_path 
            FROM email_attachments ea
            JOIN received_emails re ON ea.received_email_id = re.id
            WHERE re.temp_email_id IN ($placeholders)
        ");
        $stmt->execute($expiredEmails);
        $attachmentPaths = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // Delete attachments from filesystem
        $storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : __DIR__ . '/../storage';
        foreach ($attachmentPaths as $path) {
            $fullPath = $storagePath . '/' . $path;
            if (file_exists($fullPath)) {
                unlink($fullPath);
                $stats['attachments_cleaned']++;
            }
        }
        
        // Delete email attachments from DB
        $stmt = $pdo->prepare("
            DELETE ea FROM email_attachments ea
            JOIN received_emails re ON ea.received_email_id = re.id
            WHERE re.temp_email_id IN ($placeholders)
        ");
        $stmt->execute($expiredEmails);
        
        // Delete received emails
        $stmt = $pdo->prepare("
            DELETE FROM received_emails WHERE temp_email_id IN ($placeholders)
        ");
        $stmt->execute($expiredEmails);
        $stats['old_emails_deleted'] += $stmt->rowCount();
        
        // Delete email forwarding rules
        $stmt = $pdo->prepare("
            DELETE FROM email_forwarding WHERE temp_email_id IN ($placeholders)
        ");
        $stmt->execute($expiredEmails);
        
        // Delete push subscriptions
        $stmt = $pdo->prepare("
            DELETE FROM push_subscriptions WHERE temp_email_id IN ($placeholders)
        ");
        $stmt->execute($expiredEmails);
        
        // Finally delete the temp emails
        $stmt = $pdo->prepare("
            DELETE FROM temp_emails WHERE id IN ($placeholders)
        ");
        $stmt->execute($expiredEmails);
        $stats['expired_temp_emails'] = $stmt->rowCount();
    }
    
    logMessage("Deleted {$stats['expired_temp_emails']} expired temp emails");
    
} catch (Exception $e) {
    logMessage("Error cleaning expired emails: " . $e->getMessage(), 'ERROR');
}

// ============================================
// 2. Delete old received emails (beyond retention)
// ============================================
logMessage("Task 2: Cleaning old received emails (>{$EMAIL_RETENTION_HOURS}h)...");

try {
    // Get attachments to delete
    $stmt = $pdo->prepare("
        SELECT ea.storage_path 
        FROM email_attachments ea
        JOIN received_emails re ON ea.received_email_id = re.id
        WHERE re.received_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
    ");
    $stmt->execute([$EMAIL_RETENTION_HOURS]);
    $attachmentPaths = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    // Delete attachments from filesystem
    $storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : __DIR__ . '/../storage';
    foreach ($attachmentPaths as $path) {
        $fullPath = $storagePath . '/' . $path;
        if (file_exists($fullPath)) {
            unlink($fullPath);
            $stats['attachments_cleaned']++;
        }
    }
    
    // Delete email attachments from DB
    $stmt = $pdo->prepare("
        DELETE ea FROM email_attachments ea
        JOIN received_emails re ON ea.received_email_id = re.id
        WHERE re.received_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
    ");
    $stmt->execute([$EMAIL_RETENTION_HOURS]);
    
    // Delete old received emails
    $stmt = $pdo->prepare("
        DELETE FROM received_emails 
        WHERE received_at < DATE_SUB(NOW(), INTERVAL ? HOUR)
    ");
    $stmt->execute([$EMAIL_RETENTION_HOURS]);
    $deleted = $stmt->rowCount();
    $stats['old_emails_deleted'] += $deleted;
    
    logMessage("Deleted $deleted old received emails");
    
} catch (Exception $e) {
    logMessage("Error cleaning old emails: " . $e->getMessage(), 'ERROR');
}

// ============================================
// 3. Clean up orphaned attachments
// ============================================
logMessage("Task 3: Cleaning orphaned attachments...");

try {
    $storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : __DIR__ . '/../storage';
    $attachmentDir = $storagePath . '/attachments';
    
    if (is_dir($attachmentDir)) {
        // Get all attachment paths from DB
        $stmt = $pdo->query("SELECT storage_path FROM email_attachments");
        $dbPaths = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $dbPathsSet = array_flip($dbPaths);
        
        // Scan filesystem for orphaned files older than retention period
        $cutoffTime = time() - ($ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60);
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($attachmentDir, RecursiveDirectoryIterator::SKIP_DOTS)
        );
        
        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getMTime() < $cutoffTime) {
                $relativePath = str_replace($storagePath . '/', '', $file->getPathname());
                
                if (!isset($dbPathsSet[$relativePath])) {
                    unlink($file->getPathname());
                    $stats['attachments_cleaned']++;
                }
            }
        }
    }
    
    logMessage("Cleaned {$stats['attachments_cleaned']} orphaned attachments");
    
} catch (Exception $e) {
    logMessage("Error cleaning attachments: " . $e->getMessage(), 'ERROR');
}

// ============================================
// 4. Reset rate limit counters
// ============================================
logMessage("Task 4: Clearing old rate limit records...");

try {
    // Delete rate limit records older than 1 hour
    $stmt = $pdo->query("
        DELETE FROM rate_limits 
        WHERE window_start < DATE_SUB(NOW(), INTERVAL 1 HOUR)
    ");
    $stats['rate_limits_cleared'] = $stmt->rowCount();
    
    logMessage("Cleared {$stats['rate_limits_cleared']} old rate limit records");
    
} catch (Exception $e) {
    logMessage("Error clearing rate limits: " . $e->getMessage(), 'ERROR');
}

// ============================================
// 5. Reset mailbox hourly/daily counters
// ============================================
logMessage("Task 5: Resetting mailbox counters...");

try {
    // Reset hourly counters (run every hour)
    $stmt = $pdo->query("
        UPDATE mailboxes 
        SET emails_sent_this_hour = 0, last_hour_reset = NOW()
        WHERE last_hour_reset IS NULL OR last_hour_reset < DATE_SUB(NOW(), INTERVAL 1 HOUR)
    ");
    $hourlyReset = $stmt->rowCount();
    
    // Reset daily counters (run at midnight)
    $currentHour = (int)date('H');
    if ($currentHour === 0) {
        $stmt = $pdo->query("
            UPDATE mailboxes 
            SET emails_sent_today = 0, last_day_reset = NOW()
            WHERE last_day_reset IS NULL OR last_day_reset < DATE_SUB(NOW(), INTERVAL 1 DAY)
        ");
        $dailyReset = $stmt->rowCount();
        logMessage("Reset $dailyReset mailbox daily counters");
    }
    
    logMessage("Reset $hourlyReset mailbox hourly counters");
    
} catch (Exception $e) {
    logMessage("Error resetting mailbox counters: " . $e->getMessage(), 'ERROR');
}

// ============================================
// 6. Update email statistics
// ============================================
logMessage("Task 6: Updating email statistics...");

try {
    // Count total temp emails ever created
    $stmt = $pdo->query("SELECT COUNT(*) FROM temp_emails");
    $totalEmails = $stmt->fetchColumn();
    
    // Count total received emails
    $stmt = $pdo->query("SELECT COUNT(*) FROM received_emails");
    $totalReceived = $stmt->fetchColumn();
    
    // Count active users
    $stmt = $pdo->query("SELECT COUNT(*) FROM profiles");
    $totalUsers = $stmt->fetchColumn();
    
    // Update stats
    $stmt = $pdo->prepare("
        INSERT INTO email_stats (stat_key, stat_value, updated_at) 
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE stat_value = VALUES(stat_value), updated_at = NOW()
    ");
    
    $stmt->execute(['total_emails_generated', $totalEmails]);
    $stmt->execute(['total_emails_received', $totalReceived]);
    $stmt->execute(['total_users', $totalUsers]);
    
    logMessage("Updated email statistics");
    
} catch (Exception $e) {
    logMessage("Error updating statistics: " . $e->getMessage(), 'ERROR');
}

// ============================================
// 7. Clean expired backup records
// ============================================
logMessage("Task 7: Cleaning expired backups...");

try {
    $stmt = $pdo->query("
        DELETE FROM backup_history 
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
    ");
    $deleted = $stmt->rowCount();
    
    logMessage("Deleted $deleted expired backup records");
    
} catch (Exception $e) {
    logMessage("Error cleaning backups: " . $e->getMessage(), 'ERROR');
}

// ============================================
// 8. Clean expired IP blocks
// ============================================
logMessage("Task 8: Cleaning expired IP blocks...");

try {
    $stmt = $pdo->query("
        UPDATE blocked_ips 
        SET is_active = 0 
        WHERE expires_at IS NOT NULL AND expires_at < NOW() AND is_active = 1
    ");
    $expired = $stmt->rowCount();
    
    logMessage("Expired $expired IP blocks");
    
} catch (Exception $e) {
    logMessage("Error cleaning IP blocks: " . $e->getMessage(), 'ERROR');
}

// ============================================
// Summary
// ============================================
$totalTasks = array_sum($stats);
logMessage("Maintenance complete. Summary:");
logMessage("  - Expired temp emails: {$stats['expired_temp_emails']}");
logMessage("  - Old emails deleted: {$stats['old_emails_deleted']}");
logMessage("  - Attachments cleaned: {$stats['attachments_cleaned']}");
logMessage("  - Rate limits cleared: {$stats['rate_limits_cleared']}");
logMessage("  - Total items processed: $totalTasks");
logMessage("Maintenance finished successfully.");
