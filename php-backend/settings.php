<?php
/**
 * Admin Settings Page - Update configuration after installation
 * Allows updating SMTP/IMAP credentials without reinstalling
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
    die("Database connection failed: " . $e->getMessage());
}

// Check admin auth
$user = getAuthUserStandalone($pdo, $config);
$isAdmin = $user && checkIsAdminStandalone($pdo, $user['id']);

if (!$isAdmin) {
    header('HTTP/1.1 403 Forbidden');
    die('<h1>Admin access required</h1><p><a href="/">Return to homepage</a></p>');
}

$message = '';
$messageType = '';

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    switch ($action) {
        case 'update_config':
            $updates = [
                'jwt_secret' => $_POST['jwt_secret'] ?? $config['jwt_secret'],
                'site_name' => $_POST['site_name'] ?? $config['site_name'],
                'site_url' => $_POST['site_url'] ?? $config['site_url'],
            ];
            
            // Read current config
            $configFile = __DIR__ . '/config.php';
            $configContent = file_get_contents($configFile);
            
            foreach ($updates as $key => $value) {
                $pattern = "/'" . preg_quote($key, '/') . "'\s*=>\s*'[^']*'/";
                $replacement = "'" . $key . "' => '" . addslashes($value) . "'";
                $configContent = preg_replace($pattern, $replacement, $configContent);
            }
            
            if (file_put_contents($configFile, $configContent)) {
                $message = 'Configuration updated successfully!';
                $messageType = 'success';
            } else {
                $message = 'Failed to update configuration file.';
                $messageType = 'error';
            }
            break;
            
        case 'test_smtp':
            $host = $_POST['smtp_host'];
            $port = intval($_POST['smtp_port']);
            $user = $_POST['smtp_user'];
            $pass = $_POST['smtp_password'];
            $testEmail = $_POST['test_email'];
            
            // Test connection
            $socket = @fsockopen($host, $port, $errno, $errstr, 10);
            if ($socket) {
                fclose($socket);
                $message = "SMTP server at $host:$port is reachable!";
                $messageType = 'success';
            } else {
                $message = "Cannot connect to SMTP server: $errstr";
                $messageType = 'error';
            }
            break;
            
        case 'test_imap':
            if (!function_exists('imap_open')) {
                $message = 'PHP IMAP extension not installed.';
                $messageType = 'error';
            } else {
                $host = $_POST['imap_host'];
                $port = intval($_POST['imap_port']);
                $user = $_POST['imap_user'];
                $pass = $_POST['imap_password'];
                
                $mailbox = '{' . $host . ':' . $port . '/imap/ssl/novalidate-cert}INBOX';
                $imap = @imap_open($mailbox, $user, $pass, OP_READONLY, 1);
                
                if ($imap) {
                    $check = imap_check($imap);
                    imap_close($imap);
                    $message = "IMAP connection successful! {$check->Nmsgs} messages in inbox.";
                    $messageType = 'success';
                } else {
                    $message = 'IMAP connection failed: ' . imap_last_error();
                    $messageType = 'error';
                }
            }
            break;
    }
}

// Get current mailboxes
$mailboxes = $pdo->query("SELECT * FROM mailboxes ORDER BY priority ASC")->fetchAll(PDO::FETCH_ASSOC);
$domains = $pdo->query("SELECT * FROM domains ORDER BY name ASC")->fetchAll(PDO::FETCH_ASSOC);

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Settings</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-gray-900 text-white min-h-screen">
    <div class="container mx-auto px-4 py-8 max-w-4xl">
        <div class="flex items-center justify-between mb-8">
            <h1 class="text-3xl font-bold">
                <i class="fas fa-cog text-blue-500 mr-3"></i>
                Admin Settings
            </h1>
            <a href="/" class="text-gray-400 hover:text-white">
                <i class="fas fa-arrow-left mr-2"></i>Back to App
            </a>
        </div>

        <?php if ($message): ?>
        <div class="mb-6 p-4 rounded-lg <?= $messageType === 'success' ? 'bg-green-900 border border-green-600' : 'bg-red-900 border border-red-600' ?>">
            <i class="fas fa-<?= $messageType === 'success' ? 'check-circle' : 'exclamation-circle' ?> mr-2"></i>
            <?= htmlspecialchars($message) ?>
        </div>
        <?php endif; ?>

        <!-- Quick Links -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <a href="health-dashboard.php" class="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-center">
                <i class="fas fa-heartbeat text-3xl text-red-500 mb-2"></i>
                <p>Health Dashboard</p>
            </a>
            <a href="analytics.php" class="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-center">
                <i class="fas fa-chart-line text-3xl text-green-500 mb-2"></i>
                <p>Analytics</p>
            </a>
            <a href="test-smtp.php" class="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-center">
                <i class="fas fa-envelope text-3xl text-blue-500 mb-2"></i>
                <p>Test SMTP</p>
            </a>
            <a href="test-imap.php" class="bg-gray-800 hover:bg-gray-700 rounded-xl p-4 text-center">
                <i class="fas fa-inbox text-3xl text-purple-500 mb-2"></i>
                <p>Test IMAP</p>
            </a>
        </div>

        <!-- Configuration -->
        <div class="bg-gray-800 rounded-xl p-6 mb-8">
            <h2 class="text-xl font-semibold mb-4">
                <i class="fas fa-sliders-h text-yellow-400 mr-2"></i>
                General Configuration
            </h2>
            <form method="POST" class="space-y-4">
                <input type="hidden" name="action" value="update_config">
                
                <div>
                    <label class="block text-gray-400 text-sm mb-1">Site Name</label>
                    <input type="text" name="site_name" value="<?= htmlspecialchars($config['site_name'] ?? 'TempMail') ?>" 
                           class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                </div>
                
                <div>
                    <label class="block text-gray-400 text-sm mb-1">Site URL</label>
                    <input type="url" name="site_url" value="<?= htmlspecialchars($config['site_url'] ?? '') ?>" 
                           class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                </div>
                
                <div>
                    <label class="block text-gray-400 text-sm mb-1">JWT Secret (for authentication)</label>
                    <input type="password" name="jwt_secret" value="<?= htmlspecialchars($config['jwt_secret'] ?? '') ?>" 
                           class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                    <p class="text-xs text-gray-500 mt-1">Keep this secret! Changing it will log out all users.</p>
                </div>
                
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg">
                    <i class="fas fa-save mr-2"></i>Save Configuration
                </button>
            </form>
        </div>

        <!-- Mailboxes -->
        <div class="bg-gray-800 rounded-xl p-6 mb-8">
            <h2 class="text-xl font-semibold mb-4">
                <i class="fas fa-server text-green-400 mr-2"></i>
                Configured Mailboxes (<?= count($mailboxes) ?>)
            </h2>
            
            <?php if (empty($mailboxes)): ?>
            <p class="text-gray-400">No mailboxes configured. Add one through the admin panel.</p>
            <?php else: ?>
            <div class="space-y-4">
                <?php foreach ($mailboxes as $mb): ?>
                <div class="bg-gray-700 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="font-semibold"><?= htmlspecialchars($mb['name']) ?></h3>
                        <span class="px-2 py-1 rounded text-xs <?= $mb['is_active'] ? 'bg-green-600' : 'bg-gray-600' ?>">
                            <?= $mb['is_active'] ? 'Active' : 'Inactive' ?>
                        </span>
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-sm text-gray-400">
                        <div>
                            <strong>SMTP:</strong> <?= htmlspecialchars($mb['smtp_host'] ?: 'Not configured') ?>:<?= $mb['smtp_port'] ?>
                        </div>
                        <div>
                            <strong>IMAP:</strong> <?= htmlspecialchars($mb['imap_host'] ?: 'Not configured') ?>:<?= $mb['imap_port'] ?>
                        </div>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </div>

        <!-- Domains -->
        <div class="bg-gray-800 rounded-xl p-6 mb-8">
            <h2 class="text-xl font-semibold mb-4">
                <i class="fas fa-globe text-purple-400 mr-2"></i>
                Email Domains (<?= count($domains) ?>)
            </h2>
            
            <?php if (empty($domains)): ?>
            <p class="text-gray-400">No domains configured. Add one through the admin panel.</p>
            <?php else: ?>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <?php foreach ($domains as $domain): ?>
                <div class="bg-gray-700 rounded-lg p-3 flex items-center justify-between">
                    <span>@<?= htmlspecialchars($domain['name']) ?></span>
                    <div class="flex gap-2">
                        <?php if ($domain['is_premium']): ?>
                        <span class="px-2 py-1 rounded text-xs bg-yellow-600">Premium</span>
                        <?php endif; ?>
                        <span class="px-2 py-1 rounded text-xs <?= $domain['is_active'] ? 'bg-green-600' : 'bg-gray-600' ?>">
                            <?= $domain['is_active'] ? 'Active' : 'Inactive' ?>
                        </span>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </div>

        <!-- SMTP Test -->
        <div class="bg-gray-800 rounded-xl p-6 mb-8">
            <h2 class="text-xl font-semibold mb-4">
                <i class="fas fa-paper-plane text-blue-400 mr-2"></i>
                Test SMTP Connection
            </h2>
            <form method="POST" class="space-y-4">
                <input type="hidden" name="action" value="test_smtp">
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-gray-400 text-sm mb-1">SMTP Host</label>
                        <input type="text" name="smtp_host" placeholder="smtp.example.com" 
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                    </div>
                    <div>
                        <label class="block text-gray-400 text-sm mb-1">Port</label>
                        <input type="number" name="smtp_port" value="587" 
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-gray-400 text-sm mb-1">Username</label>
                        <input type="text" name="smtp_user" 
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                    </div>
                    <div>
                        <label class="block text-gray-400 text-sm mb-1">Password</label>
                        <input type="password" name="smtp_password" 
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                    </div>
                </div>
                
                <button type="submit" class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg">
                    <i class="fas fa-plug mr-2"></i>Test Connection
                </button>
            </form>
        </div>

        <!-- IMAP Test -->
        <div class="bg-gray-800 rounded-xl p-6">
            <h2 class="text-xl font-semibold mb-4">
                <i class="fas fa-inbox text-purple-400 mr-2"></i>
                Test IMAP Connection
            </h2>
            <form method="POST" class="space-y-4">
                <input type="hidden" name="action" value="test_imap">
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-gray-400 text-sm mb-1">IMAP Host</label>
                        <input type="text" name="imap_host" placeholder="imap.example.com" 
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                    </div>
                    <div>
                        <label class="block text-gray-400 text-sm mb-1">Port</label>
                        <input type="number" name="imap_port" value="993" 
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-gray-400 text-sm mb-1">Username</label>
                        <input type="text" name="imap_user" 
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                    </div>
                    <div>
                        <label class="block text-gray-400 text-sm mb-1">Password</label>
                        <input type="password" name="imap_password" 
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                    </div>
                </div>
                
                <button type="submit" class="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg">
                    <i class="fas fa-plug mr-2"></i>Test Connection
                </button>
            </form>
        </div>
    </div>
</body>
</html>
