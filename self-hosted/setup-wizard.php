<?php
/**
 * Self-Hosted Temp Email - Setup Wizard & Diagnostic Tool
 * 
 * This standalone page helps diagnose and fix common installation issues.
 * Access: https://yourdomain.com/setup-wizard.php
 * 
 * SECURITY: Delete this file after setup is complete!
 */

session_start();

// Check if config exists
$configExists = file_exists(__DIR__ . '/api/config.php');
$config = null;
$db = null;

if ($configExists) {
    require_once __DIR__ . '/api/config.php';
    require_once __DIR__ . '/api/core/database.php';
    
    try {
        $db = Database::getConnection();
        $config = require __DIR__ . '/api/config.php';
    } catch (Exception $e) {
        $dbError = $e->getMessage();
    }
}

// Handle AJAX actions
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    header('Content-Type: application/json');
    
    $action = $_POST['action'];
    
    try {
        switch ($action) {
            case 'add_domain':
                $domain = trim($_POST['domain'] ?? '');
                if (empty($domain)) {
                    echo json_encode(['success' => false, 'error' => 'Domain is required']);
                    exit;
                }
                
                $stmt = $db->prepare("INSERT INTO domains (id, domain, is_active, created_at, updated_at) VALUES (UUID(), ?, 1, NOW(), NOW())");
                $stmt->execute([$domain]);
                echo json_encode(['success' => true, 'message' => "Domain '$domain' added successfully"]);
                break;
                
            case 'make_admin':
                $userId = $_POST['user_id'] ?? '';
                if (empty($userId)) {
                    echo json_encode(['success' => false, 'error' => 'User ID is required']);
                    exit;
                }
                
                // Check if user_roles table exists
                $stmt = $db->query("SHOW TABLES LIKE 'user_roles'");
                if ($stmt->rowCount() === 0) {
                    // Create user_roles table
                    $db->exec("
                        CREATE TABLE IF NOT EXISTS user_roles (
                            id VARCHAR(36) PRIMARY KEY,
                            user_id VARCHAR(36) NOT NULL,
                            role ENUM('user', 'admin', 'super_admin') NOT NULL DEFAULT 'user',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE KEY unique_user_role (user_id, role),
                            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                    ");
                }
                
                // Add admin role
                $stmt = $db->prepare("INSERT INTO user_roles (id, user_id, role, created_at, updated_at) VALUES (UUID(), ?, 'admin', NOW(), NOW()) ON DUPLICATE KEY UPDATE role = 'admin', updated_at = NOW()");
                $stmt->execute([$userId]);
                echo json_encode(['success' => true, 'message' => 'User promoted to admin']);
                break;
                
            case 'test_email':
                $domain = $_POST['domain'] ?? '';
                if (empty($domain)) {
                    echo json_encode(['success' => false, 'error' => 'Domain is required']);
                    exit;
                }
                
                $username = 'test_' . bin2hex(random_bytes(4));
                $email = $username . '@' . $domain;
                $token = bin2hex(random_bytes(32));
                $tokenHash = hash('sha256', $token);
                $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));
                
                $stmt = $db->prepare("
                    INSERT INTO temp_emails (id, email_address, token, token_hash, expires_at, is_active, created_at, updated_at) 
                    VALUES (UUID(), ?, ?, ?, ?, 1, NOW(), NOW())
                ");
                $stmt->execute([$email, $token, $tokenHash, $expiresAt]);
                
                echo json_encode([
                    'success' => true, 
                    'message' => "Test email created: $email",
                    'email' => $email,
                    'token' => $token
                ]);
                break;
                
            case 'add_setting':
                $key = trim($_POST['setting_key'] ?? '');
                $value = trim($_POST['setting_value'] ?? '');
                
                if (empty($key)) {
                    echo json_encode(['success' => false, 'error' => 'Setting key is required']);
                    exit;
                }
                
                $stmt = $db->prepare("INSERT INTO app_settings (id, `key`, `value`, created_at, updated_at) VALUES (UUID(), ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE `value` = ?");
                $stmt->execute([$key, json_encode($value), json_encode($value)]);
                echo json_encode(['success' => true, 'message' => "Setting '$key' saved"]);
                break;
                
            case 'test_webhook':
                // Return webhook test info
                $webhookUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . 
                              '://' . $_SERVER['HTTP_HOST'] . '/api/emails/webhook.php';
                echo json_encode([
                    'success' => true,
                    'webhook_url' => $webhookUrl,
                    'test_curl' => "curl -X POST '$webhookUrl' -H 'Content-Type: application/json' -d '{\"from\":\"test@example.com\",\"to\":\"user@yourdomain.com\",\"subject\":\"Test\",\"text\":\"Hello\"}'"
                ]);
                break;
                
            default:
                echo json_encode(['success' => false, 'error' => 'Unknown action']);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// Gather diagnostic information
$diagnostics = [
    'php_version' => PHP_VERSION,
    'php_ok' => version_compare(PHP_VERSION, '8.0.0', '>='),
    'extensions' => [
        'pdo_mysql' => extension_loaded('pdo_mysql'),
        'json' => extension_loaded('json'),
        'mbstring' => extension_loaded('mbstring'),
        'openssl' => extension_loaded('openssl'),
        'curl' => extension_loaded('curl'),
    ],
    'writable' => [
        'api/' => is_writable(__DIR__ . '/api'),
        'uploads/' => is_writable(__DIR__ . '/uploads'),
        'uploads/attachments/' => is_writable(__DIR__ . '/uploads/attachments'),
    ],
    'files' => [
        'config.php' => $configExists,
        '.htaccess' => file_exists(__DIR__ . '/.htaccess'),
        'api/.htaccess' => file_exists(__DIR__ . '/api/.htaccess'),
    ],
];

$tables = [];
$domains = [];
$users = [];
$admins = [];
$settings = [];
$recentErrors = [];

if ($db) {
    try {
        // Get all tables
        $stmt = $db->query("SHOW TABLES");
        $allTables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        foreach ($allTables as $table) {
            $countStmt = $db->query("SELECT COUNT(*) FROM `$table`");
            $tables[$table] = $countStmt->fetchColumn();
        }
        
        // Get domains
        if (in_array('domains', $allTables)) {
            $stmt = $db->query("SELECT * FROM domains ORDER BY created_at DESC");
            $domains = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        
        // Get users (last 20)
        if (in_array('users', $allTables)) {
            $stmt = $db->query("SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 20");
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        
        // Get admins
        if (in_array('user_roles', $allTables)) {
            $stmt = $db->query("
                SELECT u.id, u.name, u.email, ur.role 
                FROM users u 
                JOIN user_roles ur ON u.id = ur.user_id 
                WHERE ur.role IN ('admin', 'super_admin')
            ");
            $admins = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        
        // Get settings
        if (in_array('app_settings', $allTables)) {
            $stmt = $db->query("SELECT `key`, `value` FROM app_settings LIMIT 50");
            $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        }
        
    } catch (Exception $e) {
        $recentErrors[] = $e->getMessage();
    }
}

$webhookUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . 
              '://' . $_SERVER['HTTP_HOST'] . '/api/emails/webhook.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Setup Wizard - Self-Hosted Temp Email</title>
    <style>
        :root {
            --bg: #0a0a0a;
            --card: #111111;
            --border: #222222;
            --text: #ffffff;
            --text-muted: #888888;
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
            line-height: 1.6;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { font-size: 2rem; margin-bottom: 0.5rem; }
        .subtitle { color: var(--text-muted); margin-bottom: 2rem; }
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }
        .card h2 {
            font-size: 1.25rem;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .status-icon {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }
        .status-ok { background: var(--success); }
        .status-warn { background: var(--warning); }
        .status-error { background: var(--danger); }
        .check-list { list-style: none; }
        .check-list li {
            padding: 0.5rem 0;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            border-bottom: 1px solid var(--border);
        }
        .check-list li:last-child { border-bottom: none; }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            text-align: left;
            padding: 0.75rem;
            border-bottom: 1px solid var(--border);
        }
        th { color: var(--text-muted); font-weight: 500; }
        .btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
        }
        .btn:hover { opacity: 0.9; }
        .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; }
        .btn-success { background: var(--success); }
        .btn-danger { background: var(--danger); }
        input, select {
            background: var(--bg);
            border: 1px solid var(--border);
            color: var(--text);
            padding: 0.5rem;
            border-radius: 6px;
            width: 100%;
        }
        .input-group {
            display: flex;
            gap: 0.5rem;
            margin-top: 1rem;
        }
        .input-group input { flex: 1; }
        .badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        .badge-success { background: rgba(34, 197, 94, 0.2); color: var(--success); }
        .badge-danger { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
        .badge-warning { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
        .code {
            background: var(--bg);
            padding: 1rem;
            border-radius: 6px;
            font-family: monospace;
            font-size: 0.875rem;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .alert {
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;
        }
        .alert-danger { background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger); }
        .alert-warning { background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning); }
        .alert-success { background: rgba(34, 197, 94, 0.1); border: 1px solid var(--success); }
        .tabs {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1rem;
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.5rem;
        }
        .tab {
            padding: 0.5rem 1rem;
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            border-radius: 6px;
        }
        .tab.active { background: var(--primary); color: white; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .mt-2 { margin-top: 1rem; }
        .text-muted { color: var(--text-muted); }
        .text-sm { font-size: 0.875rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 Setup Wizard</h1>
        <p class="subtitle">Self-Hosted Temp Email - Diagnostic & Configuration Tool</p>
        
        <?php if (!$configExists): ?>
        <div class="alert alert-danger">
            <strong>⚠️ config.php not found!</strong><br>
            Copy <code>api/config.example.php</code> to <code>api/config.php</code> and configure your database settings.
        </div>
        <?php elseif (isset($dbError)): ?>
        <div class="alert alert-danger">
            <strong>⚠️ Database Connection Failed!</strong><br>
            <?= htmlspecialchars($dbError) ?>
        </div>
        <?php endif; ?>
        
        <div class="grid">
            <!-- Environment Check -->
            <div class="card">
                <h2>
                    <span class="status-icon <?= $diagnostics['php_ok'] && !in_array(false, $diagnostics['extensions']) ? 'status-ok' : 'status-error' ?>">
                        <?= $diagnostics['php_ok'] && !in_array(false, $diagnostics['extensions']) ? '✓' : '✗' ?>
                    </span>
                    Environment
                </h2>
                <ul class="check-list">
                    <li>
                        <span class="status-icon <?= $diagnostics['php_ok'] ? 'status-ok' : 'status-error' ?>">
                            <?= $diagnostics['php_ok'] ? '✓' : '✗' ?>
                        </span>
                        PHP Version: <?= $diagnostics['php_version'] ?> (requires 8.0+)
                    </li>
                    <?php foreach ($diagnostics['extensions'] as $ext => $loaded): ?>
                    <li>
                        <span class="status-icon <?= $loaded ? 'status-ok' : 'status-error' ?>">
                            <?= $loaded ? '✓' : '✗' ?>
                        </span>
                        Extension: <?= $ext ?>
                    </li>
                    <?php endforeach; ?>
                </ul>
            </div>
            
            <!-- File Permissions -->
            <div class="card">
                <h2>
                    <span class="status-icon <?= !in_array(false, $diagnostics['writable']) && !in_array(false, $diagnostics['files']) ? 'status-ok' : 'status-warn' ?>">
                        <?= !in_array(false, $diagnostics['writable']) && !in_array(false, $diagnostics['files']) ? '✓' : '!' ?>
                    </span>
                    Files & Permissions
                </h2>
                <ul class="check-list">
                    <?php foreach ($diagnostics['files'] as $file => $exists): ?>
                    <li>
                        <span class="status-icon <?= $exists ? 'status-ok' : 'status-error' ?>">
                            <?= $exists ? '✓' : '✗' ?>
                        </span>
                        <?= $file ?>: <?= $exists ? 'Exists' : 'Missing' ?>
                    </li>
                    <?php endforeach; ?>
                    <?php foreach ($diagnostics['writable'] as $dir => $writable): ?>
                    <li>
                        <span class="status-icon <?= $writable ? 'status-ok' : 'status-warn' ?>">
                            <?= $writable ? '✓' : '!' ?>
                        </span>
                        <?= $dir ?>: <?= $writable ? 'Writable' : 'Not Writable' ?>
                    </li>
                    <?php endforeach; ?>
                </ul>
            </div>
        </div>
        
        <?php if ($db): ?>
        <!-- Database Tables -->
        <div class="card">
            <h2>
                <span class="status-icon <?= count($tables) > 5 ? 'status-ok' : 'status-warn' ?>">
                    <?= count($tables) > 5 ? '✓' : '!' ?>
                </span>
                Database Tables (<?= count($tables) ?> tables)
            </h2>
            <table>
                <thead>
                    <tr>
                        <th>Table Name</th>
                        <th>Row Count</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <?php 
                    $requiredTables = ['users', 'domains', 'temp_emails', 'received_emails', 'app_settings', 'user_roles'];
                    foreach ($requiredTables as $reqTable): 
                    ?>
                    <tr>
                        <td><?= $reqTable ?></td>
                        <td><?= $tables[$reqTable] ?? '-' ?></td>
                        <td>
                            <?php if (isset($tables[$reqTable])): ?>
                                <span class="badge badge-success">✓ Exists</span>
                            <?php else: ?>
                                <span class="badge badge-danger">✗ Missing</span>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <p class="text-sm text-muted mt-2">
                Total tables: <?= count($tables) ?> | 
                Total users: <?= $tables['users'] ?? 0 ?> | 
                Total emails: <?= $tables['temp_emails'] ?? 0 ?>
            </p>
        </div>
        
        <!-- Domains -->
        <div class="card">
            <h2>
                <span class="status-icon <?= count($domains) > 0 ? 'status-ok' : 'status-error' ?>">
                    <?= count($domains) > 0 ? '✓' : '✗' ?>
                </span>
                Domains (<?= count($domains) ?>)
            </h2>
            
            <?php if (count($domains) === 0): ?>
            <div class="alert alert-danger">
                <strong>⚠️ No domains configured!</strong> Email generation will fail without at least one active domain.
            </div>
            <?php else: ?>
            <table>
                <thead>
                    <tr>
                        <th>Domain</th>
                        <th>Status</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($domains as $d): ?>
                    <tr>
                        <td><?= htmlspecialchars($d['domain'] ?? 'Unknown') ?></td>
                        <td>
                            <?php if ($d['is_active'] ?? false): ?>
                                <span class="badge badge-success">Active</span>
                            <?php else: ?>
                                <span class="badge badge-danger">Inactive</span>
                            <?php endif; ?>
                        </td>
                        <td><?= $d['created_at'] ?? '-' ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>
            
            <div class="input-group">
                <input type="text" id="new-domain" placeholder="example.com">
                <button class="btn btn-success" onclick="addDomain()">Add Domain</button>
            </div>
        </div>
        
        <!-- Users & Admins -->
        <div class="card">
            <h2>
                <span class="status-icon <?= count($admins) > 0 ? 'status-ok' : 'status-warn' ?>">
                    <?= count($admins) > 0 ? '✓' : '!' ?>
                </span>
                Users & Admins
            </h2>
            
            <div class="tabs">
                <button class="tab active" onclick="showTab('admins-tab')">Admins (<?= count($admins) ?>)</button>
                <button class="tab" onclick="showTab('users-tab')">Recent Users (<?= count($users) ?>)</button>
            </div>
            
            <div id="admins-tab" class="tab-content active">
                <?php if (count($admins) === 0): ?>
                <div class="alert alert-warning">
                    <strong>⚠️ No admin users found!</strong> Admin panel login won't work without admin roles.
                </div>
                <?php else: ?>
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($admins as $admin): ?>
                        <tr>
                            <td><?= htmlspecialchars($admin['name'] ?? 'Unknown') ?></td>
                            <td><?= htmlspecialchars($admin['email'] ?? '-') ?></td>
                            <td><span class="badge badge-success"><?= $admin['role'] ?></span></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                <?php endif; ?>
            </div>
            
            <div id="users-tab" class="tab-content">
                <?php if (count($users) === 0): ?>
                <p class="text-muted">No users found in database.</p>
                <?php else: ?>
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Created</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($users as $user): ?>
                        <tr>
                            <td><?= htmlspecialchars($user['name'] ?? 'Unknown') ?></td>
                            <td><?= htmlspecialchars($user['email'] ?? '-') ?></td>
                            <td><?= $user['created_at'] ?? '-' ?></td>
                            <td>
                                <button class="btn btn-sm" onclick="makeAdmin('<?= $user['id'] ?>')">Make Admin</button>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                <?php endif; ?>
            </div>
        </div>
        
        <!-- Test Email Generation -->
        <div class="card">
            <h2>📧 Test Email Generation</h2>
            <p class="text-muted text-sm">Test if email generation is working correctly.</p>
            
            <div class="input-group">
                <select id="test-domain">
                    <option value="">Select a domain...</option>
                    <?php foreach ($domains as $d): ?>
                    <option value="<?= htmlspecialchars($d['domain'] ?? '') ?>">
                        <?= htmlspecialchars($d['domain'] ?? 'Unknown') ?>
                    </option>
                    <?php endforeach; ?>
                </select>
                <button class="btn" onclick="testEmail()">Generate Test Email</button>
            </div>
            <div id="test-result" class="mt-2"></div>
        </div>
        
        <!-- Webhook Configuration -->
        <div class="card">
            <h2>🔗 Webhook Configuration</h2>
            <p class="text-muted text-sm">Configure your email provider to send incoming emails to this webhook URL.</p>
            
            <div class="code" id="webhook-url"><?= htmlspecialchars($webhookUrl) ?></div>
            
            <div class="tabs mt-2">
                <button class="tab active" onclick="showWebhookTab('forwardemail')">ForwardEmail</button>
                <button class="tab" onclick="showWebhookTab('mailgun')">Mailgun</button>
                <button class="tab" onclick="showWebhookTab('custom')">Custom</button>
            </div>
            
            <div id="forwardemail-tab" class="tab-content active">
                <h3 class="text-sm">ForwardEmail.net Setup:</h3>
                <ol class="text-sm" style="padding-left: 1.5rem; margin-top: 0.5rem;">
                    <li>Go to <a href="https://forwardemail.net" target="_blank" style="color: var(--primary)">forwardemail.net</a></li>
                    <li>Add your domain and verify DNS records</li>
                    <li>Set up a webhook alias: <code>*@yourdomain.com → <?= htmlspecialchars($webhookUrl) ?></code></li>
                    <li>Add webhook secret to your <code>config.php</code>:
                        <div class="code mt-2">'webhook_secrets' => [
    'forwardemail' => 'your-webhook-secret-here'
]</div>
                    </li>
                </ol>
            </div>
            
            <div id="mailgun-tab" class="tab-content">
                <h3 class="text-sm">Mailgun Setup:</h3>
                <ol class="text-sm" style="padding-left: 1.5rem; margin-top: 0.5rem;">
                    <li>Go to Mailgun Dashboard → Receiving</li>
                    <li>Create a route: Match <code>catch_all()</code></li>
                    <li>Forward to: <code><?= htmlspecialchars($webhookUrl) ?></code></li>
                    <li>Add webhook secret to your <code>config.php</code>:
                        <div class="code mt-2">'webhook_secrets' => [
    'mailgun' => 'your-mailgun-signing-key'
]</div>
                    </li>
                </ol>
            </div>
            
            <div id="custom-tab" class="tab-content">
                <h3 class="text-sm">Test with cURL:</h3>
                <div class="code">curl -X POST '<?= htmlspecialchars($webhookUrl) ?>' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "sender@example.com",
    "to": "test@yourdomain.com",
    "subject": "Test Email",
    "text": "This is a test email body",
    "html": "&lt;p&gt;This is a test email body&lt;/p&gt;"
  }'</div>
            </div>
        </div>
        
        <!-- App Settings -->
        <div class="card">
            <h2>⚙️ App Settings</h2>
            <?php if (count($settings) === 0): ?>
            <div class="alert alert-warning">
                <strong>⚠️ No app settings found!</strong> Some features may not work correctly.
            </div>
            <?php else: ?>
            <table>
                <thead>
                    <tr>
                        <th>Key</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($settings as $key => $value): ?>
                    <tr>
                        <td><?= htmlspecialchars($key) ?></td>
                        <td><?= htmlspecialchars(substr($value, 0, 100)) ?><?= strlen($value) > 100 ? '...' : '' ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php endif; ?>
            
            <div class="input-group">
                <input type="text" id="setting-key" placeholder="setting_key">
                <input type="text" id="setting-value" placeholder="setting_value">
                <button class="btn" onclick="addSetting()">Add Setting</button>
            </div>
            
            <div class="mt-2">
                <p class="text-sm text-muted">Common settings to add:</p>
                <button class="btn btn-sm" onclick="addQuickSetting('site_name', 'Temp Email')">site_name</button>
                <button class="btn btn-sm" onclick="addQuickSetting('default_email_expiry_hours', '24')">expiry_hours</button>
                <button class="btn btn-sm" onclick="addQuickSetting('max_emails_per_user', '10')">max_emails</button>
            </div>
        </div>
        <?php endif; ?>
        
        <!-- Security Notice -->
        <div class="alert alert-danger mt-2">
            <strong>🔒 Security Notice:</strong> Delete this <code>setup-wizard.php</code> file after completing setup!
        </div>
    </div>
    
    <script>
        function showTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            event.target.classList.add('active');
        }
        
        function showWebhookTab(provider) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tabs .tab').forEach(el => el.classList.remove('active'));
            document.getElementById(provider + '-tab').classList.add('active');
            event.target.classList.add('active');
        }
        
        async function addDomain() {
            const domain = document.getElementById('new-domain').value.trim();
            if (!domain) { alert('Please enter a domain'); return; }
            
            const formData = new FormData();
            formData.append('action', 'add_domain');
            formData.append('domain', domain);
            
            try {
                const response = await fetch('', { method: 'POST', body: formData });
                const result = await response.json();
                alert(result.message || result.error);
                if (result.success) location.reload();
            } catch (e) {
                alert('Error: ' + e.message);
            }
        }
        
        async function makeAdmin(userId) {
            if (!confirm('Make this user an admin?')) return;
            
            const formData = new FormData();
            formData.append('action', 'make_admin');
            formData.append('user_id', userId);
            
            try {
                const response = await fetch('', { method: 'POST', body: formData });
                const result = await response.json();
                alert(result.message || result.error);
                if (result.success) location.reload();
            } catch (e) {
                alert('Error: ' + e.message);
            }
        }
        
        async function testEmail() {
            const domain = document.getElementById('test-domain').value;
            if (!domain) { alert('Please select a domain'); return; }
            
            const formData = new FormData();
            formData.append('action', 'test_email');
            formData.append('domain', domain);
            
            try {
                const response = await fetch('', { method: 'POST', body: formData });
                const result = await response.json();
                const resultDiv = document.getElementById('test-result');
                
                if (result.success) {
                    resultDiv.innerHTML = `
                        <div class="alert alert-success">
                            <strong>✓ Success!</strong><br>
                            Email: ${result.email}<br>
                            Token: <code>${result.token}</code>
                        </div>
                    `;
                } else {
                    resultDiv.innerHTML = `
                        <div class="alert alert-danger">
                            <strong>✗ Failed!</strong><br>
                            ${result.error}
                        </div>
                    `;
                }
            } catch (e) {
                alert('Error: ' + e.message);
            }
        }
        
        async function addSetting() {
            const key = document.getElementById('setting-key').value.trim();
            const value = document.getElementById('setting-value').value.trim();
            if (!key) { alert('Please enter a setting key'); return; }
            
            const formData = new FormData();
            formData.append('action', 'add_setting');
            formData.append('setting_key', key);
            formData.append('setting_value', value);
            
            try {
                const response = await fetch('', { method: 'POST', body: formData });
                const result = await response.json();
                alert(result.message || result.error);
                if (result.success) location.reload();
            } catch (e) {
                alert('Error: ' + e.message);
            }
        }
        
        function addQuickSetting(key, value) {
            document.getElementById('setting-key').value = key;
            document.getElementById('setting-value').value = value;
        }
    </script>
</body>
</html>
