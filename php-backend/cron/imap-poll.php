<?php
/**
 * IMAP Email Polling Script
 * 
 * This script polls IMAP servers for new emails and stores them in the database.
 * Run this via cron job every 1-5 minutes for near real-time email reception.
 * 
 * Cron example (every 2 minutes):
 * /2 * * * * /usr/bin/php /path/to/php-backend/cron/imap-poll.php
 */

require_once __DIR__ . '/../config.php';

// Set longer execution time for IMAP operations
set_time_limit(120);

// Log function
function logMessage(string $message, string $level = 'INFO'): void {
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[$timestamp] [$level] $message\n";
    
    // Log to file
    $logFile = __DIR__ . '/../logs/imap-poll.log';
    $logDir = dirname($logFile);
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    file_put_contents($logFile, $logEntry, FILE_APPEND);
    
    // Also output to console if running interactively
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

logMessage("Starting IMAP poll...");

// Get active mailboxes with IMAP configured
$stmt = $pdo->query("
    SELECT id, name, imap_host, imap_port, imap_user, imap_password, receiving_email, auto_delete_after_store
    FROM mailboxes 
    WHERE is_active = 1 
    AND imap_host IS NOT NULL 
    AND imap_host != ''
    AND imap_user IS NOT NULL 
    AND imap_user != ''
    ORDER BY priority ASC
");
$mailboxes = $stmt->fetchAll();

if (empty($mailboxes)) {
    logMessage("No active IMAP mailboxes found");
    exit(0);
}

logMessage("Found " . count($mailboxes) . " active mailbox(es)");

$totalProcessed = 0;

foreach ($mailboxes as $mailbox) {
    logMessage("Processing mailbox: " . $mailbox['name']);
    
    try {
        // Connect to IMAP server
        $imapHost = $mailbox['imap_host'];
        $imapPort = $mailbox['imap_port'] ?? 993;
        $imapUser = $mailbox['imap_user'];
        $imapPassword = $mailbox['imap_password'];
        
        // Build IMAP connection string
        $connectionString = "{" . $imapHost . ":" . $imapPort . "/imap/ssl/novalidate-cert}INBOX";
        
        // Connect to IMAP
        $imap = @imap_open($connectionString, $imapUser, $imapPassword);
        
        if (!$imap) {
            $error = imap_last_error();
            logMessage("Failed to connect to IMAP for {$mailbox['name']}: $error", 'ERROR');
            
            // Update mailbox with error
            $stmt = $pdo->prepare("
                UPDATE mailboxes 
                SET last_error = ?, last_error_at = NOW() 
                WHERE id = ?
            ");
            $stmt->execute([$error, $mailbox['id']]);
            continue;
        }
        
        logMessage("Connected to IMAP: " . $mailbox['name']);
        
        // Get unread messages
        $emails = imap_search($imap, 'UNSEEN');
        
        if ($emails === false) {
            logMessage("No new emails in {$mailbox['name']}");
            
            // Update last polled time
            $stmt = $pdo->prepare("UPDATE mailboxes SET last_polled_at = NOW(), last_error = NULL WHERE id = ?");
            $stmt->execute([$mailbox['id']]);
            
            imap_close($imap);
            continue;
        }
        
        logMessage("Found " . count($emails) . " new email(s) in {$mailbox['name']}");
        
        foreach ($emails as $emailNum) {
            try {
                // Get email headers
                $header = imap_headerinfo($imap, $emailNum);
                $structure = imap_fetchstructure($imap, $emailNum);
                
                // Extract email data
                $fromAddress = isset($header->from[0]) 
                    ? (isset($header->from[0]->mailbox) && isset($header->from[0]->host) 
                        ? $header->from[0]->mailbox . '@' . $header->from[0]->host 
                        : 'unknown@unknown.com')
                    : 'unknown@unknown.com';
                
                $toAddress = isset($header->to[0])
                    ? (isset($header->to[0]->mailbox) && isset($header->to[0]->host)
                        ? $header->to[0]->mailbox . '@' . $header->to[0]->host
                        : null)
                    : null;
                
                $subject = isset($header->subject) 
                    ? iconv_mime_decode($header->subject, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8')
                    : '(No Subject)';
                
                $dateReceived = isset($header->date) 
                    ? date('Y-m-d H:i:s', strtotime($header->date))
                    : date('Y-m-d H:i:s');
                
                // Get email body
                $body = '';
                $htmlBody = '';
                
                if ($structure->type == 0) {
                    // Plain text email
                    $body = imap_fetchbody($imap, $emailNum, 1);
                    $body = decodeEmailBody($body, $structure->encoding);
                } elseif ($structure->type == 1) {
                    // Multipart email
                    foreach ($structure->parts as $partNum => $part) {
                        $partNumber = $partNum + 1;
                        
                        if ($part->subtype == 'PLAIN') {
                            $body = imap_fetchbody($imap, $emailNum, $partNumber);
                            $body = decodeEmailBody($body, $part->encoding);
                        } elseif ($part->subtype == 'HTML') {
                            $htmlBody = imap_fetchbody($imap, $emailNum, $partNumber);
                            $htmlBody = decodeEmailBody($htmlBody, $part->encoding);
                        }
                    }
                }
                
                // Find matching temp_email
                if (!$toAddress) {
                    logMessage("No recipient address found, skipping email", 'WARN');
                    continue;
                }
                
                $stmt = $pdo->prepare("
                    SELECT id FROM temp_emails 
                    WHERE address = ? AND is_active = 1 AND expires_at > NOW()
                    LIMIT 1
                ");
                $stmt->execute([$toAddress]);
                $tempEmail = $stmt->fetch();
                
                if (!$tempEmail) {
                    // Check if it matches any pattern (wildcard matching)
                    $localPart = explode('@', $toAddress)[0];
                    $domain = explode('@', $toAddress)[1] ?? '';
                    
                    $stmt = $pdo->prepare("
                        SELECT te.id 
                        FROM temp_emails te
                        JOIN domains d ON te.domain_id = d.id
                        WHERE d.name = ? AND te.is_active = 1 AND te.expires_at > NOW()
                        ORDER BY te.created_at DESC
                        LIMIT 1
                    ");
                    $stmt->execute(['@' . $domain]);
                    $tempEmail = $stmt->fetch();
                }
                
                if (!$tempEmail) {
                    logMessage("No matching temp_email for: $toAddress", 'WARN');
                    continue;
                }
                
                // Check for duplicate (by subject and from address within last hour)
                $stmt = $pdo->prepare("
                    SELECT id FROM received_emails 
                    WHERE temp_email_id = ? 
                    AND from_address = ? 
                    AND subject = ?
                    AND received_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
                    LIMIT 1
                ");
                $stmt->execute([$tempEmail['id'], $fromAddress, $subject]);
                if ($stmt->fetch()) {
                    logMessage("Duplicate email detected, skipping: $subject");
                    
                    // Mark as read if auto-delete is enabled
                    if ($mailbox['auto_delete_after_store']) {
                        imap_delete($imap, $emailNum);
                    }
                    continue;
                }
                
                // Store email in database
                $stmt = $pdo->prepare("
                    INSERT INTO received_emails (temp_email_id, from_address, subject, body, html_body, received_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $tempEmail['id'],
                    $fromAddress,
                    $subject,
                    $body ?: null,
                    $htmlBody ?: null,
                    $dateReceived
                ]);
                
                $emailId = $pdo->lastInsertId();
                logMessage("Stored email ID: $emailId - Subject: $subject");
                
                // Handle attachments
                if (isset($structure->parts)) {
                    foreach ($structure->parts as $partNum => $part) {
                        if ($part->ifdisposition && strtolower($part->disposition) == 'attachment') {
                            saveAttachment($imap, $emailNum, $partNum + 1, $part, $emailId, $pdo);
                        }
                    }
                }
                
                // Mark as read/delete if auto_delete_after_store is enabled
                if ($mailbox['auto_delete_after_store']) {
                    imap_delete($imap, $emailNum);
                } else {
                    imap_setflag_full($imap, $emailNum, "\\Seen");
                }
                
                $totalProcessed++;
                
            } catch (Exception $e) {
                logMessage("Error processing email: " . $e->getMessage(), 'ERROR');
            }
        }
        
        // Expunge deleted messages
        if ($mailbox['auto_delete_after_store']) {
            imap_expunge($imap);
        }
        
        // Update mailbox status
        $stmt = $pdo->prepare("
            UPDATE mailboxes 
            SET last_polled_at = NOW(), last_error = NULL 
            WHERE id = ?
        ");
        $stmt->execute([$mailbox['id']]);
        
        imap_close($imap);
        
    } catch (Exception $e) {
        logMessage("Error processing mailbox {$mailbox['name']}: " . $e->getMessage(), 'ERROR');
        
        $stmt = $pdo->prepare("
            UPDATE mailboxes 
            SET last_error = ?, last_error_at = NOW() 
            WHERE id = ?
        ");
        $stmt->execute([$e->getMessage(), $mailbox['id']]);
    }
}

logMessage("IMAP poll complete. Processed $totalProcessed email(s)");

/**
 * Decode email body based on encoding type
 */
function decodeEmailBody(string $body, int $encoding): string {
    switch ($encoding) {
        case 0: // 7BIT
        case 1: // 8BIT
            return $body;
        case 2: // BINARY
            return $body;
        case 3: // BASE64
            return base64_decode($body);
        case 4: // QUOTED-PRINTABLE
            return quoted_printable_decode($body);
        default:
            return $body;
    }
}

/**
 * Save email attachment to storage
 */
function saveAttachment($imap, int $emailNum, int $partNum, object $part, string $emailId, PDO $pdo): void {
    try {
        // Get filename
        $filename = 'attachment';
        if ($part->ifdparameters) {
            foreach ($part->dparameters as $param) {
                if (strtolower($param->attribute) == 'filename') {
                    $filename = $param->value;
                    break;
                }
            }
        }
        if ($part->ifparameters) {
            foreach ($part->parameters as $param) {
                if (strtolower($param->attribute) == 'name') {
                    $filename = $param->value;
                    break;
                }
            }
        }
        
        // Get file content
        $content = imap_fetchbody($imap, $emailNum, $partNum);
        $content = decodeEmailBody($content, $part->encoding);
        
        // Create storage directory
        $storagePath = defined('STORAGE_PATH') ? STORAGE_PATH : __DIR__ . '/../storage';
        $attachmentDir = $storagePath . '/attachments/' . date('Y/m');
        if (!is_dir($attachmentDir)) {
            mkdir($attachmentDir, 0755, true);
        }
        
        // Generate unique filename
        $ext = pathinfo($filename, PATHINFO_EXTENSION);
        $uniqueName = uniqid() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $filename);
        $filePath = $attachmentDir . '/' . $uniqueName;
        
        // Save file
        file_put_contents($filePath, $content);
        
        // Get file info
        $fileSize = strlen($content);
        $mimeType = mime_content_type($filePath) ?: 'application/octet-stream';
        
        // Store in database
        $relativePath = 'attachments/' . date('Y/m') . '/' . $uniqueName;
        $stmt = $pdo->prepare("
            INSERT INTO email_attachments (received_email_id, file_name, file_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$emailId, $filename, $mimeType, $fileSize, $relativePath]);
        
        logMessage("Saved attachment: $filename ($fileSize bytes)");
        
    } catch (Exception $e) {
        logMessage("Error saving attachment: " . $e->getMessage(), 'ERROR');
    }
}
