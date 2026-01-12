<?php
/**
 * Admin User Setup Script
 * 
 * Single-use script to create the first admin user.
 * DELETE THIS FILE AFTER USE!
 * 
 * Usage: 
 *   Browser: https://yourdomain.com/api/setup-admin.php
 *   Or with params: ?email=admin@example.com&password=SecurePass123
 */

// Security headers
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');

// Check if config exists
if (!file_exists(__DIR__ . '/config.php')) {
    die('<h1>Error</h1><p>config.php not found. Please create it first from config.example.php</p>');
}

$config = require __DIR__ . '/config.php';

// Connect to database
try {
    $dsn = "mysql:host={$config['db']['host']};dbname={$config['db']['name']};charset={$config['db']['charset']}";
    $pdo = new PDO($dsn, $config['db']['user'], $config['db']['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    die('<h1>Database Error</h1><p>Could not connect: ' . htmlspecialchars($e->getMessage()) . '</p>');
}

// Check if admin already exists
$stmt = $pdo->query("SELECT COUNT(*) as count FROM user_roles WHERE role = 'admin'");
$result = $stmt->fetch();
if ($result['count'] > 0) {
    die('<h1>Admin Already Exists</h1><p>An admin user already exists. Delete this file for security.</p>');
}

// Handle form submission
$message = '';
$success = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST' || isset($_GET['email'])) {
    $email = $_POST['email'] ?? $_GET['email'] ?? '';
    $password = $_POST['password'] ?? $_GET['password'] ?? '';
    $displayName = $_POST['display_name'] ?? $_GET['display_name'] ?? 'Admin';
    
    if (empty($email) || empty($password)) {
        $message = 'Email and password are required.';
    } elseif (strlen($password) < 8) {
        $message = 'Password must be at least 8 characters.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $message = 'Invalid email format.';
    } else {
        try {
            $pdo->beginTransaction();
            
            // Generate UUIDs
            $userId = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );
            $profileId = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );
            $roleId = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );
            
            // Hash password
            $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
            
            // Create user
            $stmt = $pdo->prepare("
                INSERT INTO users (id, email, password_hash, created_at, updated_at) 
                VALUES (?, ?, ?, NOW(), NOW())
            ");
            $stmt->execute([$userId, $email, $passwordHash]);
            
            // Create profile
            $stmt = $pdo->prepare("
                INSERT INTO profiles (id, user_id, email, display_name, email_verified, created_at, updated_at) 
                VALUES (?, ?, ?, ?, 1, NOW(), NOW())
            ");
            $stmt->execute([$profileId, $userId, $email, $displayName]);
            
            // Assign admin role
            $stmt = $pdo->prepare("
                INSERT INTO user_roles (id, user_id, role, created_at) 
                VALUES (?, ?, 'admin', NOW())
            ");
            $stmt->execute([$roleId, $userId]);
            
            $pdo->commit();
            
            $success = true;
            $message = "Admin user created successfully!<br><br>
                <strong>Email:</strong> {$email}<br>
                <strong>User ID:</strong> {$userId}<br><br>
                <span style='color: #ff6b6b; font-weight: bold;'>⚠️ DELETE THIS FILE NOW!</span><br>
                <code>rm setup-admin.php</code>";
            
        } catch (PDOException $e) {
            $pdo->rollBack();
            $message = 'Database error: ' . htmlspecialchars($e->getMessage());
        }
    }
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create Admin User</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            color: #e0e0e0;
        }
        .container {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 40px;
            max-width: 450px;
            width: 100%;
            backdrop-filter: blur(10px);
        }
        h1 { 
            color: #00d9ff;
            margin-bottom: 10px;
            font-size: 24px;
        }
        .subtitle {
            color: #888;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            color: #aaa;
            font-size: 14px;
        }
        input {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            background: rgba(0,0,0,0.3);
            color: #fff;
            font-size: 16px;
            transition: border-color 0.2s;
        }
        input:focus {
            outline: none;
            border-color: #00d9ff;
        }
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #00d9ff, #0099cc);
            border: none;
            border-radius: 8px;
            color: #000;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 20px rgba(0, 217, 255, 0.3);
        }
        .message {
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            line-height: 1.6;
        }
        .message.success {
            background: rgba(0, 255, 100, 0.1);
            border: 1px solid rgba(0, 255, 100, 0.3);
            color: #00ff64;
        }
        .message.error {
            background: rgba(255, 100, 100, 0.1);
            border: 1px solid rgba(255, 100, 100, 0.3);
            color: #ff6b6b;
        }
        code {
            background: rgba(0,0,0,0.3);
            padding: 2px 8px;
            border-radius: 4px;
            font-family: 'Monaco', 'Consolas', monospace;
        }
        .warning {
            background: rgba(255, 200, 0, 0.1);
            border: 1px solid rgba(255, 200, 0, 0.3);
            border-radius: 8px;
            padding: 12px;
            margin-top: 20px;
            font-size: 13px;
            color: #ffc800;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Create Admin User</h1>
        <p class="subtitle">Set up your first administrator account</p>
        
        <?php if ($message): ?>
            <div class="message <?php echo $success ? 'success' : 'error'; ?>">
                <?php echo $message; ?>
            </div>
        <?php endif; ?>
        
        <?php if (!$success): ?>
            <form method="POST">
                <div class="form-group">
                    <label for="email">Email Address</label>
                    <input type="email" id="email" name="email" required 
                           placeholder="admin@example.com"
                           value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>">
                </div>
                
                <div class="form-group">
                    <label for="password">Password (min 8 characters)</label>
                    <input type="password" id="password" name="password" required 
                           placeholder="••••••••" minlength="8">
                </div>
                
                <div class="form-group">
                    <label for="display_name">Display Name (optional)</label>
                    <input type="text" id="display_name" name="display_name" 
                           placeholder="Admin"
                           value="<?php echo htmlspecialchars($_POST['display_name'] ?? 'Admin'); ?>">
                </div>
                
                <button type="submit">Create Admin Account</button>
            </form>
            
            <div class="warning">
                ⚠️ <strong>Security Warning:</strong> Delete this file immediately after creating your admin account!
            </div>
        <?php endif; ?>
    </div>
</body>
</html>
