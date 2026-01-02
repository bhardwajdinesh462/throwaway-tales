<?php
/**
 * Health Check Cron Job
 * Runs periodically to check system health and send alerts for issues
 */

// Only run from CLI or cron
if (php_sapi_name() !== 'cli' && !defined('CRON_RUNNING')) {
    die('This script can only be run from the command line or cron.');
}

require_once __DIR__ . '/../config.php';

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    error_log("Health check cron: Database connection failed - " . $e->getMessage());
    exit(1);
}

// Include functions for sending emails
require_once __DIR__ . '/../routes/functions.php';

/**
 * Get alert settings from database
 */
function getAlertSettings($pdo) {
    $stmt = $pdo->prepare("SELECT value FROM app_settings WHERE `key` = 'alert_settings' LIMIT 1");
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$result) {
        return null;
    }
    
    return json_decode($result['value'], true);
}

/**
 * Check if we can send an alert (cooldown check)
 */
function canSendAlert($pdo, $alertType, $cooldownMinutes) {
    try {
        $stmt = $pdo->prepare("
            SELECT sent_at FROM alert_logs 
            WHERE alert_type = ? 
            ORDER BY sent_at DESC 
            LIMIT 1
        ");
        $stmt->execute([$alertType]);
        $lastAlert = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$lastAlert) {
            return true;
        }
        
        $lastSentTime = strtotime($lastAlert['sent_at']);
        $cooldownSeconds = $cooldownMinutes * 60;
        
        return (time() - $lastSentTime) >= $cooldownSeconds;
    } catch (PDOException $e) {
        // Table might not exist, allow sending
        return true;
    }
}

/**
 * Log an alert to the database
 */
function logAlert($pdo, $alertType, $message, $details, $sentTo) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO alert_logs (id, alert_type, message, details, sent_to, sent_at)
            VALUES (UUID(), ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $alertType,
            $message,
            json_encode($details),
            json_encode($sentTo)
        ]);
    } catch (PDOException $e) {
        error_log("Failed to log alert: " . $e->getMessage());
    }
}

/**
 * Send alert email
 */
