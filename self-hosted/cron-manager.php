<?php
/**
 * Cron Job Manager
 * 
 * Shows scheduled tasks, last run times, and allows manual triggering
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
$message = null;
$messageType = 'info';

// Define available cron jobs
$cronJobs = [
    [
        'id' => 'cleanup',
        'name' => 'Cleanup Expired Emails',
        'description' => 'Deletes expired temporary emails and their received messages',
        'script' => 'api/cron/cleanup.php',
        'recommended_schedule' => 'Every 5 minutes',
        'cron_syntax' => '*/5 * * * *',
    ],
    [
        'id' => 'sessions',
        'name' => 'Session Cleanup',
        'description' => 'Removes expired user sessions from the database',
        'script' => 'api/cron/sessions.php',
        'recommended_schedule' => 'Every hour',
        'cron_syntax' => '0 * * * *',
    ],
    [
        'id' => 'imap_poll',
        'name' => 'IMAP Email Polling',
        'description' => 'Fetches new emails from configured IMAP mailboxes',
        'script' => 'api/imap/poll.php',
        'recommended_schedule' => 'Every 2 minutes',
        'cron_syntax' => '*/2 * * * *',
    ],
    [
        'id' => 'stats_update',
        'name' => 'Statistics Update',
        'description' => 'Updates daily email statistics for analytics',
        'script' => 'api/cron/stats.php',
        'recommended_schedule' => 'Every hour',
        'cron_syntax' => '0 * * * *',
    ],
    [
        'id' => 'backup',
        'name' => 'Database Backup',
        'description' => 'Creates automated database backups',
        'script' => 'api/cron/backup.php',
        'recommended_schedule' => 'Daily at 2 AM',
        'cron_syntax' => '0 2 * * *',
    ],
];

