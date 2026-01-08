<?php
/**
 * Health Dashboard - Real-time system monitoring
 * Shows mailbox status, email activity, and system diagnostics
 */

session_start();

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/helpers.php';

// Get config array
$config = getConfigArray();

// Connect to database
try {
    $dbHost = $config['db']['host'] ?? (defined('DB_HOST') ? DB_HOST : 'localhost');
    $dbName = $config['db']['name'] ?? (defined('DB_NAME') ? DB_NAME : '');
    $dbUser = $config['db']['user'] ?? (defined('DB_USER') ? DB_USER : '');
    $dbPass = $config['db']['pass'] ?? (defined('DB_PASS') ? DB_PASS : '');
    
    $pdo = new PDO(
        "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4",
        $dbUser,
        $dbPass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    die("Database connection failed");
}

// Check admin auth
$user = getAuthUserStandalone($pdo, $config);
$isAdmin = $user && checkIsAdminStandalone($pdo, $user['id']);

if (!$isAdmin) {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['error' => 'Admin access required']);
    exit;
}

// Handle API requests
if (isset($_GET['api'])) {
    header('Content-Type: application/json');
    
    switch ($_GET['api']) {
        case 'overview':
            getSystemOverview($pdo);
            break;
        case 'mailboxes':
            getMailboxHealth($pdo);
            break;
        case 'activity':
            getRecentActivity($pdo);
            break;
        case 'diagnostics':
            getSystemDiagnostics($pdo, $config);
            break;
        case 'alerts':
            getActiveAlerts($pdo);
            break;
        default:
            echo json_encode(['error' => 'Unknown API endpoint']);
    }
    exit;
}

