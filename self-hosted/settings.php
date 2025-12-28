<?php
/**
 * Settings Reconfiguration Page
 * 
 * Allows updating IMAP/SMTP/Webhook settings without full reinstall.
 * Only accessible by admin users.
 */

session_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/api/core/database.php';
require_once __DIR__ . '/api/core/auth.php';

// Check authentication
$isAuthenticated = false;
$currentUser = null;

try {
    $currentUser = Auth::getCurrentUser();
    if ($currentUser && in_array($currentUser['role'] ?? '', ['admin', 'super_admin'])) {
        $isAuthenticated = true;
    }
} catch (Exception $e) {
    // Not authenticated
}

if (!$isAuthenticated) {
    header('Location: /admin/login');
    exit;
}

$db = Database::getConnection();
$message = null;
$messageType = 'info';

// Load current settings
function getSettings(PDO $db): array {
    $settings = [];
    $stmt = $db->query("SELECT `key`, value FROM app_settings");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $decoded = json_decode($row['value'], true);
        $settings[$row['key']] = $decoded !== null ? $decoded : $row['value'];
    }
    return $settings;
}

function saveSetting(PDO $db, string $key, $value, string $type = 'string', string $category = 'general'): void {
    $jsonValue = is_string($value) ? $value : json_encode($value);
    
    $stmt = $db->prepare("
        INSERT INTO app_settings (id, `key`, value, value_type, category, updated_at)
        VALUES (UUID(), ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()
    ");
    $stmt->execute([$key, $jsonValue, $type, $category]);
}

// Load config file settings
$configFile = __DIR__ . '/api/config.php';
$config = file_exists($configFile) ? require $configFile : [];

$settings = getSettings($db);

// Handle form submissions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $action = $_POST['action'] ?? '';
        
        switch ($action) {
            case 'save_imap':
                $imapEnabled = isset($_POST['imap_enabled']);
                saveSetting($db, 'imap_enabled', $imapEnabled ? 'true' : 'false', 'boolean', 'imap');
                saveSetting($db, 'imap_host', $_POST['imap_host'] ?? '', 'string', 'imap');
                saveSetting($db, 'imap_port', (int)($_POST['imap_port'] ?? 993), 'number', 'imap');
                saveSetting($db, 'imap_username', $_POST['imap_username'] ?? '', 'string', 'imap');
                saveSetting($db, 'imap_encryption', $_POST['imap_encryption'] ?? 'ssl', 'string', 'imap');
                saveSetting($db, 'imap_poll_interval', (int)($_POST['imap_poll_interval'] ?? 120), 'number', 'imap');
                
                // Update config file if password provided
                if (!empty($_POST['imap_password'])) {
                    updateConfigFile('imap', [
                        'enabled' => $imapEnabled,
                        'host' => $_POST['imap_host'] ?? '',
                        'port' => (int)($_POST['imap_port'] ?? 993),
                        'username' => $_POST['imap_username'] ?? '',
                        'password' => $_POST['imap_password'],
                        'encryption' => $_POST['imap_encryption'] ?? 'ssl',
                    ]);
                }
                
                $message = 'IMAP settings saved successfully!';
                $messageType = 'success';
                break;
                
            case 'save_smtp':
                $smtpEnabled = isset($_POST['smtp_enabled']);
                saveSetting($db, 'smtp_enabled', $smtpEnabled ? 'true' : 'false', 'boolean', 'smtp');
                saveSetting($db, 'smtp_host', $_POST['smtp_host'] ?? '', 'string', 'smtp');
                saveSetting($db, 'smtp_port', (int)($_POST['smtp_port'] ?? 587), 'number', 'smtp');
                saveSetting($db, 'smtp_username', $_POST['smtp_username'] ?? '', 'string', 'smtp');
                saveSetting($db, 'smtp_encryption', $_POST['smtp_encryption'] ?? 'tls', 'string', 'smtp');
                saveSetting($db, 'smtp_from_email', $_POST['smtp_from_email'] ?? '', 'string', 'smtp');
                saveSetting($db, 'smtp_from_name', $_POST['smtp_from_name'] ?? '', 'string', 'smtp');
                
                if (!empty($_POST['smtp_password'])) {
                    updateConfigFile('smtp', [
                        'enabled' => $smtpEnabled,
                        'host' => $_POST['smtp_host'] ?? '',
                        'port' => (int)($_POST['smtp_port'] ?? 587),
                        'username' => $_POST['smtp_username'] ?? '',
                        'password' => $_POST['smtp_password'],
                        'encryption' => $_POST['smtp_encryption'] ?? 'tls',
                        'from_email' => $_POST['smtp_from_email'] ?? '',
                        'from_name' => $_POST['smtp_from_name'] ?? '',
                    ]);
                }
                
                $message = 'SMTP settings saved successfully!';
                $messageType = 'success';
                break;
                
            case 'save_webhook':
                $webhookEnabled = isset($_POST['webhook_enabled']);
                saveSetting($db, 'webhook_enabled', $webhookEnabled ? 'true' : 'false', 'boolean', 'webhook');
                saveSetting($db, 'webhook_provider', $_POST['webhook_provider'] ?? '', 'string', 'webhook');
                
                if (!empty($_POST['webhook_secret'])) {
                    saveSetting($db, 'webhook_secret', $_POST['webhook_secret'], 'string', 'webhook');
                }
                
                $message = 'Webhook settings saved successfully!';
                $messageType = 'success';
                break;
                
            case 'test_imap':
                $result = testImapConnection($_POST);
                $message = $result['success'] ? 'IMAP connection successful! ' . ($result['message'] ?? '') : 'IMAP test failed: ' . ($result['error'] ?? 'Unknown error');
                $messageType = $result['success'] ? 'success' : 'error';
                break;
                
            case 'test_smtp':
                $result = testSmtpConnection($_POST);
                $message = $result['success'] ? 'SMTP connection successful!' : 'SMTP test failed: ' . ($result['error'] ?? 'Unknown error');
                $messageType = $result['success'] ? 'success' : 'error';
                break;
        }
        
        // Reload settings
        $settings = getSettings($db);
        
    } catch (Exception $e) {
        $message = 'Error: ' . $e->getMessage();
        $messageType = 'error';
    }
}

