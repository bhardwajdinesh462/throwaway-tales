<?php
/**
 * Health Dashboard - Real-time System Monitoring
 * 
 * Displays live status of:
 * - Database health
 * - IMAP polling status
 * - Webhook deliveries
 * - System metrics
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

$healthApiUrl = '/api/health.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Health Dashboard - Admin</title>
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
        
        .container { max-width: 1400px; margin: 0 auto; }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
        }
        
        .header h1 {
            font-size: 1.75rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        
        .header-actions {
            display: flex;
            gap: 1rem;
            align-items: center;
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
        }
        
        .btn-primary { background: var(--primary); }
        .btn-secondary { background: var(--card); border: 1px solid var(--border); }
        
        .overall-status {
            padding: 1.5rem;
            border-radius: 1rem;
            margin-bottom: 2rem;
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        
        .overall-status.healthy { background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); }
        .overall-status.degraded { background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); }
        .overall-status.unhealthy { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); }
        
        .status-icon {
            width: 3rem;
            height: 3rem;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
        }
        
        .healthy .status-icon { background: var(--success); }
        .degraded .status-icon { background: var(--warning); }
        .unhealthy .status-icon { background: var(--danger); }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 1.5rem;
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
            display: flex;
            align-items: center;
            gap: 0.5rem;
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
        .status-degraded { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
        .status-unhealthy { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
        .status-disabled { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }
        .status-error { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
        
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
        }
        
        .metric {
            padding: 0.75rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 0.5rem;
        }
        
        .metric-label {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-bottom: 0.25rem;
        }
        
        .metric-value {
            font-size: 1.25rem;
            font-weight: 600;
        }
        
        .log-list {
            max-height: 200px;
            overflow-y: auto;
        }
        
        .log-item {
            padding: 0.5rem 0;
            border-bottom: 1px solid var(--border);
            font-size: 0.8rem;
        }
        
        .log-item:last-child { border-bottom: none; }
        
        .log-time { color: var(--text-muted); }
        .log-error { color: #fca5a5; }
        .log-success { color: #86efac; }
        
        .chart-container {
            height: 150px;
            display: flex;
            align-items: flex-end;
            gap: 4px;
            padding-top: 1rem;
        }
        
        .chart-bar {
            flex: 1;
            background: var(--primary);
            border-radius: 4px 4px 0 0;
            min-height: 4px;
            position: relative;
        }
        
        .chart-bar:hover::after {
            content: attr(data-count);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            padding: 0.25rem 0.5rem;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 0.25rem;
            font-size: 0.75rem;
            white-space: nowrap;
        }
        
        .refresh-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
            color: var(--text-muted);
        }
        
        .spinner {
            width: 1rem;
            height: 1rem;
            border: 2px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 4rem;
            color: var(--text-muted);
        }
        
        .loading .spinner {
            width: 3rem;
            height: 3rem;
            margin-bottom: 1rem;
        }
        
        .empty-state {
            text-align: center;
            padding: 2rem;
            color: var(--text-muted);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 Health Dashboard</h1>
            <div class="header-actions">
                <div class="refresh-indicator" id="refreshIndicator">
                    <span id="lastUpdate">Loading...</span>
                </div>
                <button class="btn btn-secondary" onclick="loadHealth()">
                    ↻ Refresh
                </button>
                <a href="settings.php" class="btn btn-primary">⚙️ Settings</a>
                <a href="/admin" class="btn btn-secondary">← Back to Admin</a>
            </div>
        </div>
        
        <div id="content">
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading health data...</p>
            </div>
        </div>
    </div>
    
    <script>
    let autoRefreshInterval;
    
    async function loadHealth() {
        try {
            document.getElementById('refreshIndicator').innerHTML = '<div class="spinner"></div> <span>Refreshing...</span>';
            
            const response = await fetch('/api/health.php', {
                headers: {
                    'Authorization': 'Bearer ' + (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '')
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch health data');
            }
            
            const data = await response.json();
            renderDashboard(data);
            
            document.getElementById('refreshIndicator').innerHTML = '<span id="lastUpdate">Updated ' + new Date().toLocaleTimeString() + '</span>';
            
        } catch (error) {
            console.error('Health check error:', error);
            document.getElementById('content').innerHTML = `
                <div class="overall-status unhealthy">
                    <div class="status-icon">❌</div>
                    <div>
                        <h2>Health Check Failed</h2>
                        <p>${error.message}</p>
                    </div>
                </div>
            `;
        }
    }
    
    function renderDashboard(data) {
        const statusColors = {
            healthy: 'status-healthy',
            degraded: 'status-degraded',
            unhealthy: 'status-unhealthy',
            disabled: 'status-disabled',
            error: 'status-error',
            stale: 'status-degraded',
            no_activity: 'status-disabled',
            not_configured: 'status-disabled',
            enabled: 'status-healthy',
        };
        
        const statusIcons = {
            healthy: '✓',
            degraded: '!',
            unhealthy: '✗',
        };
        
        let html = `
            <div class="overall-status ${data.status}">
                <div class="status-icon">${statusIcons[data.status] || '?'}</div>
                <div>
                    <h2>System ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</h2>
                    <p>Response time: ${data.response_time_ms}ms • ${new Date(data.timestamp).toLocaleString()}</p>
                </div>
            </div>
            
            <div class="grid">
        `;
        
        // Database Card
        const db = data.checks?.database || {};
        html += `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">🗄️ Database</h3>
                    <span class="status-badge ${statusColors[db.status] || 'status-disabled'}">${db.status || 'unknown'}</span>
                </div>
                ${db.error ? `<p class="log-error">${db.error}</p>` : `
                <div class="metric-grid">
                    <div class="metric">
                        <div class="metric-label">Latency</div>
                        <div class="metric-value">${db.latency_ms || 0}ms</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Active Emails</div>
                        <div class="metric-value">${(db.active_emails || 0).toLocaleString()}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Received</div>
                        <div class="metric-value">${(db.received_emails || 0).toLocaleString()}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Users</div>
                        <div class="metric-value">${(db.total_users || 0).toLocaleString()}</div>
                    </div>
                </div>
                `}
            </div>
        `;
        
        // IMAP Card
        const imap = data.checks?.imap || {};
        html += `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">📥 IMAP Polling</h3>
                    <span class="status-badge ${statusColors[imap.status] || 'status-disabled'}">${imap.status || 'unknown'}</span>
                </div>
                ${!imap.enabled ? `<p class="empty-state">IMAP polling is disabled. <a href="settings.php">Configure IMAP →</a></p>` : `
                <div class="metric-grid">
                    <div class="metric">
                        <div class="metric-label">Last Poll</div>
                        <div class="metric-value">${imap.last_successful_poll ? new Date(imap.last_successful_poll).toLocaleTimeString() : 'Never'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Mailboxes</div>
                        <div class="metric-value">${(imap.mailboxes?.length || 0)}</div>
                    </div>
                </div>
                ${imap.recent_jobs?.length ? `
                <div class="log-list" style="margin-top: 1rem;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">Recent Jobs</div>
                    ${imap.recent_jobs.map(j => `
                        <div class="log-item">
                            <span class="log-time">${new Date(j.started).toLocaleTimeString()}</span>
                            <span class="${j.status === 'completed' ? 'log-success' : 'log-error'}">${j.status}</span>
                            ${j.records ? `(${j.records} records)` : ''}
                        </div>
                    `).join('')}
                </div>
                ` : ''}
                `}
            </div>
        `;
        
        // Webhook Card
        const webhook = data.checks?.webhook || {};
        html += `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">🔗 Webhooks</h3>
                    <span class="status-badge ${statusColors[webhook.status] || 'status-disabled'}">${webhook.status || 'unknown'}</span>
                </div>
                ${!webhook.enabled ? `<p class="empty-state">Webhooks are disabled. <a href="settings.php">Configure Webhooks →</a></p>` : `
                <div class="metric-grid">
                    <div class="metric">
                        <div class="metric-label">Last 24h Total</div>
                        <div class="metric-value">${(webhook.last_24h?.total || 0).toLocaleString()}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Success Rate</div>
                        <div class="metric-value">${webhook.last_24h?.success_rate ?? 'N/A'}%</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Success</div>
                        <div class="metric-value log-success">${(webhook.last_24h?.success || 0).toLocaleString()}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Failed</div>
                        <div class="metric-value log-error">${(webhook.last_24h?.failed || 0).toLocaleString()}</div>
                    </div>
                </div>
                ${webhook.recent_errors?.length ? `
                <div class="log-list" style="margin-top: 1rem;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">Recent Errors</div>
                    ${webhook.recent_errors.map(e => `
                        <div class="log-item log-error">
                            <span class="log-time">${new Date(e.time).toLocaleTimeString()}</span>
                            ${e.to}: ${e.error || 'Unknown error'}
                        </div>
                    `).join('')}
                </div>
                ` : ''}
                `}
            </div>
        `;
        
        // SMTP Card
        const smtp = data.checks?.smtp || {};
        html += `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">📤 SMTP</h3>
                    <span class="status-badge ${statusColors[smtp.status] || 'status-disabled'}">${smtp.status || 'unknown'}</span>
                </div>
                ${!smtp.enabled ? `<p class="empty-state">SMTP is disabled. <a href="settings.php">Configure SMTP →</a></p>` : `
                <div class="metric-grid">
                    <div class="metric">
                        <div class="metric-label">Host</div>
                        <div class="metric-value" style="font-size: 0.875rem;">${smtp.host || 'Not set'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Sent (24h)</div>
                        <div class="metric-value">${(smtp.last_24h?.success || 0)}</div>
                    </div>
                </div>
                `}
            </div>
        `;
        
        // Email Chart Card
        const emails7d = data.metrics?.emails_7d || [];
        if (emails7d.length > 0) {
            const maxCount = Math.max(...emails7d.map(e => e.count));
            html += `
                <div class="card" style="grid-column: span 2;">
                    <div class="card-header">
                        <h3 class="card-title">📊 Emails Received (7 Days)</h3>
                    </div>
                    <div class="chart-container">
                        ${emails7d.reverse().map(e => {
                            const height = maxCount > 0 ? (e.count / maxCount * 100) : 0;
                            return `<div class="chart-bar" style="height: ${Math.max(height, 5)}%;" data-count="${e.count} on ${e.date}"></div>`;
                        }).join('')}
                    </div>
                </div>
            `;
        }
        
        // System Metrics Card
        const metrics = data.metrics || {};
        html += `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">💻 System</h3>
                </div>
                <div class="metric-grid">
                    <div class="metric">
                        <div class="metric-label">PHP Version</div>
                        <div class="metric-value">${metrics.php_version || 'Unknown'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Memory Usage</div>
                        <div class="metric-value">${metrics.memory_usage_mb || 0} MB</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Memory Limit</div>
                        <div class="metric-value">${metrics.memory_limit || 'Unknown'}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Disk Free</div>
                        <div class="metric-value">${metrics.disk_free_gb || 0} GB</div>
                    </div>
                </div>
            </div>
        `;
        
        html += '</div>'; // Close grid
        
        document.getElementById('content').innerHTML = html;
    }
    
    // Initial load
    loadHealth();
    
    // Auto-refresh every 30 seconds
    autoRefreshInterval = setInterval(loadHealth, 30000);
    </script>
</body>
</html>
