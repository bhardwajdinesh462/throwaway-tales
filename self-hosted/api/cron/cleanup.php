<?php
/**
 * Cleanup Cron Job
 * Removes expired emails and temporary data
 * 
 * Run daily: 0 3 * * * php /path/to/api/cron/cleanup.php
 */

if (php_sapi_name() !== 'cli') {
    die('This script must be run from command line');
}

require_once dirname(__DIR__) . '/core/database.php';

$startTime = microtime(true);

echo "[" . date('Y-m-d H:i:s') . "] Starting cleanup...\n";

try {
    $config = Database::getConfig();
    $uploadPath = $config['uploads']['path'] ?? dirname(__DIR__, 2) . '/uploads';
    
    // 1. Deactivate expired temp emails
    $expired = Database::query(
        "UPDATE temp_emails SET is_active = 0 WHERE expires_at < NOW() AND is_active = 1"
    );
    echo "Deactivated " . $expired->rowCount() . " expired temp emails\n";
    
    // 2. Delete old received emails (keep for 7 days after temp email expires)
    $oldEmails = Database::fetchAll(
        "SELECT re.id FROM received_emails re
         JOIN temp_emails te ON te.id = re.temp_email_id
         WHERE te.expires_at < DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );
    
    $deletedEmails = 0;
    foreach ($oldEmails as $email) {
        // Delete attachments first
        $attachments = Database::fetchAll(
            "SELECT * FROM email_attachments WHERE email_id = ?",
            [$email['id']]
        );
        
        foreach ($attachments as $att) {
            $filePath = $uploadPath . '/' . $att['storage_path'];
            if (file_exists($filePath)) {
                unlink($filePath);
            }
        }
        
        Database::delete('email_attachments', 'email_id = ?', [$email['id']]);
        Database::delete('received_emails', 'id = ?', [$email['id']]);
        $deletedEmails++;
    }
    echo "Deleted " . $deletedEmails . " old emails\n";
    
    // 3. Delete very old temp emails (30 days after expiry)
    $oldTempEmails = Database::query(
        "DELETE FROM temp_emails WHERE expires_at < DATE_SUB(NOW(), INTERVAL 30 DAY)"
    );
    echo "Deleted " . $oldTempEmails->rowCount() . " old temp emails\n";
    
    // 4. Clean up orphaned attachments
    $orphanedFiles = Database::fetchAll(
        "SELECT * FROM file_uploads 
         WHERE expires_at IS NOT NULL AND expires_at < NOW()"
    );
    
    $deletedFiles = 0;
    foreach ($orphanedFiles as $file) {
        $filePath = $uploadPath . '/' . $file['storage_path'];
        if (file_exists($filePath)) {
            unlink($filePath);
        }
        Database::delete('file_uploads', 'id = ?', [$file['id']]);
        $deletedFiles++;
    }
    echo "Deleted " . $deletedFiles . " orphaned files\n";
    
    // 5. Clean up old rate limit entries
    $rateLimits = Database::query(
        "DELETE FROM rate_limits WHERE expires_at < NOW()"
    );
    echo "Cleaned " . $rateLimits->rowCount() . " rate limit entries\n";
    
    // 6. Clean up old password reset tokens
    $passwordResets = Database::query(
        "DELETE FROM password_resets WHERE expires_at < NOW()"
    );
    echo "Cleaned " . $passwordResets->rowCount() . " password reset tokens\n";
    
    // 7. Clean up old email verifications
    $verifications = Database::query(
        "DELETE FROM email_verifications 
         WHERE expires_at < NOW() AND verified_at IS NULL"
    );
    echo "Cleaned " . $verifications->rowCount() . " email verifications\n";
    
    // 8. Clean up empty directories in uploads
    cleanEmptyDirectories($uploadPath . '/attachments');
    
} catch (Exception $e) {
    error_log("Cleanup error: " . $e->getMessage());
    echo "Error: " . $e->getMessage() . "\n";
}

$duration = round(microtime(true) - $startTime, 2);
echo "[" . date('Y-m-d H:i:s') . "] Cleanup completed in {$duration}s\n";

/**
 * Recursively clean empty directories
 */
function cleanEmptyDirectories(string $path): bool {
    if (!is_dir($path)) {
        return false;
    }
    
    $empty = true;
    $items = scandir($path);
    
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        
        $itemPath = $path . '/' . $item;
        
        if (is_dir($itemPath)) {
            if (!cleanEmptyDirectories($itemPath)) {
                $empty = false;
            }
        } else {
            $empty = false;
        }
    }
    
    if ($empty && $path !== dirname(__DIR__, 2) . '/uploads') {
        rmdir($path);
        return true;
    }
    
    return $empty;
}
