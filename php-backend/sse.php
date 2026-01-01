<?php
/**
 * Server-Sent Events (SSE) endpoint for real-time email notifications
 * 
 * This provides a faster alternative to polling for new emails.
 * The client connects to this endpoint and receives push notifications
 * when new emails arrive.
 */

require_once __DIR__ . '/config.php';

// Set SSE headers
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no'); // Disable nginx buffering
header('Access-Control-Allow-Origin: ' . CORS_ORIGIN);
header('Access-Control-Allow-Credentials: true');

// Disable output buffering
if (function_exists('apache_setenv')) {
    apache_setenv('no-gzip', '1');
}
@ini_set('zlib.output_compression', 'Off');
@ini_set('implicit_flush', 1);

// Flush any existing buffers
while (ob_get_level()) {
    ob_end_flush();
}
ob_implicit_flush(true);

// Get temp email ID from query params
$tempEmailId = $_GET['temp_email_id'] ?? null;
$token = $_GET['token'] ?? null;

// Also check for JWT token in Authorization header
$authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
    $jwtToken = $matches[1];
}

// Validate connection
if (!$tempEmailId) {
    sendEvent('error', ['message' => 'Missing temp_email_id parameter']);
    exit;
}

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    sendEvent('error', ['message' => 'Database connection failed']);
    exit;
}

// Verify the temp email exists and token is valid (if provided)
try {
    if ($token) {
        $stmt = $pdo->prepare("SELECT id FROM temp_emails WHERE id = ? AND secret_token = ? AND is_active = 1");
        $stmt->execute([$tempEmailId, $token]);
    } else {
        $stmt = $pdo->prepare("SELECT id FROM temp_emails WHERE id = ? AND is_active = 1");
        $stmt->execute([$tempEmailId]);
    }
    
    if (!$stmt->fetch()) {
        sendEvent('error', ['message' => 'Invalid or expired temp email']);
        exit;
    }
} catch (PDOException $e) {
    sendEvent('error', ['message' => 'Verification failed']);
    exit;
}

// Send initial connection success
sendEvent('connected', [
    'temp_email_id' => $tempEmailId,
    'timestamp' => date('c')
]);

// Keep track of last email ID to detect new emails
$lastEmailId = null;

// Get the most recent email ID initially
try {
    $stmt = $pdo->prepare("
        SELECT id FROM received_emails 
        WHERE temp_email_id = ? 
        ORDER BY received_at DESC 
        LIMIT 1
    ");
    $stmt->execute([$tempEmailId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $lastEmailId = $row ? $row['id'] : null;
} catch (PDOException $e) {
    // Continue without last email ID
}

// Heartbeat counter
$heartbeatInterval = 15; // seconds
$lastHeartbeat = time();
$pollInterval = 1; // Check every 1 second for new emails
$maxRuntime = 300; // Maximum runtime of 5 minutes to prevent resource issues
$startTime = time();

// Main SSE loop
while (true) {
    // Check if client disconnected
    if (connection_aborted()) {
        break;
    }
    
    // Check max runtime
    if ((time() - $startTime) > $maxRuntime) {
        sendEvent('reconnect', ['message' => 'Max runtime reached, please reconnect']);
        break;
    }
    
    // Check for new emails
    try {
        $query = "
            SELECT 
                id, 
                from_address, 
                subject, 
                body,
                html_body,
                is_read,
                received_at
            FROM received_emails 
            WHERE temp_email_id = ?
        ";
        $params = [$tempEmailId];
        
        if ($lastEmailId) {
            // Get emails newer than last known email
            // We use received_at comparison since IDs might not be sequential
            $query .= " AND id != ? AND received_at > (SELECT received_at FROM received_emails WHERE id = ?)";
            $params[] = $lastEmailId;
            $params[] = $lastEmailId;
        }
        
        $query .= " ORDER BY received_at DESC LIMIT 10";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $newEmails = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (!empty($newEmails)) {
            foreach ($newEmails as $email) {
                sendEvent('new_email', [
                    'id' => $email['id'],
                    'from_address' => $email['from_address'],
                    'subject' => $email['subject'],
                    'body' => mb_substr($email['body'] ?? '', 0, 200), // Preview only
                    'is_read' => (bool)$email['is_read'],
                    'received_at' => $email['received_at']
                ]);
            }
            // Update last email ID to the most recent
            $lastEmailId = $newEmails[0]['id'];
        }
    } catch (PDOException $e) {
        sendEvent('error', ['message' => 'Failed to check for new emails']);
    }
    
    // Send heartbeat to keep connection alive
    if ((time() - $lastHeartbeat) >= $heartbeatInterval) {
        sendEvent('heartbeat', ['timestamp' => date('c')]);
        $lastHeartbeat = time();
    }
    
    // Flush output
    if (ob_get_level()) {
        ob_flush();
    }
    flush();
    
    // Wait before next check
    sleep($pollInterval);
}

/**
 * Send an SSE event to the client
 */
function sendEvent(string $event, array $data): void {
    echo "event: {$event}\n";
    echo "data: " . json_encode($data) . "\n\n";
    
    if (ob_get_level()) {
        ob_flush();
    }
    flush();
}
