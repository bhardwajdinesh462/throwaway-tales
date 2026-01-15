<?php
/**
 * TempMail Post-Installation Verification Script
 * 
 * Checks all components are working correctly after installation.
 * DELETE THIS FILE AFTER VERIFICATION!
 * 
 * Access Methods:
 * - From localhost
 * - With ?token=YOUR_DIAG_TOKEN (from config.php)
 * - During first-time setup (before admin is created)
 */

header('Content-Type: application/json');
header('Cache-Control: no-cache');

// Security: Check access permissions
$allowedIPs = ['127.0.0.1', '::1'];
$clientIP = $_SERVER['REMOTE_ADDR'] ?? '';
$token = $_GET['token'] ?? '';
$configToken = '';
$isFirstTimeSetup = false;

// Try to load config for token verification and check if first-time setup
if (file_exists(__DIR__ . '/config.php')) {
    try {
        $config = require __DIR__ . '/config.php';
        $configToken = $config['diag_token'] ?? '';
        
        // Try to connect to database and check for admin
        if (!empty($config['db']['host']) && !empty($config['db']['name'])) {
            try {
                $dsn = "mysql:host={$config['db']['host']};dbname={$config['db']['name']};charset=utf8mb4";
                $pdo = new PDO($dsn, $config['db']['user'], $config['db']['pass'], [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
                ]);
                
                // Check if user_roles table exists and has admins
                $stmt = $pdo->query("SHOW TABLES LIKE 'user_roles'");
                if ($stmt->fetch()) {
                    $stmt = $pdo->query("SELECT COUNT(*) FROM user_roles WHERE role = 'admin'");
                    $adminCount = $stmt->fetchColumn();
                    $isFirstTimeSetup = ($adminCount == 0);
                } else {
                    $isFirstTimeSetup = true; // Tables not created yet
                }
            } catch (PDOException $e) {
                // Database not ready - allow access for debugging
                $isFirstTimeSetup = true;
            }
        }
    } catch (Exception $e) {
        // Config error - allow access for debugging
        $isFirstTimeSetup = true;
    }
} else {
    // No config file - definitely first time setup
    $isFirstTimeSetup = true;
}

// Allow access if: localhost OR valid token OR first-time setup
$isLocalhost = in_array($clientIP, $allowedIPs);
$hasValidToken = !empty($configToken) && hash_equals($configToken, $token);

if (!$isLocalhost && !$hasValidToken && !$isFirstTimeSetup) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'Access denied. Use ?token=YOUR_DIAG_TOKEN or access from localhost.',
        'hint' => 'Find your diag_token in config.php (or access is allowed during first-time setup before admin is created)'
    ]);
    exit;
}

$checks = [];
$allPassed = true;

// Helper function
function addCheck(&$checks, $name, $category, $passed, $message, $details = null) {
    global $allPassed;
    $checks[] = [
        'name' => $name,
        'category' => $category,
        'passed' => $passed,
        'message' => $message,
        'details' => $details
    ];
    if (!$passed) $allPassed = false;
}

// ============================================
// 1. PHP CONFIGURATION CHECKS
// ============================================

// PHP Version
$phpVersion = phpversion();
$phpOk = version_compare($phpVersion, '8.0.0', '>=');
addCheck($checks, 'PHP Version', 'php', $phpOk, 
    $phpOk ? "PHP $phpVersion ✓" : "PHP $phpVersion (requires 8.0+)",
    ['version' => $phpVersion, 'required' => '8.0.0']
);

// Required Extensions
$requiredExtensions = ['pdo', 'pdo_mysql', 'json', 'mbstring', 'openssl'];
$optionalExtensions = ['imap', 'curl', 'gd', 'zip'];

foreach ($requiredExtensions as $ext) {
    $loaded = extension_loaded($ext);
    addCheck($checks, "Extension: $ext", 'php', $loaded,
        $loaded ? "$ext loaded ✓" : "$ext NOT loaded (required)"
    );
}

