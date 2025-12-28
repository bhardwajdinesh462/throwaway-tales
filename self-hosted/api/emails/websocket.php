<?php
/**
 * WebSocket-like Real-time Email Notifications
 * GET /api/emails/websocket.php
 * 
 * Uses Server-Sent Events (SSE) for real-time push notifications
 * SSE is widely supported and works through firewalls/proxies
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/response.php';

// Disable output buffering for SSE
if (ob_get_level()) ob_end_clean();

// Get temp email ID from query
$tempEmailId = $_GET['temp_email_id'] ?? null;
$token = $_GET['token'] ?? null;
$lastEventId = $_SERVER['HTTP_LAST_EVENT_ID'] ?? $_GET['last_id'] ?? null;

if (!$tempEmailId && !$token) {
    header('Content-Type: application/json');
    Response::error('temp_email_id or token is required');
}

// Validate temp email ownership
try {
    if ($token) {
        $tempEmail = Database::fetchOne(
            "SELECT id FROM temp_emails WHERE token_hash = SHA2(?, 256) AND is_active = 1",
            [$token]
        );
        if (!$tempEmail) {
            header('Content-Type: application/json');
            Response::error('Invalid token');
        }
        $tempEmailId = $tempEmail['id'];
    }
} catch (Exception $e) {
    header('Content-Type: application/json');
    Response::serverError('Validation failed');
}

// Set SSE headers
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no'); // Disable nginx buffering
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

// Send initial connection message
echo "event: connected\n";
echo "data: " . json_encode(['status' => 'connected', 'temp_email_id' => $tempEmailId]) . "\n\n";
flush();

// Track last check time
$lastCheck = $lastEventId ? date('Y-m-d H:i:s', intval($lastEventId)) : date('Y-m-d H:i:s');
$heartbeatInterval = 15; // seconds
$lastHeartbeat = time();
$maxRuntime = 300; // 5 minutes max (for shared hosting)
$startTime = time();

// Main event loop
while (true) {
    // Check if client disconnected
    if (connection_aborted()) {
        break;
    }
    
    // Check max runtime
    if ((time() - $startTime) > $maxRuntime) {
        echo "event: reconnect\n";
        echo "data: " . json_encode(['reason' => 'max_runtime']) . "\n\n";
        flush();
        break;
    }
    
    try {
        // Check for new emails
        $newEmails = Database::fetchAll(
            "SELECT re.id, re.from_address, re.from_name, re.subject, 
                    re.has_attachments, re.received_at
             FROM received_emails re
             WHERE re.temp_email_id = ? 
               AND re.received_at > ?
               AND re.deleted_at IS NULL
             ORDER BY re.received_at ASC
             LIMIT 10",
            [$tempEmailId, $lastCheck]
        );
        
        if (!empty($newEmails)) {
            foreach ($newEmails as $email) {
                $eventId = strtotime($email['received_at']);
                echo "id: $eventId\n";
                echo "event: new_email\n";
                echo "data: " . json_encode([
                    'id' => $email['id'],
                    'from' => $email['from_name'] ?: $email['from_address'],
                    'from_email' => $email['from_address'],
                    'subject' => $email['subject'],
                    'has_attachments' => (bool)$email['has_attachments'],
                    'received_at' => $email['received_at']
                ]) . "\n\n";
                flush();
                
                $lastCheck = $email['received_at'];
            }
        }
        
        // Check for notifications (from webhook)
        $notifications = Database::fetchAll(
            "SELECT en.id, en.email_id, en.subject, en.created_at
             FROM email_notifications en
             WHERE en.temp_email_id = ? 
               AND en.is_read = 0
               AND en.created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
             ORDER BY en.created_at ASC
             LIMIT 10",
            [$tempEmailId]
        );
        
        if (!empty($notifications)) {
            foreach ($notifications as $notif) {
                echo "event: notification\n";
                echo "data: " . json_encode([
                    'email_id' => $notif['email_id'],
                    'subject' => $notif['subject'],
                    'created_at' => $notif['created_at']
                ]) . "\n\n";
                flush();
                
                // Mark as read
                Database::query(
                    "UPDATE email_notifications SET is_read = 1 WHERE id = ?",
                    [$notif['id']]
                );
            }
        }
        
        // Send heartbeat
        if ((time() - $lastHeartbeat) >= $heartbeatInterval) {
            echo "event: heartbeat\n";
            echo "data: " . json_encode(['time' => date('c')]) . "\n\n";
            flush();
            $lastHeartbeat = time();
        }
        
    } catch (Exception $e) {
        echo "event: error\n";
        echo "data: " . json_encode(['error' => 'Database error']) . "\n\n";
        flush();
    }
    
    // Sleep to prevent CPU overload
    sleep(1);
}

// Clean exit
echo "event: close\n";
echo "data: " . json_encode(['reason' => 'connection_closed']) . "\n\n";
flush();
