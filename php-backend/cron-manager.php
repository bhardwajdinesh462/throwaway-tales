<?php
/**
 * Cron Job Manager - Interactive PHP page for managing scheduled tasks
 * Displays job status, allows manual runs, and shows execution logs
 */

// Security check - require config
if (!file_exists(__DIR__ . '/config.php')) {
    die('Configuration not found. Run install.php first.');
}

require_once __DIR__ . '/config.php';
session_start();

// Check for .install_lock 
if (!file_exists(__DIR__ . '/.install_lock')) {
    die('Please complete installation first by running install.php');
}

// Simple JWT verification for admin access
function verifyAdminAccess($pdo) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $token = null;
    
    if (preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
        $token = $matches[1];
    } elseif (isset($_COOKIE['auth_token'])) {
        $token = $_COOKIE['auth_token'];
    } elseif (isset($_GET['token'])) {
        $token = $_GET['token'];
    }
    
    if (!$token) return false;
    
    try {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return false;
        
        $payload = json_decode(base64_decode($parts[1]), true);
        if (!$payload || !isset($payload['user_id'])) return false;
        
        $userId = $payload['user_id'];
        
        // Check if user is admin
        $stmt = $pdo->prepare('SELECT role FROM user_roles WHERE user_id = ?');
        $stmt->execute([$userId]);
        $role = $stmt->fetchColumn();
        
        return $role === 'admin' || $role === 'moderator';
    } catch (Exception $e) {
        return false;
    }
}

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    die('Database connection failed');
}

// Handle API requests
if (isset($_GET['action'])) {
    header('Content-Type: application/json');
    
    // Check admin access for all actions
    if (!verifyAdminAccess($pdo)) {
        http_response_code(401);
        echo json_encode(['error' => 'Admin access required']);
        exit;
    }
    
    switch ($_GET['action']) {
        case 'status':
            echo json_encode(getCronStatus($pdo));
            break;
            
        case 'run':
            $jobId = $_GET['job'] ?? '';
            echo json_encode(runCronJob($jobId, $pdo));
            break;
            
        case 'toggle':
            $jobId = $_GET['job'] ?? '';
            $enabled = ($_GET['enabled'] ?? 'true') === 'true';
            echo json_encode(toggleCronJob($jobId, $enabled, $pdo));
            break;
            
        case 'logs':
            $jobId = $_GET['job'] ?? '';
            echo json_encode(getCronLogs($jobId, $pdo));
            break;
            
        default:
            echo json_encode(['error' => 'Unknown action']);
    }
    exit;
}

function getCronStatus($pdo) {
    $jobs = [
        [
            'id' => 'clean-emails',
            'name' => 'Clean Expired Emails',
            'description' => 'Delete temporary emails that have passed their expiration time',
            'schedule' => '0 * * * *',
            'schedule_human' => 'Every hour',
            'script' => 'cron/maintenance.php',
            'last_run' => null,
            'next_run' => null,
            'status' => 'active',
            'last_result' => null,
            'last_duration' => null,
            'items_processed' => null
        ],
        [
            'id' => 'imap-poll',
            'name' => 'IMAP Email Polling',
            'description' => 'Check mailboxes for new incoming emails via IMAP',
            'schedule' => '*/1 * * * *',
            'schedule_human' => 'Every minute',
            'script' => 'cron/imap-poll.php',
            'last_run' => null,
            'next_run' => null,
            'status' => 'active',
            'last_result' => null,
            'last_duration' => null,
            'items_processed' => null
        ],
        [
            'id' => 'cleanup-backups',
            'name' => 'Cleanup Old Backups',
            'description' => 'Remove expired backup records from the database',
            'schedule' => '0 0 * * *',
            'schedule_human' => 'Daily at midnight',
            'script' => 'cron/maintenance.php --backups',
            'last_run' => null,
            'next_run' => null,
            'status' => 'active',
            'last_result' => null,
            'last_duration' => null,
            'items_processed' => null
        ],
        [
            'id' => 'reset-counters',
            'name' => 'Reset Hourly Counters',
            'description' => 'Reset mailbox hourly send counters',
            'schedule' => '0 * * * *',
            'schedule_human' => 'Every hour',
            'script' => 'cron/maintenance.php --counters',
            'last_run' => null,
            'next_run' => null,
            'status' => 'active',
            'last_result' => null,
            'last_duration' => null,
            'items_processed' => null
        ]
    ];
    
    // Get stored job data from app_settings
    $stmt = $pdo->prepare('SELECT `key`, value FROM app_settings WHERE `key` LIKE ?');
    $stmt->execute(['cron_%']);
    $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $cronData = [];
    foreach ($settings as $setting) {
        $cronData[$setting['key']] = json_decode($setting['value'], true);
    }
    
    // Update jobs with stored data
    foreach ($jobs as &$job) {
        $key = 'cron_' . str_replace('-', '_', $job['id']);
        if (isset($cronData[$key])) {
            $data = $cronData[$key];
            $job['last_run'] = $data['last_run'] ?? null;
            $job['last_result'] = $data['last_result'] ?? null;
            $job['last_duration'] = $data['last_duration'] ?? null;
            $job['items_processed'] = $data['items_processed'] ?? null;
            $job['status'] = ($data['enabled'] ?? true) ? 'active' : 'paused';
        }
    }
    
    // Get system info
    $systemInfo = [
        'php_version' => phpversion(),
        'imap_extension' => extension_loaded('imap'),
        'zip_extension' => extension_loaded('zip'),
        'pdo_mysql' => extension_loaded('pdo_mysql'),
        'max_execution_time' => ini_get('max_execution_time'),
        'memory_limit' => ini_get('memory_limit')
    ];
    
    return [
        'jobs' => $jobs,
        'system' => $systemInfo,
        'timestamp' => date('Y-m-d H:i:s')
    ];
}

