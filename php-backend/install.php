<?php
/**
 * TempMail Installation Wizard
 * 
 * This script helps set up the database and create the first admin account.
 * DELETE THIS FILE AFTER INSTALLATION!
 */

// Prevent direct access if already installed
if (file_exists(__DIR__ . '/config.php')) {
    $config = require __DIR__ . '/config.php';
    if (!empty($config['db']['host']) && $config['db']['host'] !== 'localhost') {
        // Try to connect to check if already installed
        try {
            $dsn = "mysql:host={$config['db']['host']};dbname={$config['db']['name']};charset={$config['db']['charset']}";
            $pdo = new PDO($dsn, $config['db']['user'], $config['db']['pass']);
            $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'admin')");
            if ($stmt->fetchColumn() > 0) {
                die('<h1>Already Installed</h1><p>TempMail is already installed. Delete install.php for security.</p>');
            }
        } catch (PDOException $e) {
            // Not installed yet, continue
        }
    }
}
// Handle AJAX test connection request
if (isset($_GET['action']) && $_GET['action'] === 'test_connection') {
    header('Content-Type: application/json');
    
    $dbHost = trim($_POST['db_host'] ?? '');
    $dbName = trim($_POST['db_name'] ?? '');
    $dbUser = trim($_POST['db_user'] ?? '');
    $dbPass = $_POST['db_pass'] ?? '';
    
    if (empty($dbHost) || empty($dbName) || empty($dbUser)) {
        echo json_encode(['success' => false, 'message' => 'Please fill in all required fields']);
        exit;
    }
    
    try {
        // Test connection to MySQL server
        $dsn = "mysql:host={$dbHost};charset=utf8mb4";
        $pdo = new PDO($dsn, $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5
        ]);
        
        // Get MySQL version
        $version = $pdo->query("SELECT VERSION()")->fetchColumn();
        
        // Check if database exists
        $stmt = $pdo->query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = " . $pdo->quote($dbName));
        $dbExists = $stmt->fetchColumn() !== false;
        
        // Check privileges
        $canCreate = false;
        try {
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $canCreate = true;
        } catch (PDOException $e) {
            // Can't create database
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Connection successful!',
            'details' => [
                'mysql_version' => $version,
                'database_exists' => $dbExists,
                'can_create_database' => $canCreate,
                'host' => $dbHost
            ]
        ]);
    } catch (PDOException $e) {
        $errorMsg = $e->getMessage();
        
        // Provide helpful error messages
        if (strpos($errorMsg, 'Access denied') !== false) {
            $message = 'Access denied. Check username and password.';
        } elseif (strpos($errorMsg, 'Unknown MySQL server host') !== false || strpos($errorMsg, 'getaddrinfo') !== false) {
            $message = 'Cannot connect to host. Check the hostname.';
        } elseif (strpos($errorMsg, 'Connection refused') !== false) {
            $message = 'Connection refused. MySQL may not be running.';
        } elseif (strpos($errorMsg, 'Connection timed out') !== false) {
            $message = 'Connection timed out. Check firewall settings.';
        } else {
            $message = 'Connection failed: ' . $errorMsg;
        }
        
        echo json_encode(['success' => false, 'message' => $message]);
    }
    exit;
}

$step = isset($_GET['step']) ? (int)$_GET['step'] : 1;
$error = '';
$success = '';

