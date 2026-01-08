<?php
/**
 * Analytics Dashboard - Comprehensive stats and charts
 * Displays user growth, email activity, and system metrics
 */

session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/helpers.php';

// CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Get config using helper
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

// Check admin auth using standalone functions
$user = getAuthUserStandalone($pdo, $config);
$isAdmin = $user && checkIsAdminStandalone($pdo, $user['id']);

if (!$isAdmin) {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['error' => 'Admin access required']);
    exit;
}

$period = $_GET['period'] ?? '7d';
$days = match($period) {
    '24h' => 1,
    '7d' => 7,
    '30d' => 30,
    '90d' => 90,
    default => 7
};

// Handle API requests
if (isset($_GET['api'])) {
    header('Content-Type: application/json');
    
    switch ($_GET['api']) {
        case 'summary':
            getSummaryStats($pdo, $days);
            break;
        case 'charts':
            getChartData($pdo, $days);
            break;
        case 'top-domains':
            getTopDomains($pdo, $days);
            break;
        case 'user-growth':
            getUserGrowth($pdo, $days);
            break;
        default:
            echo json_encode(['error' => 'Unknown API endpoint']);
    }
    exit;
}

function getSummaryStats($pdo, $days) {
    $stats = [];
    
    // Total users
    $stmt = $pdo->query("SELECT COUNT(*) FROM profiles");
    $stats['total_users'] = intval($stmt->fetchColumn());
    
    // New users in period
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM profiles WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)");
    $stmt->execute([$days]);
    $stats['new_users'] = intval($stmt->fetchColumn());
    
    // Total temp emails created
    $stmt = $pdo->query("SELECT COUNT(*) FROM temp_emails");
    $stats['total_temp_emails'] = intval($stmt->fetchColumn());
    
    // Temp emails in period
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM temp_emails WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)");
    $stmt->execute([$days]);
    $stats['period_temp_emails'] = intval($stmt->fetchColumn());
    
    // Total received emails
    $stmt = $pdo->query("SELECT COUNT(*) FROM received_emails");
    $stats['total_received'] = intval($stmt->fetchColumn());
    
    // Received in period
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM received_emails WHERE received_at >= DATE_SUB(NOW(), INTERVAL ? DAY)");
    $stmt->execute([$days]);
    $stats['period_received'] = intval($stmt->fetchColumn());
    
    // Email send stats
    $stmt = $pdo->prepare("
        SELECT 
            COUNT(*) as total,
            SUM(status = 'sent') as sent,
            SUM(status = 'failed') as failed
        FROM email_logs 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    ");
    $stmt->execute([$days]);
    $emailStats = $stmt->fetch(PDO::FETCH_ASSOC);
    $stats['emails_sent'] = intval($emailStats['sent']);
    $stats['emails_failed'] = intval($emailStats['failed']);
    $stats['success_rate'] = $emailStats['total'] > 0 
        ? round(($emailStats['sent'] / $emailStats['total']) * 100, 1) 
        : 100;
    
    // Premium users
    $stmt = $pdo->query("
        SELECT COUNT(*) FROM user_subscriptions us
        JOIN subscription_tiers st ON st.id = us.tier_id
        WHERE us.status = 'active' AND st.price_monthly > 0
    ");
    $stats['premium_users'] = intval($stmt->fetchColumn());
    
    // Active domains
    $stmt = $pdo->query("SELECT COUNT(*) FROM domains WHERE is_active = 1");
    $stats['active_domains'] = intval($stmt->fetchColumn());
    
    echo json_encode($stats);
}

function getChartData($pdo, $days) {
    $data = [];
    
    // User signups by day
    $stmt = $pdo->prepare("
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM profiles
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ");
    $stmt->execute([$days]);
    $data['signups'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Temp emails created by day
    $stmt = $pdo->prepare("
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM temp_emails
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ");
    $stmt->execute([$days]);
    $data['temp_emails'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Received emails by day
    $stmt = $pdo->prepare("
        SELECT DATE(received_at) as date, COUNT(*) as count
        FROM received_emails
        WHERE received_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(received_at)
        ORDER BY date ASC
    ");
    $stmt->execute([$days]);
    $data['received'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Sent emails by day (success vs failed)
    $stmt = $pdo->prepare("
        SELECT 
            DATE(created_at) as date,
            SUM(status = 'sent') as sent,
            SUM(status = 'failed') as failed
        FROM email_logs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ");
    $stmt->execute([$days]);
    $data['sent_emails'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode($data);
}

function getTopDomains($pdo, $days) {
    $stmt = $pdo->prepare("
        SELECT d.name, COUNT(te.id) as usage_count
        FROM domains d
        LEFT JOIN temp_emails te ON te.domain_id = d.id 
            AND te.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        WHERE d.is_active = 1
        GROUP BY d.id
        ORDER BY usage_count DESC
        LIMIT 10
    ");
    $stmt->execute([$days]);
    echo json_encode(['domains' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

function getUserGrowth($pdo, $days) {
    $stmt = $pdo->prepare("
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as new_users,
            SUM(COUNT(*)) OVER (ORDER BY DATE(created_at)) as cumulative
        FROM profiles
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ");
    $stmt->execute([$days]);
    echo json_encode(['growth' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Analytics Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-gray-900 text-white min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <div class="flex justify-between items-center mb-8">
            <h1 class="text-3xl font-bold">
                <i class="fas fa-chart-bar text-blue-500 mr-3"></i>
                Analytics Dashboard
            </h1>
            <div class="flex items-center gap-4">
                <select id="periodSelect" class="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d" selected>Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                </select>
            </div>
        </div>

        <!-- Summary Stats -->
        <div id="summaryStats" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"></div>

        <!-- Charts Row -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div class="bg-gray-800 rounded-xl p-6">
                <h2 class="text-xl font-semibold mb-4">User Signups</h2>
                <canvas id="signupsChart" height="200"></canvas>
            </div>
            <div class="bg-gray-800 rounded-xl p-6">
                <h2 class="text-xl font-semibold mb-4">Email Activity</h2>
                <canvas id="emailsChart" height="200"></canvas>
            </div>
        </div>

        <!-- Bottom Row -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="bg-gray-800 rounded-xl p-6">
                <h2 class="text-xl font-semibold mb-4">Top Domains</h2>
                <canvas id="domainsChart" height="200"></canvas>
            </div>
            <div class="bg-gray-800 rounded-xl p-6">
                <h2 class="text-xl font-semibold mb-4">Email Delivery</h2>
                <canvas id="deliveryChart" height="200"></canvas>
            </div>
        </div>
    </div>

    <script>
        let charts = {};
        
        async function fetchData(endpoint, period) {
            const res = await fetch(`?api=${endpoint}&period=${period}`, {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('nullsto_auth_token') }
            });
            return await res.json();
        }

        async function refreshDashboard() {
            const period = document.getElementById('periodSelect').value;
            
            // Summary stats
            const summary = await fetchData('summary', period);
            document.getElementById('summaryStats').innerHTML = `
                <div class="bg-gray-800 rounded-xl p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-400 text-sm">Total Users</p>
                            <p class="text-3xl font-bold">${summary.total_users.toLocaleString()}</p>
                            <p class="text-sm text-green-400">+${summary.new_users} new</p>
                        </div>
                        <i class="fas fa-users text-4xl text-blue-400"></i>
                    </div>
                </div>
                <div class="bg-gray-800 rounded-xl p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-400 text-sm">Temp Emails Created</p>
                            <p class="text-3xl font-bold">${summary.period_temp_emails.toLocaleString()}</p>
                            <p class="text-sm text-gray-400">${summary.total_temp_emails.toLocaleString()} total</p>
                        </div>
                        <i class="fas fa-at text-4xl text-green-400"></i>
                    </div>
                </div>
                <div class="bg-gray-800 rounded-xl p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-400 text-sm">Emails Received</p>
                            <p class="text-3xl font-bold">${summary.period_received.toLocaleString()}</p>
                            <p class="text-sm text-gray-400">${summary.total_received.toLocaleString()} total</p>
                        </div>
                        <i class="fas fa-envelope text-4xl text-purple-400"></i>
                    </div>
                </div>
                <div class="bg-gray-800 rounded-xl p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-400 text-sm">Delivery Success</p>
                            <p class="text-3xl font-bold">${summary.success_rate}%</p>
                            <p class="text-sm text-gray-400">${summary.emails_sent} sent / ${summary.emails_failed} failed</p>
                        </div>
                        <i class="fas fa-check-circle text-4xl text-yellow-400"></i>
                    </div>
                </div>
            `;

            // Charts
            const chartData = await fetchData('charts', period);
            const domains = await fetchData('top-domains', period);

            // Signups chart
            if (charts.signups) charts.signups.destroy();
            charts.signups = new Chart(document.getElementById('signupsChart'), {
                type: 'line',
                data: {
                    labels: chartData.signups.map(d => d.date),
                    datasets: [{
                        label: 'New Users',
                        data: chartData.signups.map(d => d.count),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.4
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

            // Emails chart
            if (charts.emails) charts.emails.destroy();
            charts.emails = new Chart(document.getElementById('emailsChart'), {
                type: 'bar',
                data: {
                    labels: chartData.temp_emails.map(d => d.date),
                    datasets: [{
                        label: 'Created',
                        data: chartData.temp_emails.map(d => d.count),
                        backgroundColor: '#10b981'
                    }, {
                        label: 'Received',
                        data: chartData.received.map(d => d.count),
                        backgroundColor: '#8b5cf6'
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

            // Domains chart
            if (charts.domains) charts.domains.destroy();
            charts.domains = new Chart(document.getElementById('domainsChart'), {
                type: 'doughnut',
                data: {
                    labels: domains.domains.map(d => d.name),
                    datasets: [{
                        data: domains.domains.map(d => d.usage_count),
                        backgroundColor: [
                            '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                            '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { position: 'right', labels: { color: '#9ca3af' } } }
                }
            });

            // Delivery chart
            if (charts.delivery) charts.delivery.destroy();
            charts.delivery = new Chart(document.getElementById('deliveryChart'), {
                type: 'line',
                data: {
                    labels: chartData.sent_emails.map(d => d.date),
                    datasets: [{
                        label: 'Sent',
                        data: chartData.sent_emails.map(d => d.sent),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true
                    }, {
                        label: 'Failed',
                        data: chartData.sent_emails.map(d => d.failed),
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
        }

        document.getElementById('periodSelect').addEventListener('change', refreshDashboard);
        refreshDashboard();
    </script>
</body>
</html>