// Handle manual trigger
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['trigger'])) {
    $jobId = $_POST['trigger'];
    $job = array_filter($cronJobs, fn($j) => $j['id'] === $jobId);
    $job = reset($job);
    
    if ($job) {
        $scriptPath = __DIR__ . '/' . $job['script'];
        
        if (file_exists($scriptPath)) {
            // Record start
            $runId = bin2hex(random_bytes(16));
            $stmt = $db->prepare("
                INSERT INTO cron_runs (id, job_name, status, started_at, metadata)
                VALUES (?, ?, 'running', NOW(), ?)
            ");
            $stmt->execute([$runId, $job['id'], json_encode(['triggered_by' => $currentUser['email'] ?? 'admin', 'manual' => true])]);
            
            $startTime = microtime(true);
            
            try {
                // Capture output
                ob_start();
                include $scriptPath;
                $output = ob_get_clean();
                
                $duration = round((microtime(true) - $startTime) * 1000);
                
                // Update run record
                $stmt = $db->prepare("
                    UPDATE cron_runs 
                    SET status = 'completed', completed_at = NOW(), duration_ms = ?, metadata = JSON_SET(metadata, '$.output', ?)
                    WHERE id = ?
                ");
                $stmt->execute([$duration, substr($output, 0, 1000), $runId]);
                
                $message = "Job '{$job['name']}' completed successfully in {$duration}ms";
                $messageType = 'success';
                
            } catch (Exception $e) {
                $stmt = $db->prepare("
                    UPDATE cron_runs 
                    SET status = 'failed', completed_at = NOW(), error_message = ?
                    WHERE id = ?
                ");
                $stmt->execute([$e->getMessage(), $runId]);
                
                $message = "Job '{$job['name']}' failed: " . $e->getMessage();
                $messageType = 'error';
            }
        } else {
            $message = "Script not found: {$job['script']}";
            $messageType = 'error';
        }
    }
}

// Get recent runs for each job
$recentRuns = [];
try {
    $stmt = $db->query("
        SELECT job_name, status, started_at, completed_at, duration_ms, error_message, 
               JSON_EXTRACT(metadata, '$.manual') as is_manual,
               records_processed
        FROM cron_runs 
        ORDER BY started_at DESC
        LIMIT 100
    ");
    $allRuns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($allRuns as $run) {
        $jobName = $run['job_name'];
        if (!isset($recentRuns[$jobName])) {
            $recentRuns[$jobName] = [];
        }
        if (count($recentRuns[$jobName]) < 5) {
            $recentRuns[$jobName][] = $run;
        }
    }
} catch (Exception $e) {
    // Table might not exist
}

// Get last successful run for each job
$lastSuccess = [];
foreach ($recentRuns as $jobName => $runs) {
    foreach ($runs as $run) {
        if ($run['status'] === 'completed') {
            $lastSuccess[$jobName] = $run['completed_at'];
            break;
        }
    }
}

$siteUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cron Jobs - Admin</title>
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
        }
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            padding: 2rem;
        }
        
        .container { max-width: 1200px; margin: 0 auto; }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
        }
        
        .header h1 { font-size: 1.75rem; }
        
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
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
        .btn-primary { background: var(--primary); border-color: var(--primary); }
        .btn-success { background: var(--success); border-color: var(--success); }
        .btn-sm { padding: 0.375rem 0.75rem; font-size: 0.8rem; }
        
        .alert {
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1.5rem;
        }
        
        .alert-success { background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); color: #86efac; }
        .alert-error { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; }
        .alert-info { background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); color: #93c5fd; }
        
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            margin-bottom: 1rem;
            overflow: hidden;
        }
        
        .job-header {
            padding: 1.25rem;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 1rem;
        }
        
        .job-info { flex: 1; }
        
        .job-name {
            font-size: 1.125rem;
            font-weight: 600;
            margin-bottom: 0.25rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .job-description {
            color: var(--text-muted);
            font-size: 0.875rem;
            margin-bottom: 0.5rem;
        }
        
        .job-meta {
            display: flex;
            gap: 1.5rem;
            font-size: 0.75rem;
            color: var(--text-muted);
        }
        
        .job-actions {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            align-items: flex-end;
        }
        
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        .status-healthy { background: rgba(34, 197, 94, 0.2); color: #86efac; }
        .status-warning { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
        .status-error { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
        .status-pending { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }
        
        .job-history {
            border-top: 1px solid var(--border);
            padding: 1rem 1.25rem;
            background: rgba(0, 0, 0, 0.2);
        }
        
        .history-title {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-bottom: 0.5rem;
        }
        
        .history-list {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        
        .history-item {
            padding: 0.375rem 0.75rem;
            background: var(--card);
            border-radius: 0.375rem;
            font-size: 0.75rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .history-item.completed { border-left: 3px solid var(--success); }
        .history-item.failed { border-left: 3px solid var(--danger); }
        .history-item.running { border-left: 3px solid var(--warning); }
        
        .code-box {
            background: rgba(0, 0, 0, 0.4);
            padding: 1rem;
            border-radius: 0.5rem;
            font-family: monospace;
            font-size: 0.8rem;
            overflow-x: auto;
            margin-top: 0.5rem;
        }
        
        .section-title {
            font-size: 1.25rem;
            margin: 2rem 0 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .setup-guide {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 1.5rem;
        }
        
        .setup-guide h3 {
            margin-bottom: 1rem;
        }
        
        .setup-guide ol {
            padding-left: 1.5rem;
            color: var(--text-muted);
        }
        
        .setup-guide li {
            margin-bottom: 0.75rem;
        }
        
        .spinner {
            width: 1rem;
            height: 1rem;
            border: 2px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            display: none;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .loading .spinner { display: inline-block; }
        .loading .btn-text { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Cron Job Manager</h1>
            <a href="/admin" class="btn">← Back to Admin</a>
        </div>
        
        <?php if ($message): ?>
        <div class="alert alert-<?= $messageType ?>">
            <?= htmlspecialchars($message) ?>
        </div>
        <?php endif; ?>
        
        <!-- Cron Jobs List -->
        <?php foreach ($cronJobs as $job): 
            $runs = $recentRuns[$job['id']] ?? [];
            $lastRun = $runs[0] ?? null;
            $lastSuccessTime = $lastSuccess[$job['id']] ?? null;
            
            // Determine status
            $status = 'pending';
            if ($lastRun) {
                if ($lastRun['status'] === 'running') {
                    $status = 'running';
                } elseif ($lastRun['status'] === 'failed') {
                    $status = 'error';
                } elseif ($lastSuccessTime && strtotime($lastSuccessTime) > strtotime('-1 hour')) {
                    $status = 'healthy';
                } elseif ($lastSuccessTime) {
                    $status = 'warning';
                }
            }
            
            $scriptExists = file_exists(__DIR__ . '/' . $job['script']);
        ?>
        <div class="card">
            <div class="job-header">
                <div class="job-info">
                    <div class="job-name">
                        <?= $job['id'] === 'imap_poll' ? '📥' : ($job['id'] === 'cleanup' ? '🧹' : ($job['id'] === 'backup' ? '💾' : '⚙️')) ?>
                        <?= htmlspecialchars($job['name']) ?>
                        <?php if (!$scriptExists): ?>
                        <span class="status-badge status-pending">Script Missing</span>
                        <?php endif; ?>
                    </div>
                    <div class="job-description"><?= htmlspecialchars($job['description']) ?></div>
                    <div class="job-meta">
                        <span>📂 <?= htmlspecialchars($job['script']) ?></span>
                        <span>🕐 <?= htmlspecialchars($job['recommended_schedule']) ?></span>
                        <?php if ($lastSuccessTime): ?>
                        <span>✅ Last success: <?= date('M j, H:i', strtotime($lastSuccessTime)) ?></span>
                        <?php endif; ?>
                    </div>
                </div>
                <div class="job-actions">
                    <span class="status-badge status-<?= $status ?>">
                        <?= $status === 'healthy' ? '● Running' : ($status === 'warning' ? '! Stale' : ($status === 'error' ? '✗ Failed' : ($status === 'running' ? '↻ Running' : '○ Not Run'))) ?>
                    </span>
                    <form method="POST" style="display: inline;" onsubmit="this.querySelector('.btn').classList.add('loading')">
                        <input type="hidden" name="trigger" value="<?= $job['id'] ?>">
                        <button type="submit" class="btn btn-primary btn-sm" <?= !$scriptExists ? 'disabled' : '' ?>>
                            <span class="spinner"></span>
                            <span class="btn-text">▶ Run Now</span>
                        </button>
                    </form>
                </div>
            </div>
            
            <?php if (!empty($runs)): ?>
            <div class="job-history">
                <div class="history-title">Recent Runs</div>
                <div class="history-list">
                    <?php foreach ($runs as $run): ?>
                    <div class="history-item <?= $run['status'] ?>">
                        <span><?= $run['status'] === 'completed' ? '✓' : ($run['status'] === 'failed' ? '✗' : '↻') ?></span>
                        <span><?= date('M j H:i', strtotime($run['started_at'])) ?></span>
                        <?php if ($run['duration_ms']): ?>
                        <span style="color: var(--text-muted)"><?= $run['duration_ms'] ?>ms</span>
                        <?php endif; ?>
                        <?php if ($run['is_manual']): ?>
                        <span style="color: var(--warning)">manual</span>
                        <?php endif; ?>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php endif; ?>
        </div>
        <?php endforeach; ?>
        
        <!-- Setup Guide -->
        <h2 class="section-title">📋 Cron Setup Guide</h2>
        
        <div class="setup-guide">
            <h3>Setting up Cron Jobs in cPanel</h3>
            <ol>
                <li>Login to your cPanel dashboard</li>
                <li>Go to <strong>"Cron Jobs"</strong> under the "Advanced" section</li>
                <li>Add the following cron jobs:</li>
            </ol>
            
            <div style="margin-top: 1rem;">
                <strong>Recommended Cron Commands:</strong>
            </div>
            
            <?php foreach ($cronJobs as $job): ?>
            <div style="margin-top: 1rem;">
                <div style="font-weight: 500; margin-bottom: 0.25rem;"><?= $job['name'] ?> (<?= $job['recommended_schedule'] ?>)</div>
                <div class="code-box"><?= $job['cron_syntax'] ?> /usr/bin/php <?= htmlspecialchars($_SERVER['DOCUMENT_ROOT']) ?>/<?= $job['script'] ?> >> /dev/null 2>&1</div>
            </div>
            <?php endforeach; ?>
            
            <div style="margin-top: 1.5rem;">
                <strong>Alternative: Using wget/curl</strong>
                <div class="code-box">*/5 * * * * /usr/bin/wget -q -O /dev/null <?= $siteUrl ?>/api/cron/cleanup.php</div>
            </div>
            
            <div class="alert alert-info" style="margin-top: 1.5rem;">
                💡 <strong>Tip:</strong> If using a web-based cron service like cron-job.org, use the full URL:
                <div class="code-box" style="margin-top: 0.5rem;"><?= $siteUrl ?>/api/cron/cleanup.php</div>
            </div>
        </div>
    </div>
</body>
</html>