function runCronJob($jobId, $pdo) {
    $startTime = microtime(true);
    $result = ['success' => false, 'message' => '', 'items_processed' => 0];
    
    switch ($jobId) {
        case 'clean-emails':
            // Delete expired temp emails
            $stmt = $pdo->prepare('
                DELETE re FROM received_emails re 
                JOIN temp_emails te ON te.id = re.temp_email_id 
                WHERE te.expires_at < NOW()
            ');
            $stmt->execute();
            $deletedEmails = $stmt->rowCount();
            
            $stmt = $pdo->prepare('DELETE FROM temp_emails WHERE expires_at < NOW()');
            $stmt->execute();
            $deletedTempEmails = $stmt->rowCount();
            
            $result = [
                'success' => true, 
                'message' => "Deleted $deletedTempEmails expired temp emails and $deletedEmails received emails",
                'items_processed' => $deletedTempEmails + $deletedEmails
            ];
            break;
            
        case 'imap-poll':
            // Get active mailboxes with IMAP configured
            $stmt = $pdo->query("
                SELECT id, name, imap_host, imap_port, imap_user, imap_password, receiving_email, auto_delete_after_store
                FROM mailboxes 
                WHERE is_active = 1 
                AND imap_host IS NOT NULL AND imap_host != ''
                AND imap_user IS NOT NULL AND imap_user != ''
            ");
            $mailboxes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (empty($mailboxes)) {
                $result = ['success' => true, 'message' => 'No active IMAP mailboxes configured', 'items_processed' => 0];
                break;
            }
            
            $totalProcessed = 0;
            $errors = [];
            
            foreach ($mailboxes as $mailbox) {
                if (!function_exists('imap_open')) {
                    $errors[] = "IMAP extension not installed";
                    continue;
                }
                
                $imapHost = $mailbox['imap_host'];
                $imapPort = $mailbox['imap_port'] ?? 993;
                $connectionString = "{" . $imapHost . ":" . $imapPort . "/imap/ssl/novalidate-cert}INBOX";
                
                $imap = @imap_open($connectionString, $mailbox['imap_user'], $mailbox['imap_password']);
                
                if (!$imap) {
                    $error = imap_last_error();
                    $errors[] = "{$mailbox['name']}: $error";
                    
                    // Update mailbox with error
                    $stmt = $pdo->prepare("UPDATE mailboxes SET last_error = ?, last_error_at = NOW() WHERE id = ?");
                    $stmt->execute([$error, $mailbox['id']]);
                    continue;
                }
                
                $emails = imap_search($imap, 'UNSEEN');
                
                if ($emails) {
                    foreach ($emails as $emailNum) {
                        $header = imap_headerinfo($imap, $emailNum);
                        $structure = imap_fetchstructure($imap, $emailNum);
                        
                        $fromAddress = isset($header->from[0]) 
                            ? ($header->from[0]->mailbox . '@' . $header->from[0]->host)
                            : 'unknown@unknown.com';
                        
                        $toAddress = isset($header->to[0])
                            ? ($header->to[0]->mailbox . '@' . $header->to[0]->host)
                            : null;
                        
                        if (!$toAddress) continue;
                        
                        $subject = isset($header->subject) 
                            ? @iconv_mime_decode($header->subject, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8')
                            : '(No Subject)';
                        
                        // Get body
                        $body = '';
                        $htmlBody = '';
                        
                        if (isset($structure->parts)) {
                            foreach ($structure->parts as $partNum => $part) {
                                $partContent = imap_fetchbody($imap, $emailNum, $partNum + 1);
                                if (isset($part->encoding)) {
                                    if ($part->encoding == 3) $partContent = base64_decode($partContent);
                                    elseif ($part->encoding == 4) $partContent = quoted_printable_decode($partContent);
                                }
                                if (isset($part->subtype) && $part->subtype == 'PLAIN') $body = $partContent;
                                elseif (isset($part->subtype) && $part->subtype == 'HTML') $htmlBody = $partContent;
                            }
                        } else {
                            $body = imap_body($imap, $emailNum);
                        }
                        
                        // Find matching temp email
                        $stmt = $pdo->prepare("SELECT id FROM temp_emails WHERE address = ? AND is_active = 1 AND expires_at > NOW()");
                        $stmt->execute([strtolower($toAddress)]);
                        $tempEmail = $stmt->fetch();
                        
                        if ($tempEmail) {
                            $stmt = $pdo->prepare("
                                INSERT INTO received_emails (id, temp_email_id, from_address, subject, body, html_body, received_at)
                                VALUES (UUID(), ?, ?, ?, ?, ?, NOW())
                            ");
                            $stmt->execute([$tempEmail['id'], $fromAddress, $subject, $body, $htmlBody]);
                            $totalProcessed++;
                            
                            if ($mailbox['auto_delete_after_store']) {
                                imap_delete($imap, $emailNum);
                            } else {
                                imap_setflag_full($imap, $emailNum, "\\Seen");
                            }
                        }
                    }
                    
                    if ($mailbox['auto_delete_after_store']) {
                        imap_expunge($imap);
                    }
                }
                
                // Update mailbox polling timestamp
                $stmt = $pdo->prepare("UPDATE mailboxes SET last_polled_at = NOW(), last_error = NULL WHERE id = ?");
                $stmt->execute([$mailbox['id']]);
                
                imap_close($imap);
            }
            
            $result = [
                'success' => empty($errors),
                'message' => $totalProcessed > 0 
                    ? "Fetched $totalProcessed new email(s)" 
                    : "No new emails" . (empty($errors) ? "" : " (Errors: " . implode(', ', $errors) . ")"),
                'items_processed' => $totalProcessed
            ];
            break;
            
        case 'cleanup-backups':
            // Delete expired backup records
            $stmt = $pdo->prepare('DELETE FROM backup_history WHERE expires_at < NOW()');
            $stmt->execute();
            $deleted = $stmt->rowCount();
            
            $result = [
                'success' => true, 
                'message' => "Deleted $deleted expired backup records",
                'items_processed' => $deleted
            ];
            break;
            
        case 'reset-counters':
            // Reset hourly counters
            $stmt = $pdo->prepare('UPDATE mailboxes SET emails_sent_this_hour = 0, last_hour_reset = NOW()');
            $stmt->execute();
            $updated = $stmt->rowCount();
            
            $result = [
                'success' => true, 
                'message' => "Reset hourly counters for $updated mailboxes",
                'items_processed' => $updated
            ];
            break;
            
        default:
            return ['error' => 'Unknown cron job: ' . $jobId];
    }
    
    $duration = round((microtime(true) - $startTime) * 1000);
    
    // Store execution result
    $key = 'cron_' . str_replace('-', '_', $jobId);
    $value = json_encode([
        'last_run' => date('Y-m-d H:i:s'),
        'last_result' => $result['success'] ? 'success' : 'failed',
        'last_duration' => $duration,
        'items_processed' => $result['items_processed'],
        'enabled' => true
    ]);
    
    $stmt = $pdo->prepare("
        INSERT INTO app_settings (id, `key`, value, updated_at)
        VALUES (UUID(), ?, ?, NOW())
        ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()
    ");
    $stmt->execute([$key, $value, $value]);
    
    // Log to cron_logs table if it exists
    try {
        $stmt = $pdo->prepare("
            INSERT INTO cron_logs (id, job_id, status, message, duration_ms, items_processed, created_at)
            VALUES (UUID(), ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $jobId,
            $result['success'] ? 'success' : 'failed',
            $result['message'],
            $duration,
            $result['items_processed']
        ]);
    } catch (PDOException $e) {
        // Table might not exist, ignore
    }
    
    $result['duration_ms'] = $duration;
    return $result;
}

function toggleCronJob($jobId, $enabled, $pdo) {
    $key = 'cron_' . str_replace('-', '_', $jobId);
    
    // Get existing settings
    $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE `key` = ?');
    $stmt->execute([$key]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $value = $existing ? json_decode($existing['value'], true) : [];
    $value['enabled'] = $enabled;
    $valueJson = json_encode($value);
    
    $stmt = $pdo->prepare("
        INSERT INTO app_settings (id, `key`, value, updated_at)
        VALUES (UUID(), ?, ?, NOW())
        ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()
    ");
    $stmt->execute([$key, $valueJson, $valueJson]);
    
    return ['success' => true, 'enabled' => $enabled];
}

function getCronLogs($jobId, $pdo) {
    try {
        $stmt = $pdo->prepare("
            SELECT * FROM cron_logs 
            WHERE job_id = ? 
            ORDER BY created_at DESC 
            LIMIT 50
        ");
        $stmt->execute([$jobId]);
        return ['logs' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    } catch (PDOException $e) {
        // Table might not exist
        return ['logs' => [], 'error' => 'Cron logs table not available'];
    }
}

// For web access, just redirect to admin panel
header('Location: /admin/cron');
exit;