function sendAlertEmail($pdo, $config, $to, $subject, $body) {
    // Get SMTP config from mailboxes
    $stmt = $pdo->query("
        SELECT * FROM mailboxes 
        WHERE is_active = 1 AND smtp_host IS NOT NULL 
        ORDER BY priority ASC 
        LIMIT 1
    ");
    $mailbox = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$mailbox) {
        // Fall back to config
        $host = $config['smtp']['host'] ?? SMTP_HOST ?? '';
        $port = $config['smtp']['port'] ?? SMTP_PORT ?? 587;
        $user = $config['smtp']['user'] ?? SMTP_USER ?? '';
        $pass = $config['smtp']['pass'] ?? SMTP_PASS ?? '';
        $from = $config['smtp']['from'] ?? SMTP_FROM ?? $user;
    } else {
        $host = $mailbox['smtp_host'];
        $port = $mailbox['smtp_port'] ?? 587;
        $user = $mailbox['smtp_user'];
        $pass = $mailbox['smtp_password'];
        $from = $mailbox['smtp_from'] ?? $user;
    }
    
    if (empty($host) || empty($user)) {
        error_log("Cannot send alert: SMTP not configured");
        return false;
    }
    
    $htmlBody = "
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .alert-box { padding: 20px; background: #f8f9fa; border-left: 4px solid #dc3545; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        </style>
    </head>
    <body>
        <h2>⚠️ TempMail System Alert</h2>
        <div class='alert-box'>
            <p><strong>$subject</strong></p>
            <p>" . nl2br(htmlspecialchars($body)) . "</p>
        </div>
        <div class='footer'>
            <p>This is an automated alert from your TempMail installation.</p>
            <p>You can configure alert settings in Admin → System → Alerts.</p>
        </div>
    </body>
    </html>
    ";
    
    $result = sendSmtpEmail($host, $port, $user, $pass, $from, $to, "[TempMail Alert] " . $subject, strip_tags($body), $htmlBody);
    
    return $result['success'] ?? false;
}

/**
 * Send admin alert
 */
function sendAdminAlert($pdo, $config, $alertType, $message, $details = []) {
    $settings = getAlertSettings($pdo);
    
    if (!$settings || !$settings['enabled']) {
        return false;
    }
    
    $alertConfig = $settings['alerts'][$alertType] ?? null;
    if (!$alertConfig || !$alertConfig['enabled']) {
        return false;
    }
    
    $adminEmails = $settings['admin_emails'] ?? [];
    if (empty($adminEmails)) {
        return false;
    }
    
    $cooldown = $settings['cooldown_minutes'] ?? 60;
    if (!canSendAlert($pdo, $alertType, $cooldown)) {
        error_log("Alert cooldown active for: $alertType");
        return false;
    }
    
    $sentTo = [];
    $subject = ucfirst(str_replace('_', ' ', $alertType));
    
    foreach ($adminEmails as $email) {
        $result = sendAlertEmail($pdo, $config, $email, $subject, $message);
        if ($result) {
            $sentTo[] = $email;
        }
    }
    
    if (!empty($sentTo)) {
        logAlert($pdo, $alertType, $message, $details, $sentTo);
        return true;
    }
    
    return false;
}

/**
 * Run health checks
 */
function runHealthChecks($pdo, $config) {
    $issues = [];
    
    // Check database tables
    $requiredTables = [
        'users', 'profiles', 'domains', 'temp_emails', 'received_emails',
        'mailboxes', 'app_settings', 'subscription_tiers', 'user_subscriptions',
        'email_logs', 'admin_audit_logs'
    ];
    
    $stmt = $pdo->query("SHOW TABLES");
    $existingTables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $missingTables = array_diff($requiredTables, $existingTables);
    if (!empty($missingTables)) {
        $issues[] = [
            'type' => 'database_issues',
            'message' => 'Missing database tables: ' . implode(', ', $missingTables),
            'details' => ['missing_tables' => $missingTables]
        ];
    }
    
    // Check mailbox connectivity
    $stmt = $pdo->query("
        SELECT id, name, smtp_host, imap_host, last_error, last_error_at 
        FROM mailboxes 
        WHERE is_active = 1 AND last_error IS NOT NULL AND last_error_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
    ");
    $failedMailboxes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($failedMailboxes as $mailbox) {
        if (!empty($mailbox['smtp_host'])) {
            $issues[] = [
                'type' => 'smtp_connection_failure',
                'message' => "SMTP connection failed for mailbox '{$mailbox['name']}': {$mailbox['last_error']}",
                'details' => ['mailbox_id' => $mailbox['id'], 'mailbox_name' => $mailbox['name']]
            ];
        }
        if (!empty($mailbox['imap_host'])) {
            $issues[] = [
                'type' => 'imap_connection_failure',
                'message' => "IMAP connection failed for mailbox '{$mailbox['name']}': {$mailbox['last_error']}",
                'details' => ['mailbox_id' => $mailbox['id'], 'mailbox_name' => $mailbox['name']]
            ];
        }
    }
    
    // Check domains with DNS issues
    try {
        $stmt = $pdo->query("
            SELECT name, dns_verified, dns_last_checked 
            FROM domains 
            WHERE is_active = 1 AND dns_verified = 0 
            AND (dns_last_checked IS NULL OR dns_last_checked < DATE_SUB(NOW(), INTERVAL 24 HOUR))
        ");
        $unverifiedDomains = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (!empty($unverifiedDomains)) {
            $domainNames = array_column($unverifiedDomains, 'name');
            $issues[] = [
                'type' => 'dns_verification_failure',
                'message' => 'Domains with unverified DNS: ' . implode(', ', $domainNames),
                'details' => ['domains' => $domainNames]
            ];
        }
    } catch (PDOException $e) {
        // dns_verified column might not exist yet
    }
    
    return $issues;
}

// Main execution
echo "Running health check cron...\n";

$config = [
    'smtp' => [
        'host' => defined('SMTP_HOST') ? SMTP_HOST : '',
        'port' => defined('SMTP_PORT') ? SMTP_PORT : 587,
        'user' => defined('SMTP_USER') ? SMTP_USER : '',
        'pass' => defined('SMTP_PASS') ? SMTP_PASS : '',
        'from' => defined('SMTP_FROM') ? SMTP_FROM : '',
    ]
];

$issues = runHealthChecks($pdo, $config);

if (empty($issues)) {
    echo "No issues found.\n";
} else {
    echo "Found " . count($issues) . " issue(s).\n";
    
    foreach ($issues as $issue) {
        echo "- [{$issue['type']}] {$issue['message']}\n";
        $sent = sendAdminAlert($pdo, $config, $issue['type'], $issue['message'], $issue['details']);
        echo "  Alert sent: " . ($sent ? "Yes" : "No (disabled or cooldown)") . "\n";
    }
}

// Update cron status
$cronKey = 'cron_health_check';
$cronValue = json_encode([
    'last_run' => date('Y-m-d H:i:s'),
    'last_result' => empty($issues) ? 'success' : 'issues_found',
    'issues_count' => count($issues),
    'enabled' => true
]);

$stmt = $pdo->prepare("
    INSERT INTO app_settings (id, `key`, value, updated_at)
    VALUES (UUID(), ?, ?, NOW())
    ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()
");
$stmt->execute([$cronKey, $cronValue, $cronValue]);

echo "Health check complete.\n";
