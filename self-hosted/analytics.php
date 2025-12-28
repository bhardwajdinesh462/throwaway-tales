<?php
/**
 * Email Analytics Dashboard
 * 
 * Shows email statistics with charts for:
 * - Daily/Weekly/Monthly trends
 * - Domain breakdown
 * - Peak hours
 * - User activity
 */

session_start();
require_once __DIR__ . '/api/core/database.php';
require_once __DIR__ . '/api/core/auth.php';

// Check authentication
$isAuthenticated = false;
try {
    $currentUser = Auth::getCurrentUser();
    if ($currentUser && in_array($currentUser['role'] ?? '', ['admin', 'super_admin'])) {
        $isAuthenticated = true;
    }
} catch (Exception $e) {}

if (!$isAuthenticated) {
    header('Location: /admin/login');
    exit;
}

$db = Database::getConnection();

// Get period from query string
$period = $_GET['period'] ?? '7d';
$validPeriods = ['24h', '7d', '30d', '90d', '1y'];
if (!in_array($period, $validPeriods)) {
    $period = '7d';
}

// Calculate date range
$periodMap = [
    '24h' => '-24 hours',
    '7d' => '-7 days',
    '30d' => '-30 days',
    '90d' => '-90 days',
    '1y' => '-1 year',
];
$startDate = date('Y-m-d H:i:s', strtotime($periodMap[$period]));

// Fetch analytics data
$analytics = [];