foreach ($optionalExtensions as $ext) {
    $loaded = extension_loaded($ext);
    addCheck($checks, "Extension: $ext (optional)", 'php', true,
        $loaded ? "$ext loaded ✓" : "$ext not loaded (optional, some features may not work)"
    );
}

// ============================================
// 2. FILE SYSTEM CHECKS
// ============================================

// Config file
$configExists = file_exists(__DIR__ . '/config.php');
addCheck($checks, 'Config File', 'files', $configExists,
    $configExists ? 'config.php exists ✓' : 'config.php missing'
);

// Storage directory
$storagePath = __DIR__ . '/storage';
$storageExists = is_dir($storagePath);
$storageWritable = $storageExists && is_writable($storagePath);
addCheck($checks, 'Storage Directory', 'files', $storageWritable,
    $storageWritable ? 'Storage directory writable ✓' : 'Storage directory not writable',
    ['path' => $storagePath, 'exists' => $storageExists, 'writable' => $storageWritable]
);

// Key files exist
$keyFiles = ['index.php', 'schema.sql', 'includes/db.php', 'includes/helpers.php'];
foreach ($keyFiles as $file) {
    $exists = file_exists(__DIR__ . '/' . $file);
    addCheck($checks, "File: $file", 'files', $exists,
        $exists ? "$file exists ✓" : "$file missing"
    );
}

// Route files
$routeFiles = glob(__DIR__ . '/routes/*.php');
addCheck($checks, 'Route Files', 'files', count($routeFiles) > 0,
    count($routeFiles) . ' route files found',
    ['files' => array_map('basename', $routeFiles)]
);

// Cron files
$cronFiles = glob(__DIR__ . '/cron/*.php');
addCheck($checks, 'Cron Files', 'files', count($cronFiles) > 0,
    count($cronFiles) . ' cron files found',
    ['files' => array_map('basename', $cronFiles)]
);

// ============================================
// 3. DATABASE CHECKS
// ============================================