function updateConfigFile(string $section, array $values): void {
    global $configFile, $config;
    
    if (!file_exists($configFile)) return;
    
    $config[$section] = array_merge($config[$section] ?? [], $values);
    
    // Regenerate config file
    $content = "<?php\n/**\n * Application Configuration\n * Updated on " . date('Y-m-d H:i:s') . "\n */\n\nreturn " . var_export($config, true) . ";\n";
    file_put_contents($configFile, $content);
}

function testImapConnection(array $data): array {
    if (!function_exists('imap_open')) {
        return ['success' => false, 'error' => 'IMAP extension not installed'];
    }
    
    $host = $data['imap_host'] ?? '';
    $port = (int)($data['imap_port'] ?? 993);
    $user = $data['imap_username'] ?? '';
    $pass = $data['imap_password'] ?? '';
    $encryption = $data['imap_encryption'] ?? 'ssl';
    
    if (empty($host) || empty($user) || empty($pass)) {
        return ['success' => false, 'error' => 'Host, username and password required'];
    }
    
    $flags = '/imap';
    if ($encryption === 'ssl') $flags .= '/ssl';
    elseif ($encryption === 'tls') $flags .= '/tls';
    $flags .= '/novalidate-cert';
    
    $mailbox = "{" . $host . ":" . $port . $flags . "}INBOX";
    
    $connection = @imap_open($mailbox, $user, $pass, 0, 1);
    
    if ($connection) {
        $info = imap_check($connection);
        $msgCount = $info ? $info->Nmsgs : 0;
        imap_close($connection);
        return ['success' => true, 'message' => "Found {$msgCount} messages in INBOX"];
    }
    
    return ['success' => false, 'error' => imap_last_error() ?: 'Connection failed'];
}

function testSmtpConnection(array $data): array {
    $host = $data['smtp_host'] ?? '';
    $port = (int)($data['smtp_port'] ?? 587);
    $encryption = $data['smtp_encryption'] ?? 'tls';
    
    if (empty($host)) {
        return ['success' => false, 'error' => 'SMTP host required'];
    }
    
    $prefix = ($encryption === 'ssl') ? 'ssl://' : '';
    $socket = @stream_socket_client($prefix . $host . ':' . $port, $errno, $errstr, 10);
    
    if (!$socket) {
        return ['success' => false, 'error' => $errstr];
    }
    
    fclose($socket);
    return ['success' => true];
}