// Handle form submissions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($step === 1) {
        // Database configuration
        $dbHost = trim($_POST['db_host'] ?? '');
        $dbName = trim($_POST['db_name'] ?? '');
        $dbUser = trim($_POST['db_user'] ?? '');
        $dbPass = $_POST['db_pass'] ?? '';
        
        if (empty($dbHost) || empty($dbName) || empty($dbUser)) {
            $error = 'Please fill in all required database fields.';
        } else {
            // Test connection
            try {
                $dsn = "mysql:host={$dbHost};charset=utf8mb4";
                $pdo = new PDO($dsn, $dbUser, $dbPass, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
                ]);
                
                // Create database if not exists
                $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                $pdo->exec("USE `{$dbName}`");
                
                // Run schema
                $schema = file_get_contents(__DIR__ . '/schema.sql');
                if ($schema === false) {
                    throw new Exception('Could not read schema.sql');
                }
                
                // Split and execute statements
                $statements = array_filter(array_map('trim', explode(';', $schema)));
                foreach ($statements as $statement) {
                    if (!empty($statement) && stripos($statement, 'SET FOREIGN_KEY_CHECKS') === false) {
                        try {
                            $pdo->exec($statement);
                        } catch (PDOException $e) {
                            // Ignore duplicate table errors
                            if (strpos($e->getMessage(), 'already exists') === false) {
                                // Log but continue
                            }
                        }
                    }
                }
                
                // Generate JWT secret
                $jwtSecret = bin2hex(random_bytes(32));
                
                // Create config file
                $configContent = "<?php
/**
 * Configuration file for PHP Backend
 * Generated by installer on " . date('Y-m-d H:i:s') . "
 */

return [
    // Database
    'db' => [
        'host' => " . var_export($dbHost, true) . ",
        'name' => " . var_export($dbName, true) . ",
        'user' => " . var_export($dbUser, true) . ",
        'pass' => " . var_export($dbPass, true) . ",
        'charset' => 'utf8mb4',
    ],
    
    // JWT Authentication
    'jwt' => [
        'secret' => '{$jwtSecret}',
        'expiry' => 60 * 60 * 24 * 7, // 7 days
        'algorithm' => 'HS256',
    ],
    
    // CORS - UPDATE THIS with your domain
    'cors' => [
        'origins' => ['https://yourdomain.com', 'http://localhost:5173'],
        'methods' => ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        'headers' => ['Content-Type', 'Authorization'],
    ],
    
    // Storage
    'storage' => [
        'path' => __DIR__ . '/storage',
        'max_size' => 10 * 1024 * 1024, // 10MB
        'allowed_types' => ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    ],
    
    // OAuth (optional)
    'oauth' => [
        'google' => [
            'client_id' => '',
            'client_secret' => '',
            'redirect_uri' => '',
        ],
        'facebook' => [
            'app_id' => '',
            'app_secret' => '',
            'redirect_uri' => '',
        ],
    ],
    
    // Email (SMTP) - Configure via Admin Panel
    'smtp' => [
        'host' => '',
        'port' => 587,
        'user' => '',
        'pass' => '',
        'from' => '',
        'from_name' => 'TempMail',
    ],
    
    // IMAP Settings - Configure via Admin Panel
    'imap' => [
        'host' => '',
        'port' => 993,
        'user' => '',
        'pass' => '',
        'encryption' => 'ssl',
        'folder' => 'INBOX',
    ],
    
    // Payment Gateways (optional - configure via Admin Panel)
    'stripe' => [
        'publishable_key' => '',
        'secret_key' => '',
        'webhook_secret' => '',
        'test_mode' => true,
    ],
    
    'paypal' => [
        'client_id' => '',
        'client_secret' => '',
        'webhook_id' => '',
        'mode' => 'sandbox',
    ],
    
    // reCAPTCHA (optional)
    'recaptcha' => [
        'site_key' => '',
        'secret_key' => '',
    ],
    
    // Security Settings
    'security' => [
        'rate_limit' => 100,
        'login_attempts' => 5,
        'lockout_time' => 900,
    ],
    
    // Diagnostics Token
    'diag_token' => '" . bin2hex(random_bytes(16)) . "',
];";
                
                if (file_put_contents(__DIR__ . '/config.php', $configContent) === false) {
                    throw new Exception('Could not write config.php. Check directory permissions.');
                }
                
                // Create storage directory
                $storagePath = __DIR__ . '/storage';
                if (!is_dir($storagePath)) {
                    mkdir($storagePath, 0755, true);
                }
                
                // Create .htaccess for storage
                file_put_contents($storagePath . '/.htaccess', "Deny from all");
                
                header('Location: install.php?step=2');
                exit;
                
            } catch (PDOException $e) {
                $error = 'Database connection failed: ' . $e->getMessage();
            } catch (Exception $e) {
                $error = $e->getMessage();
            }
        }
    } elseif ($step === 2) {
        // Admin account creation
        $email = trim($_POST['admin_email'] ?? '');
        $password = $_POST['admin_password'] ?? '';
        $confirmPassword = $_POST['admin_password_confirm'] ?? '';
        $displayName = trim($_POST['display_name'] ?? 'Admin');
        
        if (empty($email) || empty($password)) {
            $error = 'Please fill in all required fields.';
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $error = 'Please enter a valid email address.';
        } elseif (strlen($password) < 8) {
            $error = 'Password must be at least 8 characters long.';
        } elseif ($password !== $confirmPassword) {
            $error = 'Passwords do not match.';
        } else {
            try {
                $config = require __DIR__ . '/config.php';
                $dsn = "mysql:host={$config['db']['host']};dbname={$config['db']['name']};charset={$config['db']['charset']}";
                $pdo = new PDO($dsn, $config['db']['user'], $config['db']['pass'], [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
                ]);
                
                // Create user
                $userId = sprintf('%s-%s-%s-%s-%s',
                    bin2hex(random_bytes(4)),
                    bin2hex(random_bytes(2)),
                    bin2hex(random_bytes(2)),
                    bin2hex(random_bytes(2)),
                    bin2hex(random_bytes(6))
                );
                
                $passwordHash = password_hash($password, PASSWORD_DEFAULT);
                
                $stmt = $pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, NOW())");
                $stmt->execute([$userId, $email, $passwordHash, $displayName]);
                
                // Create profile
                $profileId = sprintf('%s-%s-%s-%s-%s',
                    bin2hex(random_bytes(4)),
                    bin2hex(random_bytes(2)),
                    bin2hex(random_bytes(2)),
                    bin2hex(random_bytes(2)),
                    bin2hex(random_bytes(6))
                );
                
                $stmt = $pdo->prepare("INSERT INTO profiles (id, user_id, email, display_name, email_verified, created_at) VALUES (?, ?, ?, ?, TRUE, NOW())");
                $stmt->execute([$profileId, $userId, $email, $displayName]);
                
                // Assign admin role
                $roleId = sprintf('%s-%s-%s-%s-%s',
                    bin2hex(random_bytes(4)),
                    bin2hex(random_bytes(2)),
                    bin2hex(random_bytes(2)),
                    bin2hex(random_bytes(2)),
                    bin2hex(random_bytes(6))
                );
                
                $stmt = $pdo->prepare("INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, 'admin', NOW())");
                $stmt->execute([$roleId, $userId]);
                
                // Insert default subscription tier
                $tierId = sprintf('%s-%s-%s-%s-%s',
                    bin2hex(random_bytes(4)),
                    bin2hex(random_bytes(2)),
                    bin2hex(random_bytes(2)),
                    bin2hex(random_bytes(2)),
                    bin2hex(random_bytes(6))
                );
                
                $stmt = $pdo->prepare("INSERT IGNORE INTO subscription_tiers (id, name, price_monthly, price_yearly, max_temp_emails, email_expiry_hours, features, is_active) VALUES (?, 'Free', 0, 0, 3, 1, '[]', TRUE)");
                $stmt->execute([$tierId]);
                
                // Initialize email stats
                $stats = ['emails_today', 'emails_total', 'temp_emails_created', 'active_users'];
                foreach ($stats as $stat) {
                    $statId = sprintf('%s-%s-%s-%s-%s',
                        bin2hex(random_bytes(4)),
                        bin2hex(random_bytes(2)),
                        bin2hex(random_bytes(2)),
                        bin2hex(random_bytes(2)),
                        bin2hex(random_bytes(6))
                    );
                    $stmt = $pdo->prepare("INSERT IGNORE INTO email_stats (id, stat_key, stat_value) VALUES (?, ?, 0)");
                    $stmt->execute([$statId, $stat]);
                }
                
                header('Location: install.php?step=3');
                exit;
                
            } catch (PDOException $e) {
                $error = 'Database error: ' . $e->getMessage();
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TempMail Installation</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            color: #e4e4e7;
        }
        .container {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        h1 {
            font-size: 28px;
            margin-bottom: 10px;
            color: #fff;
        }
        .subtitle {
            color: #a1a1aa;
            margin-bottom: 30px;
        }
        .steps {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
        }
        .step {
            flex: 1;
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
        }
        .step.active {
            background: #8b5cf6;
        }
        .step.completed {
            background: #10b981;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #d4d4d8;
        }
        input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            background: rgba(0, 0, 0, 0.3);
            color: #fff;
            font-size: 16px;
            transition: border-color 0.2s;
        }
        input:focus {
            outline: none;
            border-color: #8b5cf6;
        }
        input.error {
            border-color: #ef4444;
        }
        input.success {
            border-color: #10b981;
        }
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
            border: none;
            border-radius: 8px;
            color: #fff;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
        }
        button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px -10px rgba(139, 92, 246, 0.5);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }
        .error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .success {
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #6ee7b7;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .field-error {
            color: #fca5a5;
            font-size: 13px;
            margin-top: 6px;
            display: none;
        }
        .field-error.visible {
            display: block;
        }
        .password-strength {
            margin-top: 10px;
        }
        .strength-bar {
            height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 6px;
        }
        .strength-fill {
            height: 100%;
            width: 0%;
            transition: width 0.3s, background 0.3s;
            border-radius: 3px;
        }
        .strength-fill.weak { width: 25%; background: #ef4444; }
        .strength-fill.fair { width: 50%; background: #f59e0b; }
        .strength-fill.good { width: 75%; background: #3b82f6; }
        .strength-fill.strong { width: 100%; background: #10b981; }
        .strength-text {
            font-size: 12px;
            color: #71717a;
        }
        .strength-text.weak { color: #fca5a5; }
        .strength-text.fair { color: #fcd34d; }
        .strength-text.good { color: #93c5fd; }
        .strength-text.strong { color: #6ee7b7; }
        .requirements {
            margin-top: 12px;
            padding: 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
        }
        .requirements h4 {
            font-size: 12px;
            color: #a1a1aa;
            margin-bottom: 8px;
            font-weight: 500;
        }
        .requirement {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #71717a;
            margin-bottom: 4px;
        }
        .requirement.met {
            color: #6ee7b7;
        }
        .requirement-icon {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            background: rgba(255, 255, 255, 0.1);
        }
        .requirement.met .requirement-icon {
            background: #10b981;
        }
        .warning {
            background: rgba(245, 158, 11, 0.1);
            border: 1px solid rgba(245, 158, 11, 0.3);
            color: #fcd34d;
            padding: 16px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .warning h3 {
            margin-bottom: 10px;
            color: #fbbf24;
        }
        .warning ul {
            margin-left: 20px;
        }
        .warning li {
            margin-bottom: 5px;
        }
        code {
            background: rgba(0, 0, 0, 0.3);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 14px;
        }
        .check-list {
            list-style: none;
            margin-top: 20px;
        }
        .check-list li {
            padding: 10px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .check-list li:last-child {
            border-bottom: none;
        }
        .check-icon {
            width: 24px;
            height: 24px;
            background: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .check-icon::after {
            content: '✓';
            color: white;
            font-size: 14px;
        }
        .match-indicator {
            font-size: 12px;
            margin-top: 6px;
        }
        .match-indicator.match {
            color: #6ee7b7;
        }
        .match-indicator.no-match {
            color: #fca5a5;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 TempMail Setup</h1>
        <p class="subtitle">Step <?php echo $step; ?> of 3</p>
        
        <div class="steps">
            <div class="step <?php echo $step > 1 ? 'completed' : ($step === 1 ? 'active' : ''); ?>"></div>
            <div class="step <?php echo $step > 2 ? 'completed' : ($step === 2 ? 'active' : ''); ?>"></div>
            <div class="step <?php echo $step === 3 ? 'active' : ''; ?>"></div>
        </div>
        
        <?php if ($error): ?>
            <div class="error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        
        <?php if ($step === 1): ?>
            <h2 style="margin-bottom: 20px;">Database Configuration</h2>
            <form method="POST" id="dbForm">
                <div class="form-group">
                    <label for="db_host">MySQL Host *</label>
                    <input type="text" id="db_host" name="db_host" value="localhost" required placeholder="localhost">
                </div>
                <div class="form-group">
                    <label for="db_name">Database Name *</label>
                    <input type="text" id="db_name" name="db_name" required placeholder="tempmail_db">
                    <div class="field-hint" style="font-size: 12px; color: #71717a; margin-top: 4px;">Will be created if it doesn't exist</div>
                </div>
                <div class="form-group">
                    <label for="db_user">Database User *</label>
                    <input type="text" id="db_user" name="db_user" required placeholder="db_username">
                </div>
                <div class="form-group">
                    <label for="db_pass">Database Password</label>
                    <input type="password" id="db_pass" name="db_pass" placeholder="••••••••">
                </div>
                
                <div id="test_result" style="display: none; margin-bottom: 20px; padding: 12px 16px; border-radius: 8px;"></div>
                
                <div style="display: flex; gap: 12px;">
                    <button type="button" id="test_btn" onclick="testConnection()" style="flex: 1; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);">
                        🔌 Test Connection
                    </button>
                    <button type="submit" id="submit_btn" style="flex: 2;">
                        Connect & Create Tables →
                    </button>
                </div>
            </form>
            
            <script>
            let connectionTested = false;
            
            function testConnection() {
                const btn = document.getElementById('test_btn');
                const result = document.getElementById('test_result');
                const submitBtn = document.getElementById('submit_btn');
                
                const host = document.getElementById('db_host').value.trim();
                const name = document.getElementById('db_name').value.trim();
                const user = document.getElementById('db_user').value.trim();
                const pass = document.getElementById('db_pass').value;
                
                if (!host || !name || !user) {
                    result.style.display = 'block';
                    result.style.background = 'rgba(239, 68, 68, 0.1)';
                    result.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                    result.style.color = '#fca5a5';
                    result.innerHTML = '⚠️ Please fill in all required fields';
                    return;
                }
                
                btn.disabled = true;
                btn.innerHTML = '⏳ Testing...';
                result.style.display = 'none';
                
                const formData = new FormData();
                formData.append('db_host', host);
                formData.append('db_name', name);
                formData.append('db_user', user);
                formData.append('db_pass', pass);
                
                fetch('install.php?action=test_connection', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    result.style.display = 'block';
                    
                    if (data.success) {
                        result.style.background = 'rgba(16, 185, 129, 0.1)';
                        result.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                        result.style.color = '#6ee7b7';
                        
                        let details = '<strong>✅ ' + data.message + '</strong><br><br>';
                        details += '<div style="font-size: 13px; opacity: 0.9;">';
                        details += '• MySQL Version: ' + data.details.mysql_version + '<br>';
                        details += '• Database exists: ' + (data.details.database_exists ? 'Yes ✓' : 'No (will be created)') + '<br>';
                        details += '• Create privileges: ' + (data.details.can_create_database ? 'Yes ✓' : 'Limited') + '<br>';
                        details += '</div>';
                        result.innerHTML = details;
                        
                        connectionTested = true;
                        submitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                    } else {
                        result.style.background = 'rgba(239, 68, 68, 0.1)';
                        result.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                        result.style.color = '#fca5a5';
                        result.innerHTML = '❌ ' + data.message;
                        connectionTested = false;
                    }
                })
                .catch(error => {
                    result.style.display = 'block';
                    result.style.background = 'rgba(239, 68, 68, 0.1)';
                    result.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                    result.style.color = '#fca5a5';
                    result.innerHTML = '❌ Network error. Please try again.';
                })
                .finally(() => {
                    btn.disabled = false;
                    btn.innerHTML = '🔌 Test Connection';
                });
            }
            
            // Reset test status when inputs change
            document.querySelectorAll('#dbForm input').forEach(input => {
                input.addEventListener('input', () => {
                    connectionTested = false;
                    document.getElementById('submit_btn').style.background = '';
                    document.getElementById('test_result').style.display = 'none';
                });
            });
            </script>
            
        <?php elseif ($step === 2): ?>
            <h2 style="margin-bottom: 20px;">Create Admin Account</h2>
            <form method="POST" id="adminForm">
                <div class="form-group">
                    <label for="display_name">Display Name</label>
                    <input type="text" id="display_name" name="display_name" value="Admin" placeholder="Admin" maxlength="100">
                </div>
                <div class="form-group">
                    <label for="admin_email">Email Address *</label>
                    <input type="email" id="admin_email" name="admin_email" required placeholder="admin@yourdomain.com" maxlength="255">
                    <div class="field-error" id="email_error">Please enter a valid email address</div>
                </div>
                <div class="form-group">
                    <label for="admin_password">Password *</label>
                    <input type="password" id="admin_password" name="admin_password" required placeholder="••••••••" maxlength="128">
                    <div class="password-strength">
                        <div class="strength-bar">
                            <div class="strength-fill" id="strength_fill"></div>
                        </div>
                        <div class="strength-text" id="strength_text">Enter a password</div>
                    </div>
                    <div class="requirements">
                        <h4>Password Requirements</h4>
                        <div class="requirement" id="req_length">
                            <span class="requirement-icon">✓</span>
                            <span>At least 8 characters</span>
                        </div>
                        <div class="requirement" id="req_upper">
                            <span class="requirement-icon">✓</span>
                            <span>One uppercase letter</span>
                        </div>
                        <div class="requirement" id="req_lower">
                            <span class="requirement-icon">✓</span>
                            <span>One lowercase letter</span>
                        </div>
                        <div class="requirement" id="req_number">
                            <span class="requirement-icon">✓</span>
                            <span>One number</span>
                        </div>
                        <div class="requirement" id="req_special">
                            <span class="requirement-icon">✓</span>
                            <span>One special character (!@#$%^&*)</span>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label for="admin_password_confirm">Confirm Password *</label>
                    <input type="password" id="admin_password_confirm" name="admin_password_confirm" required placeholder="••••••••" maxlength="128">
                    <div class="match-indicator" id="match_indicator"></div>
                </div>
                <button type="submit" id="submit_btn" disabled>Create Admin Account →</button>
            </form>
            
            <script>
            (function() {
                const password = document.getElementById('admin_password');
                const confirm = document.getElementById('admin_password_confirm');
                const email = document.getElementById('admin_email');
                const submitBtn = document.getElementById('submit_btn');
                const strengthFill = document.getElementById('strength_fill');
                const strengthText = document.getElementById('strength_text');
                const matchIndicator = document.getElementById('match_indicator');
                const emailError = document.getElementById('email_error');
                
                const requirements = {
                    length: { el: document.getElementById('req_length'), test: p => p.length >= 8 },
                    upper: { el: document.getElementById('req_upper'), test: p => /[A-Z]/.test(p) },
                    lower: { el: document.getElementById('req_lower'), test: p => /[a-z]/.test(p) },
                    number: { el: document.getElementById('req_number'), test: p => /[0-9]/.test(p) },
                    special: { el: document.getElementById('req_special'), test: p => /[!@#$%^&*(),.?":{}|<>]/.test(p) }
                };
                
                function validateEmail(emailValue) {
                    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    return re.test(emailValue);
                }
                
                function checkPasswordStrength(pwd) {
                    let score = 0;
                    let metCount = 0;
                    
                    for (const key in requirements) {
                        const met = requirements[key].test(pwd);
                        requirements[key].el.classList.toggle('met', met);
                        if (met) metCount++;
                    }
                    
                    // Calculate score
                    score = metCount;
                    if (pwd.length >= 12) score++;
                    if (pwd.length >= 16) score++;
                    
                    // Update UI
                    strengthFill.className = 'strength-fill';
                    strengthText.className = 'strength-text';
                    
                    if (pwd.length === 0) {
                        strengthText.textContent = 'Enter a password';
                    } else if (score <= 2) {
                        strengthFill.classList.add('weak');
                        strengthText.classList.add('weak');
                        strengthText.textContent = 'Weak - Add more character types';
                    } else if (score <= 4) {
                        strengthFill.classList.add('fair');
                        strengthText.classList.add('fair');
                        strengthText.textContent = 'Fair - Consider adding more';
                    } else if (score <= 5) {
                        strengthFill.classList.add('good');
                        strengthText.classList.add('good');
                        strengthText.textContent = 'Good - Almost there!';
                    } else {
                        strengthFill.classList.add('strong');
                        strengthText.classList.add('strong');
                        strengthText.textContent = 'Strong - Excellent password!';
                    }
                    
                    return metCount >= 3 && pwd.length >= 8;
                }
                
                function checkMatch() {
                    const pwd = password.value;
                    const conf = confirm.value;
                    
                    if (conf.length === 0) {
                        matchIndicator.textContent = '';
                        matchIndicator.className = 'match-indicator';
                        confirm.classList.remove('success', 'error');
                        return false;
                    }
                    
                    if (pwd === conf) {
                        matchIndicator.textContent = '✓ Passwords match';
                        matchIndicator.className = 'match-indicator match';
                        confirm.classList.add('success');
                        confirm.classList.remove('error');
                        return true;
                    } else {
                        matchIndicator.textContent = '✗ Passwords do not match';
                        matchIndicator.className = 'match-indicator no-match';
                        confirm.classList.add('error');
                        confirm.classList.remove('success');
                        return false;
                    }
                }
                
                function validateForm() {
                    const emailValid = validateEmail(email.value);
                    const passwordStrong = checkPasswordStrength(password.value);
                    const passwordsMatch = checkMatch();
                    
                    // Update email field state
                    if (email.value.length > 0) {
                        email.classList.toggle('success', emailValid);
                        email.classList.toggle('error', !emailValid);
                        emailError.classList.toggle('visible', !emailValid);
                    } else {
                        email.classList.remove('success', 'error');
                        emailError.classList.remove('visible');
                    }
                    
                    // Enable/disable submit
                    submitBtn.disabled = !(emailValid && passwordStrong && passwordsMatch);
                }
                
                // Event listeners
                password.addEventListener('input', validateForm);
                confirm.addEventListener('input', validateForm);
                email.addEventListener('input', validateForm);
                email.addEventListener('blur', validateForm);
                
                // Form submit validation
                document.getElementById('adminForm').addEventListener('submit', function(e) {
                    if (submitBtn.disabled) {
                        e.preventDefault();
                        return false;
                    }
                });
            })();
            </script>
            
        <?php elseif ($step === 3): ?>
            <div class="success">✅ Installation completed successfully!</div>
            
            <h2 style="margin-bottom: 20px;">Setup Complete</h2>
            
            <ul class="check-list">
                <li><span class="check-icon"></span> Database tables created</li>
                <li><span class="check-icon"></span> Configuration file generated</li>
                <li><span class="check-icon"></span> Admin account created</li>
                <li><span class="check-icon"></span> Storage directory configured</li>
            </ul>
            
            <div class="warning">
                <h3>⚠️ Important Security Steps</h3>
                <ul>
                    <li><strong>Delete this file:</strong> <code>install.php</code></li>
                    <li>Delete <code>verify-installation.php</code> after verification</li>
                    <li>Update <code>config.php</code> with your domain in CORS origins</li>
                    <li>Configure SMTP/IMAP in the Admin Panel</li>
                    <li>Set up cron jobs for email polling</li>
                </ul>
            </div>
            
            <div style="margin-top: 30px;">
                <a href="verify-installation.php?format=html" style="display: block; text-align: center; padding: 12px; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 8px; color: #c4b5fd; text-decoration: none; margin-bottom: 15px;">
                    🔍 Verify Installation
                </a>
                <a href="../" style="display: block; text-align: center; color: #8b5cf6; text-decoration: none; margin-bottom: 15px;">
                    → Go to TempMail Homepage
                </a>
                <a href="../auth" style="display: block; text-align: center; color: #8b5cf6; text-decoration: none;">
                    → Login to Admin Panel
                </a>
            </div>
        <?php endif; ?>
    </div>
</body>
</html>