function getSystemOverview($pdo) {
    $stats = [];
    
    // Mailbox stats
    $stmt = $pdo->query("SELECT COUNT(*) as total, SUM(is_active = 1) as active FROM mailboxes");
    $mailboxStats = $stmt->fetch(PDO::FETCH_ASSOC);
    $stats['mailboxes'] = [
        'total' => intval($mailboxStats['total']),
        'active' => intval($mailboxStats['active']),
        'inactive' => intval($mailboxStats['total']) - intval($mailboxStats['active'])
    ];
    
    // Email stats (last 24 hours)
    $stmt = $pdo->query("
        SELECT 
            COUNT(*) as total,
            SUM(status = 'sent') as sent,
            SUM(status = 'failed') as failed
        FROM email_logs 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ");
    $emailStats = $stmt->fetch(PDO::FETCH_ASSOC);
    $stats['emails_24h'] = [
        'total' => intval($emailStats['total']),
        'sent' => intval($emailStats['sent']),
        'failed' => intval($emailStats['failed']),
        'success_rate' => $emailStats['total'] > 0 
            ? round(($emailStats['sent'] / $emailStats['total']) * 100, 1) 
            : 100
    ];
    
    // Received emails (last 24 hours)
    $stmt = $pdo->query("
        SELECT COUNT(*) as count
        FROM received_emails 
        WHERE received_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ");
    $stats['received_24h'] = intval($stmt->fetchColumn());
    
    // Active temp emails
    $stmt = $pdo->query("
        SELECT COUNT(*) as count
        FROM temp_emails 
        WHERE is_active = 1 AND expires_at > NOW()
    ");
    $stats['active_temp_emails'] = intval($stmt->fetchColumn());
    
    // Active domains
    $stmt = $pdo->query("SELECT COUNT(*) FROM domains WHERE is_active = 1");
    $stats['active_domains'] = intval($stmt->fetchColumn());
    
    // Users stats
    $stmt = $pdo->query("
        SELECT 
            COUNT(*) as total,
            SUM(DATE(created_at) = CURDATE()) as today
        FROM profiles
    ");
    $userStats = $stmt->fetch(PDO::FETCH_ASSOC);
    $stats['users'] = [
        'total' => intval($userStats['total']),
        'today' => intval($userStats['today'])
    ];
    
    // System uptime (based on oldest cron run)
    $stmt = $pdo->query("
        SELECT value FROM app_settings 
        WHERE `key` LIKE 'cron_%' 
        ORDER BY updated_at DESC LIMIT 1
    ");
    $cronData = $stmt->fetch(PDO::FETCH_ASSOC);
    $stats['last_cron_run'] = null;
    if ($cronData) {
        $cronInfo = json_decode($cronData['value'], true);
        $stats['last_cron_run'] = $cronInfo['last_run'] ?? null;
    }
    
    echo json_encode($stats);
}

function getMailboxHealth($pdo) {
    $stmt = $pdo->query("
        SELECT 
            id, name, smtp_host, smtp_port, imap_host, imap_port,
            is_active, priority,
            daily_limit, hourly_limit,
            emails_sent_today, emails_sent_this_hour,
            last_polled_at, last_sent_at,
            last_error, last_error_at,
            created_at, updated_at
        FROM mailboxes
        ORDER BY priority ASC
    ");
    $mailboxes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $result = [];
    foreach ($mailboxes as $mb) {
        $health = 'healthy';
        $issues = [];
        
        // Check for errors
        if ($mb['last_error'] && $mb['last_error_at']) {
            $errorAge = time() - strtotime($mb['last_error_at']);
            if ($errorAge < 3600) { // Error within last hour
                $health = 'error';
                $issues[] = 'Recent error: ' . substr($mb['last_error'], 0, 100);
            } elseif ($errorAge < 86400) { // Error within last day
                $health = 'warning';
                $issues[] = 'Error in last 24h: ' . substr($mb['last_error'], 0, 100);
            }
        }
        
        // Check rate limits
        if ($mb['daily_limit'] > 0 && $mb['emails_sent_today'] >= $mb['daily_limit']) {
            $health = 'warning';
            $issues[] = 'Daily limit reached';
        }
        if ($mb['hourly_limit'] > 0 && $mb['emails_sent_this_hour'] >= $mb['hourly_limit']) {
            $health = 'warning';
            $issues[] = 'Hourly limit reached';
        }
        
        // Check polling status
        if ($mb['imap_host'] && $mb['last_polled_at']) {
            $pollAge = time() - strtotime($mb['last_polled_at']);
            if ($pollAge > 1800) { // Not polled in 30 minutes
                $health = $health === 'healthy' ? 'warning' : $health;
                $issues[] = 'IMAP not polled recently';
            }
        }
        
        // Inactive mailbox
        if (!$mb['is_active']) {
            $health = 'inactive';
            $issues[] = 'Mailbox is disabled';
        }
        
        $result[] = [
            'id' => $mb['id'],
            'name' => $mb['name'],
            'health' => $health,
            'issues' => $issues,
            'smtp' => [
                'host' => $mb['smtp_host'],
                'port' => $mb['smtp_port'],
                'configured' => !empty($mb['smtp_host'])
            ],
            'imap' => [
                'host' => $mb['imap_host'],
                'port' => $mb['imap_port'],
                'configured' => !empty($mb['imap_host']),
                'last_polled' => $mb['last_polled_at']
            ],
            'usage' => [
                'daily' => [
                    'used' => intval($mb['emails_sent_today']),
                    'limit' => intval($mb['daily_limit']),
                    'percentage' => $mb['daily_limit'] > 0 
                        ? round(($mb['emails_sent_today'] / $mb['daily_limit']) * 100, 1) 
                        : 0
                ],
                'hourly' => [
                    'used' => intval($mb['emails_sent_this_hour']),
                    'limit' => intval($mb['hourly_limit']),
                    'percentage' => $mb['hourly_limit'] > 0 
                        ? round(($mb['emails_sent_this_hour'] / $mb['hourly_limit']) * 100, 1) 
                        : 0
                ]
            ],
            'is_active' => (bool)$mb['is_active'],
            'priority' => intval($mb['priority']),
            'last_error' => $mb['last_error'],
            'last_error_at' => $mb['last_error_at'],
            'last_sent_at' => $mb['last_sent_at']
        ];
    }
    
    echo json_encode(['mailboxes' => $result]);
}

function getRecentActivity($pdo) {
    $activity = [];
    
    // Recent email logs
    $stmt = $pdo->query("
        SELECT 
            id, recipient_email, subject, status, 
            error_message, created_at, sent_at, failed_at,
            mailbox_id
        FROM email_logs
        ORDER BY created_at DESC
        LIMIT 50
    ");
    $activity['email_logs'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Recent received emails
    $stmt = $pdo->query("
        SELECT 
            re.id, re.from_address, re.subject, re.received_at,
            te.address as to_address
        FROM received_emails re
        JOIN temp_emails te ON te.id = re.temp_email_id
        ORDER BY re.received_at DESC
        LIMIT 50
    ");
    $activity['received_emails'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Recent temp emails created
    $stmt = $pdo->query("
        SELECT 
            id, address, created_at, expires_at, is_active,
            user_id IS NOT NULL as is_registered_user
        FROM temp_emails
        ORDER BY created_at DESC
        LIMIT 50
    ");
    $activity['temp_emails'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Hourly stats for chart
    $stmt = $pdo->query("
        SELECT 
            DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour,
            SUM(status = 'sent') as sent,
            SUM(status = 'failed') as failed
        FROM email_logs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY hour
        ORDER BY hour ASC
    ");
    $activity['hourly_stats'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode($activity);
}

function getSystemDiagnostics($pdo, $config) {
    $diagnostics = [];
    
    // PHP Info
    $diagnostics['php'] = [
        'version' => phpversion(),
        'memory_limit' => ini_get('memory_limit'),
        'max_execution_time' => ini_get('max_execution_time'),
        'upload_max_filesize' => ini_get('upload_max_filesize'),
        'post_max_size' => ini_get('post_max_size')
    ];
    
    // Extensions
    $requiredExtensions = ['pdo_mysql', 'json', 'openssl', 'mbstring', 'imap', 'curl', 'zip'];
    $extensions = [];
    foreach ($requiredExtensions as $ext) {
        $extensions[$ext] = extension_loaded($ext);
    }
    $diagnostics['extensions'] = $extensions;
    
    // Database
    try {
        $stmt = $pdo->query("SELECT VERSION() as version");
        $dbVersion = $stmt->fetchColumn();
        
        $dbNameVal = $config['db']['name'] ?? (defined('DB_NAME') ? DB_NAME : '');
        $dbHostVal = $config['db']['host'] ?? (defined('DB_HOST') ? DB_HOST : 'localhost');
        
        $diagnostics['database'] = [
            'connected' => true,
            'version' => $dbVersion,
            'host' => $dbHostVal,
            'name' => $dbNameVal
        ];
        
        // Table sizes
        $stmt = $pdo->prepare("
            SELECT 
                TABLE_NAME as name,
                TABLE_ROWS as rows,
                ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as size_mb
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = ?
            ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
            LIMIT 10
        ");
        $stmt->execute([$dbNameVal]);
        $diagnostics['database']['tables'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $diagnostics['database'] = [
            'connected' => false,
            'error' => $e->getMessage()
        ];
    }
    
    // Disk usage
    $diagnostics['disk'] = [
        'free_space' => disk_free_space('/'),
        'total_space' => disk_total_space('/'),
        'free_percent' => round((disk_free_space('/') / disk_total_space('/')) * 100, 1)
    ];
    
    // Server info
    $diagnostics['server'] = [
        'software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
        'os' => PHP_OS,
        'hostname' => gethostname(),
        'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'Unknown'
    ];
    
    // Cron job status
    $stmt = $pdo->query("SELECT * FROM app_settings WHERE `key` LIKE 'cron_%'");
    $cronJobs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $diagnostics['cron_jobs'] = [];
    foreach ($cronJobs as $job) {
        $data = json_decode($job['value'], true);
        $diagnostics['cron_jobs'][str_replace('cron_', '', $job['key'])] = [
            'last_run' => $data['last_run'] ?? null,
            'enabled' => $data['enabled'] ?? true,
            'last_result' => $data['last_result'] ?? null
        ];
    }
    
    // SMTP connectivity tests
    $stmt = $pdo->query("SELECT id, name, smtp_host, smtp_port FROM mailboxes WHERE is_active = 1");
    $mailboxes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $diagnostics['smtp_connectivity'] = [];
    foreach ($mailboxes as $mb) {
        if ($mb['smtp_host']) {
            $socket = @fsockopen($mb['smtp_host'], $mb['smtp_port'], $errno, $errstr, 5);
            $diagnostics['smtp_connectivity'][$mb['name']] = [
                'host' => $mb['smtp_host'],
                'port' => $mb['smtp_port'],
                'reachable' => $socket !== false
            ];
            if ($socket) fclose($socket);
        }
    }
    
    echo json_encode($diagnostics);
}

function getActiveAlerts($pdo) {
    $alerts = [];
    
    // Check for mailbox errors
    $stmt = $pdo->query("
        SELECT id, name, last_error, last_error_at
        FROM mailboxes
        WHERE last_error IS NOT NULL 
        AND last_error_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $alerts[] = [
            'type' => 'error',
            'category' => 'mailbox',
            'title' => "Mailbox Error: {$row['name']}",
            'message' => $row['last_error'],
            'timestamp' => $row['last_error_at'],
            'mailbox_id' => $row['id']
        ];
    }
    
    // Check for rate limit warnings
    $stmt = $pdo->query("
        SELECT name, 
            emails_sent_today, daily_limit,
            emails_sent_this_hour, hourly_limit
        FROM mailboxes
        WHERE is_active = 1
        AND (
            (daily_limit > 0 AND emails_sent_today >= daily_limit * 0.9)
            OR (hourly_limit > 0 AND emails_sent_this_hour >= hourly_limit * 0.9)
        )
    ");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if ($row['daily_limit'] > 0 && $row['emails_sent_today'] >= $row['daily_limit'] * 0.9) {
            $alerts[] = [
                'type' => 'warning',
                'category' => 'rate_limit',
                'title' => "Daily Limit Warning: {$row['name']}",
                'message' => "Sent {$row['emails_sent_today']}/{$row['daily_limit']} emails today",
                'timestamp' => date('Y-m-d H:i:s')
            ];
        }
        if ($row['hourly_limit'] > 0 && $row['emails_sent_this_hour'] >= $row['hourly_limit'] * 0.9) {
            $alerts[] = [
                'type' => 'warning',
                'category' => 'rate_limit',
                'title' => "Hourly Limit Warning: {$row['name']}",
                'message' => "Sent {$row['emails_sent_this_hour']}/{$row['hourly_limit']} emails this hour",
                'timestamp' => date('Y-m-d H:i:s')
            ];
        }
    }
    
    // Check for failed emails (high failure rate)
    $stmt = $pdo->query("
        SELECT 
            COUNT(*) as total,
            SUM(status = 'failed') as failed
        FROM email_logs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    ");
    $emailStats = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($emailStats['total'] > 0) {
        $failureRate = ($emailStats['failed'] / $emailStats['total']) * 100;
        if ($failureRate > 20) {
            $alerts[] = [
                'type' => 'error',
                'category' => 'email_delivery',
                'title' => 'High Email Failure Rate',
                'message' => "Email failure rate is {$failureRate}% in the last hour",
                'timestamp' => date('Y-m-d H:i:s')
            ];
        }
    }
    
    // Check disk space
    $freePercent = (disk_free_space('/') / disk_total_space('/')) * 100;
    if ($freePercent < 10) {
        $alerts[] = [
            'type' => 'error',
            'category' => 'system',
            'title' => 'Low Disk Space',
            'message' => "Only " . round($freePercent, 1) . "% disk space remaining",
            'timestamp' => date('Y-m-d H:i:s')
        ];
    } elseif ($freePercent < 25) {
        $alerts[] = [
            'type' => 'warning',
            'category' => 'system',
            'title' => 'Disk Space Warning',
            'message' => round($freePercent, 1) . "% disk space remaining",
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }
    
    // Check for stale IMAP polling
    $stmt = $pdo->query("
        SELECT name, last_polled_at
        FROM mailboxes
        WHERE is_active = 1 
        AND imap_host IS NOT NULL 
        AND imap_host != ''
        AND (last_polled_at IS NULL OR last_polled_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE))
    ");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $alerts[] = [
            'type' => 'warning',
            'category' => 'imap',
            'title' => "IMAP Polling Stale: {$row['name']}",
            'message' => $row['last_polled_at'] 
                ? "Last polled: {$row['last_polled_at']}" 
                : "Never polled",
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }
    
    echo json_encode(['alerts' => $alerts]);
}

// HTML Dashboard
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Health Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        .health-healthy { background-color: #10b981; }
        .health-warning { background-color: #f59e0b; }
        .health-error { background-color: #ef4444; }
        .health-inactive { background-color: #6b7280; }
        .pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
    </style>
</head>
<body class="bg-gray-900 text-white min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <div class="flex justify-between items-center mb-8">
            <h1 class="text-3xl font-bold">
                <i class="fas fa-heartbeat text-red-500 mr-3"></i>
                System Health Dashboard
            </h1>
            <div class="flex items-center gap-4">
                <span id="lastUpdate" class="text-gray-400 text-sm"></span>
                <button onclick="refreshAll()" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">
                    <i class="fas fa-sync-alt mr-2"></i>Refresh
                </button>
            </div>
        </div>

        <!-- Alerts Section -->
        <div id="alertsSection" class="mb-8"></div>

        <!-- Overview Stats -->
        <div id="overviewSection" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"></div>

        <!-- Mailbox Health -->
        <div class="bg-gray-800 rounded-xl p-6 mb-8">
            <h2 class="text-xl font-semibold mb-4">
                <i class="fas fa-inbox text-blue-400 mr-2"></i>Mailbox Health
            </h2>
            <div id="mailboxHealth" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>
        </div>

        <!-- Activity Chart -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div class="bg-gray-800 rounded-xl p-6">
                <h2 class="text-xl font-semibold mb-4">
                    <i class="fas fa-chart-line text-green-400 mr-2"></i>Email Activity (24h)
                </h2>
                <canvas id="activityChart" height="200"></canvas>
            </div>
            <div class="bg-gray-800 rounded-xl p-6">
                <h2 class="text-xl font-semibold mb-4">
                    <i class="fas fa-list text-purple-400 mr-2"></i>Recent Activity
                </h2>
                <div id="recentActivity" class="max-h-80 overflow-y-auto space-y-2"></div>
            </div>
        </div>

        <!-- System Diagnostics -->
        <div class="bg-gray-800 rounded-xl p-6">
            <h2 class="text-xl font-semibold mb-4">
                <i class="fas fa-cogs text-yellow-400 mr-2"></i>System Diagnostics
            </h2>
            <div id="diagnostics" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
        </div>
    </div>

    <script>
        let activityChart = null;
        const apiBase = '?api=';

        async function fetchData(endpoint) {
            try {
                const res = await fetch(apiBase + endpoint, {
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('nullsto_auth_token') }
                });
                return await res.json();
            } catch (e) {
                console.error('Fetch error:', e);
                return null;
            }
        }

        async function refreshOverview() {
            const data = await fetchData('overview');
            if (!data) return;

            const html = `
                <div class="bg-gray-800 rounded-xl p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-400 text-sm">Active Mailboxes</p>
                            <p class="text-3xl font-bold">${data.mailboxes.active}/${data.mailboxes.total}</p>
                        </div>
                        <i class="fas fa-server text-4xl text-blue-400"></i>
                    </div>
                </div>
                <div class="bg-gray-800 rounded-xl p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-400 text-sm">Emails Sent (24h)</p>
                            <p class="text-3xl font-bold">${data.emails_24h.sent}</p>
                            <p class="text-sm ${data.emails_24h.success_rate >= 95 ? 'text-green-400' : 'text-yellow-400'}">
                                ${data.emails_24h.success_rate}% success rate
                            </p>
                        </div>
                        <i class="fas fa-paper-plane text-4xl text-green-400"></i>
                    </div>
                </div>
                <div class="bg-gray-800 rounded-xl p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-400 text-sm">Emails Received (24h)</p>
                            <p class="text-3xl font-bold">${data.received_24h}</p>
                        </div>
                        <i class="fas fa-envelope-open text-4xl text-purple-400"></i>
                    </div>
                </div>
                <div class="bg-gray-800 rounded-xl p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-400 text-sm">Active Temp Emails</p>
                            <p class="text-3xl font-bold">${data.active_temp_emails}</p>
                        </div>
                        <i class="fas fa-at text-4xl text-yellow-400"></i>
                    </div>
                </div>
            `;
            document.getElementById('overviewSection').innerHTML = html;
        }

        async function refreshMailboxHealth() {
            const data = await fetchData('mailboxes');
            if (!data) return;

            const html = data.mailboxes.map(mb => `
                <div class="bg-gray-700 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="font-semibold">${mb.name}</h3>
                        <span class="health-${mb.health} px-2 py-1 rounded-full text-xs font-medium text-white">
                            ${mb.health.toUpperCase()}
                        </span>
                    </div>
                    ${mb.issues.length > 0 ? `
                        <div class="text-sm text-red-400 mb-2">
                            ${mb.issues.map(i => `<div>• ${i}</div>`).join('')}
                        </div>
                    ` : ''}
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <span class="text-gray-400">SMTP:</span>
                            <span class="${mb.smtp.configured ? 'text-green-400' : 'text-gray-500'}">
                                ${mb.smtp.configured ? mb.smtp.host : 'Not configured'}
                            </span>
                        </div>
                        <div>
                            <span class="text-gray-400">IMAP:</span>
                            <span class="${mb.imap.configured ? 'text-green-400' : 'text-gray-500'}">
                                ${mb.imap.configured ? mb.imap.host : 'Not configured'}
                            </span>
                        </div>
                    </div>
                    <div class="mt-3 space-y-2">
                        <div>
                            <div class="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Daily Usage</span>
                                <span>${mb.usage.daily.used}/${mb.usage.daily.limit}</span>
                            </div>
                            <div class="w-full bg-gray-600 rounded-full h-2">
                                <div class="h-2 rounded-full ${mb.usage.daily.percentage > 90 ? 'bg-red-500' : mb.usage.daily.percentage > 70 ? 'bg-yellow-500' : 'bg-green-500'}" 
                                     style="width: ${Math.min(mb.usage.daily.percentage, 100)}%"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Hourly Usage</span>
                                <span>${mb.usage.hourly.used}/${mb.usage.hourly.limit}</span>
                            </div>
                            <div class="w-full bg-gray-600 rounded-full h-2">
                                <div class="h-2 rounded-full ${mb.usage.hourly.percentage > 90 ? 'bg-red-500' : mb.usage.hourly.percentage > 70 ? 'bg-yellow-500' : 'bg-green-500'}" 
                                     style="width: ${Math.min(mb.usage.hourly.percentage, 100)}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
            document.getElementById('mailboxHealth').innerHTML = html || '<p class="text-gray-400">No mailboxes configured</p>';
        }

        async function refreshActivity() {
            const data = await fetchData('activity');
            if (!data) return;

            // Update chart
            if (activityChart) activityChart.destroy();
            const ctx = document.getElementById('activityChart').getContext('2d');
            activityChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.hourly_stats.map(s => s.hour.split(' ')[1]),
                    datasets: [{
                        label: 'Sent',
                        data: data.hourly_stats.map(s => s.sent),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true
                    }, {
                        label: 'Failed',
                        data: data.hourly_stats.map(s => s.failed),
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { labels: { color: '#9ca3af' } } },
                    scales: {
                        x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
                        y: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } }
                    }
                }
            });

            // Recent activity list
            const recentHtml = data.email_logs.slice(0, 20).map(log => `
                <div class="flex items-center justify-between bg-gray-700 rounded p-2 text-sm">
                    <div class="flex items-center">
                        <i class="fas fa-${log.status === 'sent' ? 'check-circle text-green-400' : 'times-circle text-red-400'} mr-2"></i>
                        <span class="truncate max-w-xs">${log.recipient_email}</span>
                    </div>
                    <span class="text-gray-400 text-xs">${new Date(log.created_at).toLocaleTimeString()}</span>
                </div>
            `).join('');
            document.getElementById('recentActivity').innerHTML = recentHtml || '<p class="text-gray-400">No recent activity</p>';
        }

        async function refreshAlerts() {
            const data = await fetchData('alerts');
            if (!data) return;

            if (data.alerts.length === 0) {
                document.getElementById('alertsSection').innerHTML = '';
                return;
            }

            const html = data.alerts.map(alert => `
                <div class="bg-${alert.type === 'error' ? 'red' : 'yellow'}-900 border border-${alert.type === 'error' ? 'red' : 'yellow'}-600 rounded-lg p-4 mb-2">
                    <div class="flex items-center">
                        <i class="fas fa-${alert.type === 'error' ? 'exclamation-circle' : 'exclamation-triangle'} text-${alert.type === 'error' ? 'red' : 'yellow'}-400 mr-3"></i>
                        <div>
                            <h4 class="font-semibold">${alert.title}</h4>
                            <p class="text-sm text-gray-300">${alert.message}</p>
                        </div>
                    </div>
                </div>
            `).join('');
            document.getElementById('alertsSection').innerHTML = html;
        }

        async function refreshDiagnostics() {
            const data = await fetchData('diagnostics');
            if (!data) return;

            const html = `
                <div class="space-y-3">
                    <h3 class="text-lg font-medium text-blue-400">PHP Info</h3>
                    <div class="text-sm space-y-1">
                        <div><span class="text-gray-400">Version:</span> ${data.php.version}</div>
                        <div><span class="text-gray-400">Memory Limit:</span> ${data.php.memory_limit}</div>
                        <div><span class="text-gray-400">Max Execution:</span> ${data.php.max_execution_time}s</div>
                    </div>
                </div>
                <div class="space-y-3">
                    <h3 class="text-lg font-medium text-green-400">Extensions</h3>
                    <div class="flex flex-wrap gap-2">
                        ${Object.entries(data.extensions).map(([ext, loaded]) => `
                            <span class="px-2 py-1 rounded text-xs ${loaded ? 'bg-green-600' : 'bg-red-600'}">
                                ${ext}
                            </span>
                        `).join('')}
                    </div>
                </div>
                <div class="space-y-3">
                    <h3 class="text-lg font-medium text-purple-400">Database</h3>
                    <div class="text-sm space-y-1">
                        <div><span class="text-gray-400">Version:</span> ${data.database.version}</div>
                        <div><span class="text-gray-400">Status:</span> 
                            <span class="${data.database.connected ? 'text-green-400' : 'text-red-400'}">
                                ${data.database.connected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="space-y-3">
                    <h3 class="text-lg font-medium text-yellow-400">Disk Space</h3>
                    <div class="w-full bg-gray-600 rounded-full h-4 mb-2">
                        <div class="h-4 rounded-full ${data.disk.free_percent < 10 ? 'bg-red-500' : data.disk.free_percent < 25 ? 'bg-yellow-500' : 'bg-green-500'}" 
                             style="width: ${100 - data.disk.free_percent}%"></div>
                    </div>
                    <div class="text-sm text-gray-400">${data.disk.free_percent}% free</div>
                </div>
                <div class="space-y-3">
                    <h3 class="text-lg font-medium text-red-400">SMTP Connectivity</h3>
                    <div class="space-y-2">
                        ${Object.entries(data.smtp_connectivity).map(([name, info]) => `
                            <div class="flex items-center justify-between text-sm">
                                <span>${name}</span>
                                <span class="${info.reachable ? 'text-green-400' : 'text-red-400'}">
                                    ${info.reachable ? '✓ Reachable' : '✗ Unreachable'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="space-y-3">
                    <h3 class="text-lg font-medium text-cyan-400">Server Info</h3>
                    <div class="text-sm space-y-1">
                        <div><span class="text-gray-400">OS:</span> ${data.server.os}</div>
                        <div><span class="text-gray-400">Software:</span> ${data.server.software}</div>
                        <div><span class="text-gray-400">Host:</span> ${data.server.hostname}</div>
                    </div>
                </div>
            `;
            document.getElementById('diagnostics').innerHTML = html;
        }

        async function refreshAll() {
            await Promise.all([
                refreshOverview(),
                refreshMailboxHealth(),
                refreshActivity(),
                refreshAlerts(),
                refreshDiagnostics()
            ]);
            document.getElementById('lastUpdate').textContent = 'Last updated: ' + new Date().toLocaleTimeString();
        }

        // Initial load
        refreshAll();
        
        // Auto-refresh every 30 seconds
        setInterval(refreshAll, 30000);
    </script>
</body>
</html>