if ($configExists) {
    try {
        $config = require __DIR__ . '/config.php';
        $dsn = "mysql:host={$config['db']['host']};dbname={$config['db']['name']};charset={$config['db']['charset']}";
        $pdo = new PDO($dsn, $config['db']['user'], $config['db']['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        
        addCheck($checks, 'Database Connection', 'database', true,
            'Connected to MySQL ✓',
            ['host' => $config['db']['host'], 'database' => $config['db']['name']]
        );
        
        // Check MySQL version
        $mysqlVersion = $pdo->query("SELECT VERSION()")->fetchColumn();
        addCheck($checks, 'MySQL Version', 'database', true,
            "MySQL $mysqlVersion ✓",
            ['version' => $mysqlVersion]
        );
        
        // Check required tables
        $requiredTables = [
            'users', 'profiles', 'user_roles', 'domains', 'temp_emails',
            'received_emails', 'email_attachments', 'app_settings', 'mailboxes',
            'subscription_tiers', 'user_subscriptions', 'email_stats', 'email_logs'
        ];
        
        $existingTables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
        
        foreach ($requiredTables as $table) {
            $exists = in_array($table, $existingTables);
            addCheck($checks, "Table: $table", 'database', $exists,
                $exists ? "$table exists ✓" : "$table missing"
            );
        }
        
        // Check admin exists
        $stmt = $pdo->query("SELECT COUNT(*) FROM user_roles WHERE role = 'admin'");
        $adminCount = $stmt->fetchColumn();
        addCheck($checks, 'Admin Account', 'database', $adminCount > 0,
            $adminCount > 0 ? "$adminCount admin(s) found ✓" : 'No admin account found'
        );
        
        // Check default subscription tier
        $stmt = $pdo->query("SELECT COUNT(*) FROM subscription_tiers");
        $tierCount = $stmt->fetchColumn();
        addCheck($checks, 'Subscription Tiers', 'database', $tierCount > 0,
            $tierCount > 0 ? "$tierCount tier(s) configured ✓" : 'No subscription tiers found'
        );
        
        // Check domains
        $stmt = $pdo->query("SELECT COUNT(*) FROM domains WHERE is_active = 1");
        $domainCount = $stmt->fetchColumn();
        addCheck($checks, 'Active Domains', 'database', true,
            $domainCount > 0 ? "$domainCount domain(s) configured ✓" : 'No domains configured (add via Admin Panel)'
        );
        
    } catch (PDOException $e) {
        addCheck($checks, 'Database Connection', 'database', false,
            'Connection failed: ' . $e->getMessage()
        );
    }
}

// ============================================
// 4. SECURITY CHECKS
// ============================================

// JWT secret configured
if ($configExists) {
    $config = require __DIR__ . '/config.php';
    $jwtSecret = $config['jwt']['secret'] ?? '';
    $jwtOk = strlen($jwtSecret) >= 32 && $jwtSecret !== 'CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_64_CHARS_MINIMUM';
    addCheck($checks, 'JWT Secret', 'security', $jwtOk,
        $jwtOk ? 'JWT secret configured ✓' : 'JWT secret not properly configured'
    );
    
    // CORS origins
    $corsOrigins = $config['cors']['origins'] ?? [];
    $corsConfigured = !empty($corsOrigins) && !in_array('https://yourdomain.com', $corsOrigins);
    addCheck($checks, 'CORS Configuration', 'security', $corsConfigured,
        $corsConfigured ? 'CORS origins configured ✓' : 'CORS origins need configuration (update config.php)'
    );
    
    // Install.php removed
    $installExists = file_exists(__DIR__ . '/install.php');
    addCheck($checks, 'Install Script Removed', 'security', !$installExists,
        $installExists ? 'install.php still exists (DELETE IT!)' : 'install.php removed ✓'
    );
    
    // .htaccess exists
    $htaccessExists = file_exists(__DIR__ . '/.htaccess');
    addCheck($checks, '.htaccess Protection', 'security', $htaccessExists,
        $htaccessExists ? '.htaccess configured ✓' : '.htaccess missing'
    );
}

// ============================================
// 5. EMAIL CONFIGURATION CHECKS
// ============================================

if ($configExists) {
    $config = require __DIR__ . '/config.php';
    
    // SMTP configured
    $smtpHost = $config['smtp']['host'] ?? '';
    $smtpConfigured = !empty($smtpHost) && $smtpHost !== 'smtp.example.com';
    addCheck($checks, 'SMTP Configuration', 'email', true,
        $smtpConfigured ? 'SMTP configured ✓' : 'SMTP not configured (configure via Admin Panel or config.php)'
    );
    
    // IMAP configured
    $imapHost = $config['imap']['host'] ?? '';
    $imapConfigured = !empty($imapHost) && $imapHost !== 'imap.example.com';
    addCheck($checks, 'IMAP Configuration', 'email', true,
        $imapConfigured ? 'IMAP configured ✓' : 'IMAP not configured (configure via Admin Panel or config.php)'
    );
    
    // Check mailboxes in database
    if (isset($pdo)) {
        $stmt = $pdo->query("SELECT COUNT(*) FROM mailboxes WHERE is_active = 1");
        $mailboxCount = $stmt->fetchColumn();
        addCheck($checks, 'Active Mailboxes', 'email', true,
            $mailboxCount > 0 ? "$mailboxCount mailbox(es) configured ✓" : 'No mailboxes configured (add via Admin Panel)'
        );
    }
}

// ============================================
// 6. API ENDPOINT TESTS
// ============================================

// Test health endpoint
$healthUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . 
             '://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']) . '/health';

$ch = curl_init($healthUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 5,
    CURLOPT_SSL_VERIFYPEER => false
]);
$healthResponse = curl_exec($ch);
$healthCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

addCheck($checks, 'Health Endpoint', 'api', $healthCode === 200,
    $healthCode === 200 ? 'Health endpoint responding ✓' : "Health endpoint returned $healthCode",
    ['url' => $healthUrl, 'status' => $healthCode]
);