// Get webhook URL
$webhookUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . 
              '://' . $_SERVER['HTTP_HOST'] . '/api/emails/webhook.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Settings - Admin Panel</title>
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
        }
        
        .layout {
            display: flex;
            min-height: 100vh;
        }
        
        .sidebar {
            width: 250px;
            background: var(--card);
            border-right: 1px solid var(--border);
            padding: 1.5rem;
        }
        
        .sidebar h1 {
            font-size: 1.25rem;
            margin-bottom: 2rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .sidebar nav a {
            display: block;
            padding: 0.75rem 1rem;
            color: var(--text-muted);
            text-decoration: none;
            border-radius: 0.5rem;
            margin-bottom: 0.25rem;
        }
        
        .sidebar nav a:hover,
        .sidebar nav a.active {
            background: rgba(59, 130, 246, 0.1);
            color: var(--primary);
        }
        
        .main {
            flex: 1;
            padding: 2rem;
            overflow-y: auto;
        }
        
        .header {
            margin-bottom: 2rem;
        }
        
        .header h2 {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
        }
        
        .header p {
            color: var(--text-muted);
        }
        
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 0.75rem;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }
        
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--border);
        }
        
        .card-title {
            font-size: 1.125rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            margin-bottom: 1rem;
        }
        
        @media (max-width: 768px) {
            .form-row { grid-template-columns: 1fr; }
            .sidebar { display: none; }
        }
        
        .form-group {
            margin-bottom: 1rem;
        }
        
        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            font-size: 0.875rem;
        }
        
        input, select {
            width: 100%;
            padding: 0.625rem 0.875rem;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            color: var(--text);
            font-size: 0.875rem;
        }
        
        input:focus, select:focus {
            outline: none;
            border-color: var(--primary);
        }
        
        .hint {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 0.25rem;
        }
        
        .toggle {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        
        .toggle input[type="checkbox"] {
            width: 2.5rem;
            height: 1.25rem;
            appearance: none;
            background: var(--border);
            border-radius: 9999px;
            position: relative;
            cursor: pointer;
        }
        
        .toggle input[type="checkbox"]::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 1rem;
            height: 1rem;
            background: white;
            border-radius: 50%;
            transition: transform 0.2s;
        }
        
        .toggle input[type="checkbox"]:checked {
            background: var(--primary);
        }
        
        .toggle input[type="checkbox"]:checked::after {
            transform: translateX(1.25rem);
        }
        
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.625rem 1.25rem;
            border: none;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
        }
        
        .btn-primary { background: var(--primary); color: white; }
        .btn-secondary { background: rgba(255,255,255,0.1); color: var(--text); }
        .btn-success { background: var(--success); color: white; }
        
        .btn:hover { opacity: 0.9; }
        
        .btn-group {
            display: flex;
            gap: 0.75rem;
            margin-top: 1.5rem;
        }
        
        .alert {
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1.5rem;
        }
        
        .alert-success {
            background: rgba(34, 197, 94, 0.15);
            border: 1px solid rgba(34, 197, 94, 0.3);
            color: #86efac;
        }
        
        .alert-error {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
        }
        
        .alert-info {
            background: rgba(59, 130, 246, 0.15);
            border: 1px solid rgba(59, 130, 246, 0.3);
            color: #93c5fd;
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
        
        .status-enabled { background: rgba(34, 197, 94, 0.2); color: #86efac; }
        .status-disabled { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }
        
        .code-box {
            background: rgba(0, 0, 0, 0.4);
            padding: 1rem;
            border-radius: 0.5rem;
            font-family: monospace;
            font-size: 0.8rem;
            word-break: break-all;
            margin-top: 0.5rem;
        }
        
        .tabs {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.5rem;
        }
        
        .tab {
            padding: 0.5rem 1rem;
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            border-radius: 0.5rem;
        }
        
        .tab.active {
            background: var(--primary);
            color: white;
        }
        
        .tab-content { display: none; }
        .tab-content.active { display: block; }
    </style>
</head>
<body>
    <div class="layout">
        <aside class="sidebar">
            <h1>⚙️ Admin Panel</h1>
            <nav>
                <a href="/admin">Dashboard</a>
                <a href="/admin/users">Users</a>
                <a href="/admin/domains">Domains</a>
                <a href="/admin/emails">Emails</a>
                <a href="health-dashboard.php">Health Monitor</a>
                <a href="settings.php" class="active">Settings</a>
            </nav>
        </aside>
        
        <main class="main">
            <div class="header">
                <h2>⚙️ System Settings</h2>
                <p>Configure IMAP, SMTP, and webhook settings</p>
            </div>
            
            <?php if ($message): ?>
            <div class="alert alert-<?= $messageType ?>">
                <?= htmlspecialchars($message) ?>
            </div>
            <?php endif; ?>
            
            <div class="tabs">
                <button class="tab active" onclick="showTab('imap')">📥 IMAP</button>
                <button class="tab" onclick="showTab('smtp')">📤 SMTP</button>
                <button class="tab" onclick="showTab('webhook')">🔗 Webhooks</button>
            </div>
            
            <!-- IMAP Settings -->
            <div id="tab-imap" class="tab-content active">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">📥 IMAP Configuration</h3>
                        <span class="status-badge <?= ($settings['imap_enabled'] ?? false) ? 'status-enabled' : 'status-disabled' ?>">
                            <?= ($settings['imap_enabled'] ?? false) ? '● Enabled' : '○ Disabled' ?>
                        </span>
                    </div>
                    
                    <form method="POST">
                        <input type="hidden" name="action" value="save_imap">
                        
                        <div class="form-group">
                            <label class="toggle">
                                <input type="checkbox" name="imap_enabled" <?= ($settings['imap_enabled'] ?? false) ? 'checked' : '' ?>>
                                <span>Enable IMAP Polling</span>
                            </label>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>IMAP Host</label>
                                <input type="text" name="imap_host" value="<?= htmlspecialchars($settings['imap_host'] ?? $config['imap']['host'] ?? '') ?>" placeholder="mail.yourdomain.com">
                            </div>
                            <div class="form-group">
                                <label>Port</label>
                                <select name="imap_port">
                                    <option value="993" <?= ($settings['imap_port'] ?? 993) == 993 ? 'selected' : '' ?>>993 (SSL)</option>
                                    <option value="143" <?= ($settings['imap_port'] ?? 993) == 143 ? 'selected' : '' ?>>143 (TLS/None)</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Username</label>
                                <input type="text" name="imap_username" value="<?= htmlspecialchars($settings['imap_username'] ?? $config['imap']['username'] ?? '') ?>" placeholder="catchall@yourdomain.com">
                            </div>
                            <div class="form-group">
                                <label>Password</label>
                                <input type="password" name="imap_password" placeholder="••••••••">
                                <span class="hint">Leave empty to keep current password</span>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Encryption</label>
                                <select name="imap_encryption">
                                    <option value="ssl" <?= ($settings['imap_encryption'] ?? 'ssl') === 'ssl' ? 'selected' : '' ?>>SSL</option>
                                    <option value="tls" <?= ($settings['imap_encryption'] ?? '') === 'tls' ? 'selected' : '' ?>>TLS</option>
                                    <option value="" <?= ($settings['imap_encryption'] ?? '') === '' ? 'selected' : '' ?>>None</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Poll Interval (seconds)</label>
                                <input type="number" name="imap_poll_interval" value="<?= (int)($settings['imap_poll_interval'] ?? 120) ?>" min="30" max="600">
                            </div>
                        </div>
                        
                        <div class="btn-group">
                            <button type="submit" class="btn btn-primary">Save IMAP Settings</button>
                            <button type="submit" name="action" value="test_imap" class="btn btn-secondary">Test Connection</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- SMTP Settings -->
            <div id="tab-smtp" class="tab-content">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">📤 SMTP Configuration</h3>
                        <span class="status-badge <?= ($settings['smtp_enabled'] ?? false) ? 'status-enabled' : 'status-disabled' ?>">
                            <?= ($settings['smtp_enabled'] ?? false) ? '● Enabled' : '○ Disabled' ?>
                        </span>
                    </div>
                    
                    <form method="POST">
                        <input type="hidden" name="action" value="save_smtp">
                        
                        <div class="form-group">
                            <label class="toggle">
                                <input type="checkbox" name="smtp_enabled" <?= ($settings['smtp_enabled'] ?? false) ? 'checked' : '' ?>>
                                <span>Enable SMTP</span>
                            </label>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>SMTP Host</label>
                                <input type="text" name="smtp_host" value="<?= htmlspecialchars($settings['smtp_host'] ?? $config['smtp']['host'] ?? '') ?>" placeholder="mail.yourdomain.com">
                            </div>
                            <div class="form-group">
                                <label>Port</label>
                                <select name="smtp_port">
                                    <option value="587" <?= ($settings['smtp_port'] ?? 587) == 587 ? 'selected' : '' ?>>587 (TLS)</option>
                                    <option value="465" <?= ($settings['smtp_port'] ?? 587) == 465 ? 'selected' : '' ?>>465 (SSL)</option>
                                    <option value="25" <?= ($settings['smtp_port'] ?? 587) == 25 ? 'selected' : '' ?>>25 (Unencrypted)</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>Username</label>
                                <input type="text" name="smtp_username" value="<?= htmlspecialchars($settings['smtp_username'] ?? $config['smtp']['username'] ?? '') ?>">
                            </div>
                            <div class="form-group">
                                <label>Password</label>
                                <input type="password" name="smtp_password" placeholder="••••••••">
                                <span class="hint">Leave empty to keep current password</span>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>From Email</label>
                                <input type="email" name="smtp_from_email" value="<?= htmlspecialchars($settings['smtp_from_email'] ?? $config['smtp']['from_email'] ?? '') ?>">
                            </div>
                            <div class="form-group">
                                <label>From Name</label>
                                <input type="text" name="smtp_from_name" value="<?= htmlspecialchars($settings['smtp_from_name'] ?? $config['smtp']['from_name'] ?? '') ?>">
                            </div>
                        </div>
                        
                        <div class="btn-group">
                            <button type="submit" class="btn btn-primary">Save SMTP Settings</button>
                            <button type="submit" name="action" value="test_smtp" class="btn btn-secondary">Test Connection</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Webhook Settings -->
            <div id="tab-webhook" class="tab-content">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">🔗 Webhook Configuration</h3>
                        <span class="status-badge <?= ($settings['webhook_enabled'] ?? false) ? 'status-enabled' : 'status-disabled' ?>">
                            <?= ($settings['webhook_enabled'] ?? false) ? '● Enabled' : '○ Disabled' ?>
                        </span>
                    </div>
                    
                    <div class="alert alert-info">
                        <strong>Your Webhook URL:</strong>
                        <div class="code-box"><?= htmlspecialchars($webhookUrl) ?></div>
                    </div>
                    
                    <form method="POST">
                        <input type="hidden" name="action" value="save_webhook">
                        
                        <div class="form-group">
                            <label class="toggle">
                                <input type="checkbox" name="webhook_enabled" <?= ($settings['webhook_enabled'] ?? true) ? 'checked' : '' ?>>
                                <span>Enable Webhook Delivery</span>
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label>Webhook Provider</label>
                            <select name="webhook_provider">
                                <option value="">Select Provider...</option>
                                <option value="forwardemail" <?= ($settings['webhook_provider'] ?? '') === 'forwardemail' ? 'selected' : '' ?>>ForwardEmail.net</option>
                                <option value="mailgun" <?= ($settings['webhook_provider'] ?? '') === 'mailgun' ? 'selected' : '' ?>>Mailgun</option>
                                <option value="sendgrid" <?= ($settings['webhook_provider'] ?? '') === 'sendgrid' ? 'selected' : '' ?>>SendGrid</option>
                                <option value="postmark" <?= ($settings['webhook_provider'] ?? '') === 'postmark' ? 'selected' : '' ?>>Postmark</option>
                                <option value="custom" <?= ($settings['webhook_provider'] ?? '') === 'custom' ? 'selected' : '' ?>>Custom</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Webhook Secret</label>
                            <input type="password" name="webhook_secret" placeholder="••••••••">
                            <span class="hint">Secret key from your email provider for signature verification</span>
                        </div>
                        
                        <div class="btn-group">
                            <button type="submit" class="btn btn-primary">Save Webhook Settings</button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    </div>
    
    <script>
    function showTab(tabId) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        document.querySelector(`[onclick="showTab('${tabId}')"]`).classList.add('active');
        document.getElementById('tab-' + tabId).classList.add('active');
    }
    </script>
</body>
</html>
