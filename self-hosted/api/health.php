<?php
/**
 * Health Check API Endpoint
 * 
 * Returns real-time status of:
 * - Database connection
 * - IMAP polling status
 * - Webhook deliveries
 * - System resources
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

require_once __DIR__ . '/core/database.php';
require_once __DIR__ . '/core/auth.php';

// Require admin authentication
try {
    $user = Auth::getCurrentUser();
    if (!$user || !in_array($user['role'] ?? '', ['admin', 'super_admin'])) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        exit;
    }
} catch (Exception $e) {
    http_response_code(401);
    echo json_encode(['error' => 'Authentication required']);
    exit;
}

$startTime = microtime(true);
$health = [
    'status' => 'healthy',
    'timestamp' => date('c'),
    'checks' => [],
    'metrics' => [],
];

try {
    $db = Database::getConnection();
    
    // =========================================================================
    // DATABASE CHECK
    // =========================================================================
    $dbStart = microtime(true);
    try {
        $stmt = $db->query("SELECT 1");
        $dbLatency = round((microtime(true) - $dbStart) * 1000, 2);
        
        // Get table counts
        $tables = [];
        $stmt = $db->query("SHOW TABLE STATUS");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $tables[$row['Name']] = [
                'rows' => (int)$row['Rows'],
                'size_mb' => round(($row['Data_length'] + $row['Index_length']) / 1024 / 1024, 2),
            ];
        }
        
        // Key table stats
        $emailCount = $db->query("SELECT COUNT(*) FROM temp_emails WHERE is_active = 1")->fetchColumn();
        $receivedCount = $db->query("SELECT COUNT(*) FROM received_emails WHERE deleted_at IS NULL")->fetchColumn();
        $userCount = $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
        
        $health['checks']['database'] = [
            'status' => 'healthy',
            'latency_ms' => $dbLatency,
            'active_emails' => (int)$emailCount,
            'received_emails' => (int)$receivedCount,
            'total_users' => (int)$userCount,
            'table_count' => count($tables),
        ];
        
    } catch (Exception $e) {
        $health['status'] = 'unhealthy';
        $health['checks']['database'] = [
            'status' => 'unhealthy',
            'error' => $e->getMessage(),
        ];
    }
    
    // =========================================================================
    // IMAP POLLING CHECK
    // =========================================================================
    try {
        $imapEnabled = false;
        $imapStatus = 'disabled';
        $imapLastPoll = null;
        $imapError = null;
        
        // Check app_settings for IMAP config
        $stmt = $db->query("SELECT `key`, value FROM app_settings WHERE `key` LIKE 'imap_%'");
        $imapSettings = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $value = $row['value'];
            // Try to decode JSON value
            $decoded = json_decode($value, true);
            $imapSettings[$row['key']] = $decoded !== null ? $decoded : $value;
        }
        
        $imapEnabled = isset($imapSettings['imap_enabled']) && 
            ($imapSettings['imap_enabled'] === true || $imapSettings['imap_enabled'] === 'true');
        
        // Check mailboxes table for IMAP status
        $stmt = $db->query("
            SELECT name, last_polled_at, last_poll_status, last_poll_error, poll_interval_seconds
            FROM mailboxes 
            WHERE is_active = 1 
            ORDER BY last_polled_at DESC 
            LIMIT 5
        ");
        $mailboxes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Check cron_runs for IMAP jobs
        $stmt = $db->query("
            SELECT job_name, status, started_at, completed_at, error_message, records_processed
            FROM cron_runs 
            WHERE job_name LIKE '%imap%' OR job_name LIKE '%poll%'
            ORDER BY started_at DESC 
            LIMIT 5
        ");
        $imapJobs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $lastSuccessfulPoll = null;
        foreach ($imapJobs as $job) {
            if ($job['status'] === 'completed') {
                $lastSuccessfulPoll = $job['completed_at'];
                break;
            }
        }
        
        // Determine IMAP health
        if (!$imapEnabled) {
            $imapStatus = 'disabled';
        } elseif (empty($mailboxes) && empty($imapJobs)) {
            $imapStatus = 'not_configured';
        } elseif ($lastSuccessfulPoll && strtotime($lastSuccessfulPoll) > strtotime('-10 minutes')) {
            $imapStatus = 'healthy';
        } elseif ($lastSuccessfulPoll && strtotime($lastSuccessfulPoll) > strtotime('-30 minutes')) {
            $imapStatus = 'degraded';
        } else {
            $imapStatus = 'stale';
        }
        
        $health['checks']['imap'] = [
            'status' => $imapStatus,
            'enabled' => $imapEnabled,
            'last_successful_poll' => $lastSuccessfulPoll,
            'mailboxes' => array_map(function($m) {
                return [
                    'name' => $m['name'],
                    'last_poll' => $m['last_polled_at'],
                    'status' => $m['last_poll_status'],
                    'error' => $m['last_poll_error'],
                ];
            }, $mailboxes),
            'recent_jobs' => array_map(function($j) {
                return [
                    'job' => $j['job_name'],
                    'status' => $j['status'],
                    'started' => $j['started_at'],
                    'records' => (int)$j['records_processed'],
                ];
            }, array_slice($imapJobs, 0, 3)),
        ];
        
    } catch (Exception $e) {
        $health['checks']['imap'] = [
            'status' => 'error',
            'error' => $e->getMessage(),
        ];
    }
    
    // =========================================================================
    // WEBHOOK DELIVERIES CHECK
    // =========================================================================
    try {
        $webhookEnabled = false;
        $webhookStatus = 'disabled';
        
        // Check webhook settings
        $stmt = $db->query("SELECT `key`, value FROM app_settings WHERE `key` LIKE 'webhook_%'");
        $webhookSettings = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $decoded = json_decode($row['value'], true);
            $webhookSettings[$row['key']] = $decoded !== null ? $decoded : $row['value'];
        }
        
        $webhookEnabled = isset($webhookSettings['webhook_enabled']) && 
            ($webhookSettings['webhook_enabled'] === true || $webhookSettings['webhook_enabled'] === 'true');
        
        // Get recent webhook activity from email_logs
        $stmt = $db->query("
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'delivered' OR status = 'sent' THEN 1 ELSE 0 END) as success,
                SUM(CASE WHEN status = 'failed' OR status = 'bounced' THEN 1 ELSE 0 END) as failed,
                MAX(created_at) as last_activity
            FROM email_logs 
            WHERE direction = 'inbound' 
            AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ");
        $webhookStats = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Get recent errors
        $stmt = $db->query("
            SELECT from_address, to_address, status, error_message, created_at
            FROM email_logs 
            WHERE direction = 'inbound' 
            AND (status = 'failed' OR status = 'bounced')
            AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY created_at DESC
            LIMIT 5
        ");
        $recentErrors = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Determine webhook health
        if (!$webhookEnabled) {
            $webhookStatus = 'disabled';
        } elseif ((int)$webhookStats['total'] === 0) {
            $webhookStatus = 'no_activity';
        } elseif ((int)$webhookStats['failed'] === 0) {
            $webhookStatus = 'healthy';
        } elseif ((int)$webhookStats['failed'] < (int)$webhookStats['success']) {
            $webhookStatus = 'degraded';
        } else {
            $webhookStatus = 'unhealthy';
        }
        
        $successRate = (int)$webhookStats['total'] > 0 
            ? round(((int)$webhookStats['success'] / (int)$webhookStats['total']) * 100, 1)
            : null;
        
        $health['checks']['webhook'] = [
            'status' => $webhookStatus,
            'enabled' => $webhookEnabled,
            'last_24h' => [
                'total' => (int)$webhookStats['total'],
                'success' => (int)$webhookStats['success'],
                'failed' => (int)$webhookStats['failed'],
                'success_rate' => $successRate,
            ],
            'last_activity' => $webhookStats['last_activity'],
            'recent_errors' => array_map(function($e) {
                return [
                    'to' => $e['to_address'],
                    'error' => $e['error_message'],
                    'time' => $e['created_at'],
                ];
            }, $recentErrors),
        ];
        
    } catch (Exception $e) {
        $health['checks']['webhook'] = [
            'status' => 'error',
            'error' => $e->getMessage(),
        ];
    }
    
    // =========================================================================
    // SMTP CHECK
    // =========================================================================
    try {
        $smtpEnabled = false;
        
        // Check SMTP settings
        $stmt = $db->query("SELECT `key`, value FROM app_settings WHERE `key` LIKE 'smtp_%'");
        $smtpSettings = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $decoded = json_decode($row['value'], true);
            $smtpSettings[$row['key']] = $decoded !== null ? $decoded : $row['value'];
        }
        
        $smtpEnabled = isset($smtpSettings['smtp_enabled']) && 
            ($smtpSettings['smtp_enabled'] === true || $smtpSettings['smtp_enabled'] === 'true');
        
        // Get outbound email stats
        $stmt = $db->query("
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('sent', 'delivered') THEN 1 ELSE 0 END) as success,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM email_logs 
            WHERE direction = 'outbound' 
            AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ");
        $smtpStats = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $health['checks']['smtp'] = [
            'status' => $smtpEnabled ? 'enabled' : 'disabled',
            'enabled' => $smtpEnabled,
            'host' => $smtpSettings['smtp_host'] ?? null,
            'last_24h' => [
                'total' => (int)$smtpStats['total'],
                'success' => (int)$smtpStats['success'],
                'failed' => (int)$smtpStats['failed'],
            ],
        ];
        
    } catch (Exception $e) {
        $health['checks']['smtp'] = [
            'status' => 'error',
            'error' => $e->getMessage(),
        ];
    }
    
    // =========================================================================
    // SYSTEM METRICS
    // =========================================================================
    $health['metrics'] = [
        'php_version' => PHP_VERSION,
        'memory_usage_mb' => round(memory_get_usage(true) / 1024 / 1024, 2),
        'memory_limit' => ini_get('memory_limit'),
        'disk_free_gb' => round(disk_free_space('/') / 1024 / 1024 / 1024, 2),
        'server_time' => date('Y-m-d H:i:s'),
        'timezone' => date_default_timezone_get(),
        'uptime' => @file_get_contents('/proc/uptime') ? explode(' ', file_get_contents('/proc/uptime'))[0] : null,
    ];
    
    // =========================================================================
    // EMAIL STATS (last 7 days)
    // =========================================================================
    try {
        $stmt = $db->query("
            SELECT 
                DATE(received_at) as date,
                COUNT(*) as count
            FROM received_emails
            WHERE received_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(received_at)
            ORDER BY date DESC
        ");
        $health['metrics']['emails_7d'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $health['metrics']['emails_7d'] = [];
    }
    
    // Determine overall health
    $unhealthyChecks = array_filter($health['checks'], function($check) {
        return in_array($check['status'] ?? '', ['unhealthy', 'error', 'stale']);
    });
    
    $degradedChecks = array_filter($health['checks'], function($check) {
        return $check['status'] === 'degraded';
    });
    
    if (!empty($unhealthyChecks)) {
        $health['status'] = 'unhealthy';
    } elseif (!empty($degradedChecks)) {
        $health['status'] = 'degraded';
    }
    
} catch (Exception $e) {
    $health['status'] = 'error';
    $health['error'] = $e->getMessage();
}

$health['response_time_ms'] = round((microtime(true) - $startTime) * 1000, 2);

echo json_encode($health, JSON_PRETTY_PRINT);