// ============================================
// GENERATE REPORT
// ============================================

$categories = [];
foreach ($checks as $check) {
    $cat = $check['category'];
    if (!isset($categories[$cat])) {
        $categories[$cat] = ['passed' => 0, 'failed' => 0, 'checks' => []];
    }
    $categories[$cat]['checks'][] = $check;
    if ($check['passed']) {
        $categories[$cat]['passed']++;
    } else {
        $categories[$cat]['failed']++;
    }
}

$totalPassed = array_sum(array_column($checks, 'passed'));
$totalChecks = count($checks);

$response = [
    'success' => $allPassed,
    'timestamp' => date('c'),
    'summary' => [
        'total_checks' => $totalChecks,
        'passed' => $totalPassed,
        'failed' => $totalChecks - $totalPassed,
        'score' => round(($totalPassed / $totalChecks) * 100, 1) . '%'
    ],
    'categories' => $categories,
    'recommendations' => []
];

// Add recommendations for failed checks
if (!$allPassed) {
    foreach ($checks as $check) {
        if (!$check['passed']) {
            $response['recommendations'][] = [
                'issue' => $check['name'],
                'message' => $check['message']
            ];
        }
    }
}

// Pretty print for browser viewing
if (isset($_GET['format']) && $_GET['format'] === 'html') {
    header('Content-Type: text/html');
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Installation Verification</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; }
            .container { max-width: 900px; margin: 0 auto; }
            h1 { font-size: 24px; margin-bottom: 20px; }
            .score { font-size: 48px; font-weight: bold; margin: 20px 0; }
            .score.pass { color: #10b981; }
            .score.fail { color: #ef4444; }
            .category { background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
            .category h2 { font-size: 18px; margin-bottom: 15px; text-transform: capitalize; }
            .check { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
            .check:last-child { border-bottom: none; }
            .check-icon { width: 24px; height: 24px; border-radius: 50%; margin-right: 12px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
            .check-icon.pass { background: #10b981; }
            .check-icon.fail { background: #ef4444; }
            .check-name { flex: 1; }
            .check-msg { color: #94a3b8; font-size: 14px; }
            .warning { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); padding: 15px; border-radius: 8px; margin-top: 20px; color: #fcd34d; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔍 TempMail Installation Verification</h1>
            <div class="score <?php echo $allPassed ? 'pass' : 'fail'; ?>">
                <?php echo $response['summary']['score']; ?>
            </div>
            <p style="color: #94a3b8; margin-bottom: 30px;">
                <?php echo $totalPassed; ?> of <?php echo $totalChecks; ?> checks passed
            </p>
            
            <?php foreach ($categories as $catName => $cat): ?>
            <div class="category">
                <h2><?php echo ucfirst($catName); ?> (<?php echo $cat['passed']; ?>/<?php echo count($cat['checks']); ?>)</h2>
                <?php foreach ($cat['checks'] as $check): ?>
                <div class="check">
                    <div class="check-icon <?php echo $check['passed'] ? 'pass' : 'fail'; ?>">
                        <?php echo $check['passed'] ? '✓' : '✗'; ?>
                    </div>
                    <div class="check-name"><?php echo htmlspecialchars($check['name']); ?></div>
                    <div class="check-msg"><?php echo htmlspecialchars($check['message']); ?></div>
                </div>
                <?php endforeach; ?>
            </div>
            <?php endforeach; ?>
            
            <?php if (file_exists(__DIR__ . '/install.php') || file_exists(__DIR__ . '/verify-installation.php')): ?>
            <div class="warning">
                <strong>⚠️ Security Reminder:</strong> Delete <code>install.php</code> and <code>verify-installation.php</code> after verification!
            </div>
            <?php endif; ?>
        </div>
    </body>
    </html>
    <?php
    exit;
}

echo json_encode($response, JSON_PRETTY_PRINT);