try {
    // Total emails received
    $stmt = $db->prepare("
        SELECT COUNT(*) as total,
               SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) as read_count,
               SUM(has_attachments) as with_attachments,
               SUM(is_spam) as spam_count
        FROM received_emails 
        WHERE received_at >= ?
    ");
    $stmt->execute([$startDate]);
    $analytics['totals'] = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Temp emails created
    $stmt = $db->prepare("SELECT COUNT(*) FROM temp_emails WHERE created_at >= ?");
    $stmt->execute([$startDate]);
    $analytics['emails_created'] = $stmt->fetchColumn();
    
    // Active users
    $stmt = $db->prepare("
        SELECT COUNT(DISTINCT user_id) 
        FROM temp_emails 
        WHERE user_id IS NOT NULL AND created_at >= ?
    ");
    $stmt->execute([$startDate]);
    $analytics['active_users'] = $stmt->fetchColumn();
    
    // New registrations
    $stmt = $db->prepare("SELECT COUNT(*) FROM users WHERE created_at >= ?");
    $stmt->execute([$startDate]);
    $analytics['new_users'] = $stmt->fetchColumn();
    
    // Daily breakdown (for chart)
    $groupBy = $period === '24h' ? 'HOUR(received_at)' : 'DATE(received_at)';
    $stmt = $db->prepare("
        SELECT 
            " . ($period === '24h' ? "HOUR(received_at) as label" : "DATE(received_at) as label") . ",
            COUNT(*) as count
        FROM received_emails 
        WHERE received_at >= ?
        GROUP BY label
        ORDER BY label ASC
    ");
    $stmt->execute([$startDate]);
    $analytics['daily_chart'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Domain breakdown
    $stmt = $db->prepare("
        SELECT 
            SUBSTRING_INDEX(te.email_address, '@', -1) as domain,
            COUNT(re.id) as count
        FROM received_emails re
        JOIN temp_emails te ON re.temp_email_id = te.id
        WHERE re.received_at >= ?
        GROUP BY domain
        ORDER BY count DESC
        LIMIT 10
    ");
    $stmt->execute([$startDate]);
    $analytics['by_domain'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Peak hours (all time for accuracy)
    $stmt = $db->query("
        SELECT 
            HOUR(received_at) as hour,
            COUNT(*) as count
        FROM received_emails
        GROUP BY hour
        ORDER BY hour ASC
    ");
    $analytics['peak_hours'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Top senders
    $stmt = $db->prepare("
        SELECT 
            SUBSTRING_INDEX(from_address, '@', -1) as sender_domain,
            COUNT(*) as count
        FROM received_emails 
        WHERE received_at >= ?
        GROUP BY sender_domain
        ORDER BY count DESC
        LIMIT 10
    ");
    $stmt->execute([$startDate]);
    $analytics['top_senders'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Weekly comparison
    $stmt = $db->query("
        SELECT 
            YEARWEEK(received_at, 1) as week,
            COUNT(*) as count
        FROM received_emails
        WHERE received_at >= DATE_SUB(NOW(), INTERVAL 8 WEEK)
        GROUP BY week
        ORDER BY week ASC
    ");
    $analytics['weekly_trend'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Average emails per day
    $dayCount = max(1, (strtotime('now') - strtotime($startDate)) / 86400);
    $analytics['avg_per_day'] = round(($analytics['totals']['total'] ?? 0) / $dayCount, 1);
    
} catch (Exception $e) {
    $analytics['error'] = $e->getMessage();
}

// Prepare chart data
$chartLabels = json_encode(array_column($analytics['daily_chart'] ?? [], 'label'));
$chartData = json_encode(array_column($analytics['daily_chart'] ?? [], 'count'));

$domainLabels = json_encode(array_column($analytics['by_domain'] ?? [], 'domain'));
$domainData = json_encode(array_column($analytics['by_domain'] ?? [], 'count'));

$hourLabels = json_encode(array_map(fn($h) => sprintf('%02d:00', $h['hour']), $analytics['peak_hours'] ?? []));
$hourData = json_encode(array_column($analytics['peak_hours'] ?? [], 'count'));
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Analytics - Admin</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <style>
        :root {
            --bg: #0f172a;
            --card: #1e293b;
            --border: #334155;
            --text: #f1f5f9;
            --text-muted: #94a3b8;
            --primary: #3b82f6;
            --success: #22c55e;
            --warning: #f59e0b;
            --danger: #ef4444;
            --purple: #8b5cf6;
            --cyan: #06b6d4;
        }
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            padding: 2rem;
        }
        
        .container { max-width: 1400px; margin: 0 auto; }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            flex-wrap: wrap;
            gap: 1rem;
        }
        
        .header h1 {
            font-size: 1.75rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        
        .header-actions {
            display: flex;
            gap: 0.5rem;
        }
        
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.625rem 1.25rem;
            border: none;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            cursor: pointer;
            text-decoration: none;
            color: var(--text);
            background: var(--card);
            border: 1px solid var(--border);
        }
        
        .btn:hover { background: var(--border); }
        .btn.active { background: var(--primary); border-color: var(--primary); }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .stat-card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 1.25rem;
        }
        
        .stat-label {
            font-size: 0.75rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.5rem;
        }
        
        .stat-value {
            font-size: 2rem;
            font-weight: 700;
        }
        
        .stat-change {
            font-size: 0.75rem;
            margin-top: 0.25rem;
        }
        
        .stat-change.positive { color: var(--success); }
        .stat-change.negative { color: var(--danger); }
        
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        @media (max-width: 768px) {
            .charts-grid { grid-template-columns: 1fr; }
        }
        
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 1.5rem;
        }
        
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        
        .card-title {
            font-size: 1rem;
            font-weight: 600;
        }
        
        .chart-container {
            position: relative;
            height: 250px;
        }
        
        .list-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 0;
            border-bottom: 1px solid var(--border);
        }
        
        .list-item:last-child { border-bottom: none; }
        
        .list-rank {
            width: 1.5rem;
            height: 1.5rem;
            border-radius: 50%;
            background: var(--border);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            margin-right: 0.75rem;
        }
        
        .list-name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .list-value {
            font-weight: 600;
            color: var(--primary);
        }
        
        .progress-bar {
            height: 0.5rem;
            background: var(--border);
            border-radius: 9999px;
            margin-top: 0.5rem;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background: var(--primary);
            border-radius: 9999px;
        }
        
        .full-width { grid-column: 1 / -1; }
        
        .empty-state {
            text-align: center;
            padding: 3rem;
            color: var(--text-muted);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Email Analytics</h1>
            <div class="header-actions">
                <a href="?period=24h" class="btn <?= $period === '24h' ? 'active' : '' ?>">24h</a>
                <a href="?period=7d" class="btn <?= $period === '7d' ? 'active' : '' ?>">7 Days</a>
                <a href="?period=30d" class="btn <?= $period === '30d' ? 'active' : '' ?>">30 Days</a>
                <a href="?period=90d" class="btn <?= $period === '90d' ? 'active' : '' ?>">90 Days</a>
                <a href="?period=1y" class="btn <?= $period === '1y' ? 'active' : '' ?>">1 Year</a>
                <a href="/admin" class="btn">← Back</a>
            </div>
        </div>
        
        <!-- Stats Cards -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Emails Received</div>
                <div class="stat-value"><?= number_format($analytics['totals']['total'] ?? 0) ?></div>
                <div class="stat-change positive">~<?= $analytics['avg_per_day'] ?>/day avg</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Temp Emails Created</div>
                <div class="stat-value"><?= number_format($analytics['emails_created'] ?? 0) ?></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Read Rate</div>
                <div class="stat-value">
                    <?php 
                    $total = $analytics['totals']['total'] ?? 0;
                    $read = $analytics['totals']['read_count'] ?? 0;
                    echo $total > 0 ? round(($read / $total) * 100, 1) . '%' : '0%';
                    ?>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-label">With Attachments</div>
                <div class="stat-value"><?= number_format($analytics['totals']['with_attachments'] ?? 0) ?></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Spam Blocked</div>
                <div class="stat-value" style="color: var(--danger)"><?= number_format($analytics['totals']['spam_count'] ?? 0) ?></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Active Users</div>
                <div class="stat-value"><?= number_format($analytics['active_users'] ?? 0) ?></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">New Registrations</div>
                <div class="stat-value" style="color: var(--success)"><?= number_format($analytics['new_users'] ?? 0) ?></div>
            </div>
        </div>
        
        <!-- Charts -->
        <div class="charts-grid">
            <!-- Main Trend Chart -->
            <div class="card full-width">
                <div class="card-header">
                    <h3 class="card-title">📈 Email Volume Trend</h3>
                </div>
                <div class="chart-container">
                    <canvas id="trendChart"></canvas>
                </div>
            </div>
            
            <!-- Domain Breakdown -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">🌐 By Domain</h3>
                </div>
                <?php if (!empty($analytics['by_domain'])): ?>
                <div class="chart-container" style="height: 200px;">
                    <canvas id="domainChart"></canvas>
                </div>
                <?php 
                $maxDomain = max(array_column($analytics['by_domain'], 'count'));
                foreach ($analytics['by_domain'] as $i => $d): 
                ?>
                <div class="list-item">
                    <span class="list-rank"><?= $i + 1 ?></span>
                    <span class="list-name"><?= htmlspecialchars($d['domain']) ?></span>
                    <span class="list-value"><?= number_format($d['count']) ?></span>
                </div>
                <?php endforeach; ?>
                <?php else: ?>
                <div class="empty-state">No domain data available</div>
                <?php endif; ?>
            </div>
            
            <!-- Peak Hours -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">⏰ Peak Hours</h3>
                </div>
                <div class="chart-container">
                    <canvas id="hoursChart"></canvas>
                </div>
            </div>
            
            <!-- Top Senders -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">📧 Top Sender Domains</h3>
                </div>
                <?php if (!empty($analytics['top_senders'])): ?>
                <?php 
                $maxSender = max(array_column($analytics['top_senders'], 'count'));
                foreach ($analytics['top_senders'] as $i => $s): 
                ?>
                <div class="list-item">
                    <span class="list-rank"><?= $i + 1 ?></span>
                    <span class="list-name"><?= htmlspecialchars($s['sender_domain']) ?></span>
                    <span class="list-value"><?= number_format($s['count']) ?></span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: <?= ($s['count'] / $maxSender) * 100 ?>%"></div>
                </div>
                <?php endforeach; ?>
                <?php else: ?>
                <div class="empty-state">No sender data available</div>
                <?php endif; ?>
            </div>
            
            <!-- Weekly Trend -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">📅 Weekly Comparison</h3>
                </div>
                <?php if (!empty($analytics['weekly_trend'])): ?>
                <div class="chart-container">
                    <canvas id="weeklyChart"></canvas>
                </div>
                <?php else: ?>
                <div class="empty-state">No weekly data available</div>
                <?php endif; ?>
            </div>
        </div>
    </div>
    
    <script>
    // Chart.js configuration
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.borderColor = '#334155';
    
    // Main Trend Chart
    new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: <?= $chartLabels ?>,
            datasets: [{
                label: 'Emails Received',
                data: <?= $chartData ?>,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
    
    // Domain Chart
    <?php if (!empty($analytics['by_domain'])): ?>
    new Chart(document.getElementById('domainChart'), {
        type: 'doughnut',
        data: {
            labels: <?= $domainLabels ?>,
            datasets: [{
                data: <?= $domainData ?>,
                backgroundColor: [
                    '#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b',
                    '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316'
                ],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12 } }
            }
        }
    });
    <?php endif; ?>
    
    // Hours Chart
    <?php if (!empty($analytics['peak_hours'])): ?>
    new Chart(document.getElementById('hoursChart'), {
        type: 'bar',
        data: {
            labels: <?= $hourLabels ?>,
            datasets: [{
                label: 'Emails',
                data: <?= $hourData ?>,
                backgroundColor: 'rgba(139, 92, 246, 0.7)',
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
    <?php endif; ?>
    
    // Weekly Chart
    <?php if (!empty($analytics['weekly_trend'])): ?>
    new Chart(document.getElementById('weeklyChart'), {
        type: 'bar',
        data: {
            labels: <?= json_encode(array_map(fn($w) => 'Week ' . substr($w['week'], -2), $analytics['weekly_trend'])) ?>,
            datasets: [{
                label: 'Emails',
                data: <?= json_encode(array_column($analytics['weekly_trend'], 'count')) ?>,
                backgroundColor: 'rgba(6, 182, 212, 0.7)',
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
    <?php endif; ?>
    </script>
</body>
</html>
