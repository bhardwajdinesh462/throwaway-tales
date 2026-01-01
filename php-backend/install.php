<?php
/**
 * TempMail PHP Backend Installer
 * 
 * This script helps you set up the TempMail backend on cPanel/shared hosting.
 * Access this file in your browser to run the installation wizard.
 * 
 * IMPORTANT: Delete this file after installation for security!
 */

session_start();

// Handle JSON API requests from frontend SetupWizard
if ($_SERVER['REQUEST_METHOD'] === 'POST' && strpos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== false) {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
    
    switch ($action) {
        case 'check_setup':
            // Check if installation is needed
            $needsSetup = !file_exists(__DIR__ . '/config.php') || !file_exists(__DIR__ . '/.install_lock');
            echo json_encode(['needs_setup' => $needsSetup]);
            exit;
            
        case 'test_database':
            $dbHost = trim($input['host'] ?? 'localhost');
            $dbName = trim($input['name'] ?? '');
            $dbUser = trim($input['user'] ?? '');
            $dbPass = $input['pass'] ?? '';
            
            try {
                $pdo = new PDO(
                    "mysql:host={$dbHost};charset=utf8mb4",
                    $dbUser,
                    $dbPass,
                    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
                );
                $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                $pdo->exec("USE `{$dbName}`");
                echo json_encode(['success' => true, 'message' => 'Database connection successful']);
            } catch (PDOException $e) {
                echo json_encode(['success' => false, 'error' => 'Database connection failed: ' . $e->getMessage()]);
            }
            exit;
            
        case 'create_tables':
            $db = $input;
            try {
                $pdo = new PDO(
                    "mysql:host={$db['host']};dbname={$db['name']};charset=utf8mb4",
                    $db['user'],
                    $db['pass'],
                    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
                );
                
                $schemaPath = __DIR__ . '/schema.sql';
                if (!file_exists($schemaPath)) {
                    echo json_encode(['success' => false, 'error' => 'schema.sql not found']);
                    exit;
                }
                
                $schema = file_get_contents($schemaPath);
                $statements = preg_split('/;\s*$/m', $schema);
                $created = 0;
                
                foreach ($statements as $stmt) {
                    $stmt = trim($stmt);
                    if (!empty($stmt) && !preg_match('/^DELIMITER/i', $stmt)) {
                        try {
                            $pdo->exec($stmt);
                            if (stripos($stmt, 'CREATE TABLE') !== false) $created++;
                        } catch (PDOException $e) {
                            // Ignore "already exists" errors
                            if (strpos($e->getMessage(), 'already exists') === false && 
                                strpos($e->getMessage(), 'Duplicate') === false) {
                                throw $e;
                            }
                        }
                    }
                }
                
                echo json_encode(['success' => true, 'tables_created' => $created]);
            } catch (PDOException $e) {
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            exit;
            
        case 'create_admin':
            $db = $input['db'] ?? [];
            $admin = $input['admin'] ?? [];
            
            if (empty($admin['email']) || empty($admin['password'])) {
                echo json_encode(['success' => false, 'error' => 'Email and password required']);
                exit;
            }
            
            try {
                $pdo = new PDO(
                    "mysql:host={$db['host']};dbname={$db['name']};charset=utf8mb4",
                    $db['user'],
                    $db['pass'],
                    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
                );
                
                $userId = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                    mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                    mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
                    mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
                $hashedPassword = password_hash($admin['password'], PASSWORD_BCRYPT, ['cost' => 12]);
                
                // Create user
                $stmt = $pdo->prepare("INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())");
                $stmt->execute([$userId, $admin['email'], $hashedPassword]);
                
                // Create profile
                $profileId = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                    mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                    mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
                    mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
                $stmt = $pdo->prepare("INSERT INTO profiles (id, user_id, email, display_name, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW())");
                $stmt->execute([$profileId, $userId, $admin['email'], $admin['display_name'] ?? 'Admin']);
                
                // Assign admin role
                $roleId = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                    mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                    mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
                    mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
                $stmt = $pdo->prepare("INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, 'admin', NOW())");
                $stmt->execute([$roleId, $userId]);
                
                echo json_encode(['success' => true, 'user_id' => $userId]);
            } catch (PDOException $e) {
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            exit;
            
        case 'save_config':
            $db = $input['db'] ?? [];
            $smtp = $input['smtp'] ?? [];
            $imap = $input['imap'] ?? [];
            $jwtSecret = bin2hex(random_bytes(32));
            $date = date('Y-m-d H:i:s');
            
            $configContent = "<?php\n/**\n * TempMail Configuration - Generated {$date}\n */\n\n";
            $configContent .= "define('DB_HOST', '{$db['host']}');\n";
            $configContent .= "define('DB_NAME', '{$db['name']}');\n";
            $configContent .= "define('DB_USER', '{$db['user']}');\n";
            $configContent .= "define('DB_PASS', '{$db['pass']}');\n\n";
            $configContent .= "define('JWT_SECRET', '{$jwtSecret}');\n";
            $configContent .= "define('JWT_EXPIRY', 604800);\n\n";
            $configContent .= "define('SMTP_HOST', '{$smtp['host']}');\n";
            $configContent .= "define('SMTP_PORT', {$smtp['port']});\n";
            $configContent .= "define('SMTP_USER', '{$smtp['user']}');\n";
            $configContent .= "define('SMTP_PASS', '{$smtp['pass']}');\n";
            $configContent .= "define('SMTP_FROM', '{$smtp['from']}');\n\n";
            $configContent .= "define('IMAP_HOST', '{$imap['host']}');\n";
            $configContent .= "define('IMAP_PORT', {$imap['port']});\n";
            $configContent .= "define('IMAP_USER', '{$imap['user']}');\n";
            $configContent .= "define('IMAP_PASS', '{$imap['pass']}');\n\n";
            $configContent .= "define('STORAGE_PATH', __DIR__ . '/storage');\n";
            $configContent .= "define('ENCRYPTION_KEY', '{$jwtSecret}');\n";
            
            if (file_put_contents(__DIR__ . '/config.php', $configContent)) {
                // Create directories
                foreach (['/storage', '/storage/avatars', '/storage/attachments', '/logs'] as $dir) {
                    if (!is_dir(__DIR__ . $dir)) mkdir(__DIR__ . $dir, 0755, true);
                }
                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'error' => 'Failed to write config.php']);
            }
            exit;
            
        case 'complete_setup':
            file_put_contents(__DIR__ . '/.install_lock', date('Y-m-d H:i:s'));
            echo json_encode(['success' => true]);
            exit;
            
        default:
            echo json_encode(['error' => 'Unknown action']);
            exit;
    }
}

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit;
}

// Check if already installed (for HTML version)
if (file_exists(__DIR__ . '/.install_lock') && !isset($_GET['force'])) {
    die('<h1>Installation Complete</h1><p>TempMail is already installed. Delete this file for security.</p>');
}

// Installation steps
$steps = [
    1 => 'Requirements Check',
    2 => 'Database Configuration',
    3 => 'Create Database Tables',
    4 => 'Admin Account',
    5 => 'SMTP Configuration',
    6 => 'Complete'
];

$currentStep = isset($_POST['step']) ? (int)$_POST['step'] : 1;
$errors = [];
$success = [];

// Helper function to generate UUID
function generateInstallUUID(): string {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

// Handle form submissions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    switch ($currentStep) {
        case 2:
            // Test database connection
            $dbHost = trim($_POST['db_host'] ?? 'localhost');
            $dbName = trim($_POST['db_name'] ?? '');
            $dbUser = trim($_POST['db_user'] ?? '');
            $dbPass = $_POST['db_pass'] ?? '';
            
            try {
                $pdo = new PDO(
                    "mysql:host={$dbHost};charset=utf8mb4",
                    $dbUser,
                    $dbPass,
                    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
                );
                
                // Check if database exists, create if not
                $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                $pdo->exec("USE `{$dbName}`");
                
                // Store in session for next step
                $_SESSION['db'] = [
                    'host' => $dbHost,
                    'name' => $dbName,
                    'user' => $dbUser,
                    'pass' => $dbPass
                ];
                
                $success[] = "Database connection successful!";
                $currentStep = 3;
            } catch (PDOException $e) {
                $errors[] = "Database connection failed: " . $e->getMessage();
            }
            break;
            
        case 3:
            // Create database tables
            if (!isset($_SESSION['db'])) {
                $errors[] = "Database configuration not found. Please go back to step 2.";
                $currentStep = 2;
                break;
            }
            
            try {
                $db = $_SESSION['db'];
                $pdo = new PDO(
                    "mysql:host={$db['host']};dbname={$db['name']};charset=utf8mb4",
                    $db['user'],
                    $db['pass'],
                    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
                );
                
                // Read and execute schema
                $schemaPath = __DIR__ . '/schema.sql';
                if (!file_exists($schemaPath)) {
                    $errors[] = "schema.sql file not found! Please upload it to the same directory.";
                    break;
                }
                
                $schema = file_get_contents($schemaPath);
                
                // Enhanced SQL parser for shared hosting
                $statements = [];
                $currentStmt = '';
                $inString = false;
                $stringChar = '';
                $inDelimiter = false;
                
                for ($i = 0; $i < strlen($schema); $i++) {
                    $char = $schema[$i];
                    $nextChar = $i + 1 < strlen($schema) ? $schema[$i + 1] : '';
                    
                    // Track string literals
                    if (($char === '"' || $char === "'") && ($i === 0 || $schema[$i - 1] !== '\\')) {
                        if (!$inString) {
                            $inString = true;
                            $stringChar = $char;
                        } elseif ($char === $stringChar) {
                            $inString = false;
                        }
                    }
                    
                    $currentStmt .= $char;
                    
                    // End of statement
                    if ($char === ';' && !$inString) {
                        $stmt = trim($currentStmt);
                        if (!empty($stmt) && $stmt !== ';') {
                            // Skip DELIMITER statements
                            if (!preg_match('/^DELIMITER/i', $stmt)) {
                                $statements[] = $stmt;
                            }
                        }
                        $currentStmt = '';
                    }
                }
                
                // Execute each statement
                $createdTables = 0;
                foreach ($statements as $statement) {
                    try {
                        $pdo->exec($statement);
                        if (stripos($statement, 'CREATE TABLE') !== false) {
                            $createdTables++;
                        }
                    } catch (PDOException $e) {
                        // Ignore duplicate table errors
                        if (strpos($e->getMessage(), 'already exists') === false) {
                            throw $e;
                        }
                    }
                }
                
                $success[] = "Database tables created successfully! ($createdTables tables)";
                $currentStep = 4;
            } catch (PDOException $e) {
                $errors[] = "Failed to create tables: " . $e->getMessage();
            }
            break;
            
        case 4:
            // Create admin account
            if (!isset($_SESSION['db'])) {
                $errors[] = "Database configuration not found.";
                $currentStep = 2;
                break;
            }
            
            $adminEmail = trim($_POST['admin_email'] ?? '');
            $adminPassword = $_POST['admin_password'] ?? '';
            $adminPasswordConfirm = $_POST['admin_password_confirm'] ?? '';
            $adminName = trim($_POST['admin_name'] ?? 'Admin');
            
            // Validation
            if (empty($adminEmail) || !filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
                $errors[] = "Please enter a valid email address.";
                break;
            }
            if (strlen($adminPassword) < 8) {
                $errors[] = "Password must be at least 8 characters long.";
                break;
            }
            if ($adminPassword !== $adminPasswordConfirm) {
                $errors[] = "Passwords do not match.";
                break;
            }
            
            try {
                $db = $_SESSION['db'];
                $pdo = new PDO(
                    "mysql:host={$db['host']};dbname={$db['name']};charset=utf8mb4",
                    $db['user'],
                    $db['pass'],
                    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
                );
                
                // Check if email already exists
                $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
                $stmt->execute([$adminEmail]);
                if ($stmt->fetch()) {
                    $errors[] = "An account with this email already exists.";
                    break;
                }
                
                // Create user
                $userId = generateInstallUUID();
                $hashedPassword = password_hash($adminPassword, PASSWORD_BCRYPT, ['cost' => 12]);
                
                $stmt = $pdo->prepare("
                    INSERT INTO users (id, email, password_hash, created_at, updated_at)
                    VALUES (?, ?, ?, NOW(), NOW())
                ");
                $stmt->execute([$userId, $adminEmail, $hashedPassword]);
                
                // Create profile
                $profileId = generateInstallUUID();
                $stmt = $pdo->prepare("
                    INSERT INTO profiles (id, user_id, email, display_name, email_verified, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 1, NOW(), NOW())
                ");
                $stmt->execute([$profileId, $userId, $adminEmail, $adminName]);
                
                // Assign admin role
                $roleId = generateInstallUUID();
                $stmt = $pdo->prepare("
                    INSERT INTO user_roles (id, user_id, role, created_at)
                    VALUES (?, ?, 'admin', NOW())
                ");
                $stmt->execute([$roleId, $userId]);
                
                $_SESSION['admin_created'] = true;
                $_SESSION['admin_email'] = $adminEmail;
                
                $success[] = "Admin account created successfully!";
                $currentStep = 5;
            } catch (PDOException $e) {
                $errors[] = "Failed to create admin account: " . $e->getMessage();
            }
            break;
            
        case 5:
            // Save SMTP configuration and generate config file
            if (!isset($_SESSION['db'])) {
                $errors[] = "Database configuration not found.";
                $currentStep = 2;
                break;
            }
            
            $db = $_SESSION['db'];
            $siteName = trim($_POST['site_name'] ?? 'TempMail');
            $siteUrl = rtrim(trim($_POST['site_url'] ?? ''), '/');
            $jwtSecret = $_POST['jwt_secret'] ?? bin2hex(random_bytes(32));
            $corsOrigin = trim($_POST['cors_origin'] ?? '*');
            
            // SMTP settings
            $smtpHost = trim($_POST['smtp_host'] ?? '');
            $smtpPort = (int)($_POST['smtp_port'] ?? 587);
            $smtpUser = trim($_POST['smtp_user'] ?? '');
            $smtpPass = $_POST['smtp_pass'] ?? '';
            $smtpFrom = trim($_POST['smtp_from'] ?? '');
            $smtpEncryption = $_POST['smtp_encryption'] ?? 'tls';
            
            // IMAP settings
            $imapHost = trim($_POST['imap_host'] ?? '');
            $imapPort = (int)($_POST['imap_port'] ?? 993);
            $imapUser = trim($_POST['imap_user'] ?? '');
            $imapPass = $_POST['imap_pass'] ?? '';
            
            $date = date('Y-m-d H:i:s');
            
            // Generate config.php content
            $configContent = <<<PHP
<?php
/**
 * TempMail PHP Backend Configuration
 * Generated by installer on {$date}
 */

// Database Configuration
define('DB_HOST', '{$db['host']}');
define('DB_NAME', '{$db['name']}');
define('DB_USER', '{$db['user']}');
define('DB_PASS', '{$db['pass']}');

// Application Settings
define('SITE_NAME', '{$siteName}');
define('SITE_URL', '{$siteUrl}');

// JWT Configuration
define('JWT_SECRET', '{$jwtSecret}');
define('JWT_EXPIRY', 86400 * 7); // 7 days

// CORS Configuration
define('CORS_ORIGIN', '{$corsOrigin}');

// SMTP Configuration (for sending emails)
define('SMTP_HOST', '{$smtpHost}');
define('SMTP_PORT', {$smtpPort});
define('SMTP_USER', '{$smtpUser}');
define('SMTP_PASS', '{$smtpPass}');
define('SMTP_FROM', '{$smtpFrom}');
define('SMTP_ENCRYPTION', '{$smtpEncryption}');

// IMAP Configuration (for receiving emails)
define('IMAP_HOST', '{$imapHost}');
define('IMAP_PORT', {$imapPort});
define('IMAP_USER', '{$imapUser}');
define('IMAP_PASS', '{$imapPass}');

// Storage Configuration
define('STORAGE_PATH', __DIR__ . '/storage');
define('MAX_UPLOAD_SIZE', 10 * 1024 * 1024); // 10MB

// Rate Limiting
define('RATE_LIMIT_REQUESTS', 100);
define('RATE_LIMIT_WINDOW', 60); // seconds

// Email Settings
define('DEFAULT_EMAIL_EXPIRY_HOURS', 24);
define('MAX_TEMP_EMAILS_PER_USER', 10);

// Security
define('BCRYPT_COST', 12);
define('SESSION_LIFETIME', 86400 * 7); // 7 days

// Encryption key for sensitive data
define('ENCRYPTION_KEY', '{$jwtSecret}');
PHP;

            // Write config file
            $configPath = __DIR__ . '/config.php';
            if (file_put_contents($configPath, $configContent) === false) {
                $errors[] = "Failed to write config.php. Please check directory permissions.";
                break;
            }
            
            // Create storage directories
            $storageDirs = [
                __DIR__ . '/storage',
                __DIR__ . '/storage/avatars',
                __DIR__ . '/storage/attachments',
                __DIR__ . '/storage/banners',
                __DIR__ . '/storage/backups',
                __DIR__ . '/logs'
            ];
            
            foreach ($storageDirs as $dir) {
                if (!is_dir($dir)) {
                    mkdir($dir, 0755, true);
                }
            }
            
            // Create .htaccess in storage to protect files
            $storageHtaccess = <<<HTACCESS
# Protect storage directory
Options -Indexes

# Only allow specific file types to be accessed directly
<FilesMatch "\.(jpg|jpeg|png|gif|webp|svg|ico|pdf)$">
    Order allow,deny
    Allow from all
</FilesMatch>

# Deny access to everything else
<FilesMatch "^(?!.*\.(jpg|jpeg|png|gif|webp|svg|ico|pdf)$).*$">
    Order allow,deny
    Deny from all
</FilesMatch>
HTACCESS;
            file_put_contents(__DIR__ . '/storage/.htaccess', $storageHtaccess);
            
            // Create logs .htaccess
            file_put_contents(__DIR__ . '/logs/.htaccess', "Order allow,deny\nDeny from all");
            
            // Create install lock file
            file_put_contents(__DIR__ . '/.install_lock', date('Y-m-d H:i:s'));
            
            // If SMTP configured, save to mailboxes table
            if (!empty($smtpHost) && !empty($smtpUser)) {
                try {
                    $pdo = new PDO(
                        "mysql:host={$db['host']};dbname={$db['name']};charset=utf8mb4",
                        $db['user'],
                        $db['pass'],
                        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
                    );
                    
                    $mailboxId = generateInstallUUID();
                    $stmt = $pdo->prepare("
                        INSERT INTO mailboxes (id, name, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, 
                                              imap_host, imap_port, imap_user, imap_password, receiving_email,
                                              is_active, priority, hourly_limit, daily_limit, created_at, updated_at)
                        VALUES (?, 'Primary Mailbox', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 100, 1000, NOW(), NOW())
                    ");
                    $stmt->execute([
                        $mailboxId, 
                        $smtpHost, $smtpPort, $smtpUser, $smtpPass, $smtpFrom,
                        $imapHost, $imapPort, $imapUser, $imapPass, $smtpFrom
                    ]);
                } catch (PDOException $e) {
                    // Non-critical, continue
                }
            }
            
            $success[] = "Configuration saved successfully!";
            $_SESSION['install_complete'] = true;
            $currentStep = 6;
            break;
    }
}

// Check requirements
function checkRequirements(): array {
    $requirements = [];
    
    // PHP Version
    $requirements['PHP 8.0+'] = version_compare(PHP_VERSION, '8.0.0', '>=');
    
    // Extensions
    $requirements['PDO Extension'] = extension_loaded('pdo');
    $requirements['PDO MySQL'] = extension_loaded('pdo_mysql');
    $requirements['JSON Extension'] = extension_loaded('json');
    $requirements['OpenSSL Extension'] = extension_loaded('openssl');
    $requirements['Mbstring Extension'] = extension_loaded('mbstring');
    
    // Optional but recommended
    $requirements['IMAP Extension (optional)'] = extension_loaded('imap');
    $requirements['cURL Extension'] = extension_loaded('curl');
    
    // Writeable directories
    $requirements['Directory Writeable'] = is_writable(__DIR__);
    
    return $requirements;
}

$requirements = checkRequirements();
$allRequirementsMet = !in_array(false, array_slice($requirements, 0, 6)); // Only required ones

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TempMail Installer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
            color: #e4e4e7;
            min-height: 100vh;
            padding: 2rem;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .header h1 {
            font-size: 2.5rem;
            background: linear-gradient(135deg, #14b8a6, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.5rem;
        }
        
        .header p {
            color: #a1a1aa;
        }
        
        .steps {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2rem;
            padding: 0 1rem;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        
        .step {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
            flex: 1;
            min-width: 60px;
        }
        
        .step-number {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #27272a;
            border: 2px solid #3f3f46;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 0.875rem;
        }
        
        .step.active .step-number {
            background: linear-gradient(135deg, #14b8a6, #8b5cf6);
            border-color: #14b8a6;
        }
        
        .step.completed .step-number {
            background: #22c55e;
            border-color: #22c55e;
        }
        
        .step-label {
            font-size: 0.65rem;
            color: #71717a;
            text-align: center;
        }
        
        .step.active .step-label {
            color: #14b8a6;
        }
        
        .card {
            background: rgba(39, 39, 42, 0.8);
            border: 1px solid #3f3f46;
            border-radius: 1rem;
            padding: 2rem;
            backdrop-filter: blur(10px);
        }
        
        .card h2 {
            margin-bottom: 1.5rem;
            color: #fafafa;
        }
        
        .form-group {
            margin-bottom: 1.5rem;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            color: #a1a1aa;
            font-size: 0.875rem;
        }
        
        .form-group input, .form-group select {
            width: 100%;
            padding: 0.75rem 1rem;
            border: 1px solid #3f3f46;
            border-radius: 0.5rem;
            background: #18181b;
            color: #fafafa;
            font-size: 1rem;
        }
        
        .form-group input:focus, .form-group select:focus {
            outline: none;
            border-color: #14b8a6;
        }
        
        .form-group small {
            display: block;
            margin-top: 0.25rem;
            color: #71717a;
            font-size: 0.75rem;
        }
        
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 0.5rem;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #14b8a6, #0d9488);
            color: white;
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(20, 184, 166, 0.4);
        }
        
        .btn-secondary {
            background: #3f3f46;
            color: #e4e4e7;
        }
        
        .btn-test {
            background: #8b5cf6;
            color: white;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
        }
        
        .requirements-list {
            display: grid;
            gap: 0.75rem;
        }
        
        .requirement {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem 1rem;
            background: #18181b;
            border-radius: 0.5rem;
        }
        
        .requirement-icon {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
        }
        
        .requirement-icon.pass {
            background: #22c55e;
        }
        
        .requirement-icon.fail {
            background: #ef4444;
        }
        
        .alert {
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1rem;
        }
        
        .alert-error {
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid #ef4444;
            color: #fca5a5;
        }
        
        .alert-success {
            background: rgba(34, 197, 94, 0.2);
            border: 1px solid #22c55e;
            color: #86efac;
        }
        
        .actions {
            display: flex;
            gap: 1rem;
            margin-top: 2rem;
        }
        
        .complete-message {
            text-align: center;
            padding: 2rem;
        }
        
        .complete-icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #22c55e, #16a34a);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem;
            font-size: 2.5rem;
        }
        
        .warning-box {
            background: rgba(245, 158, 11, 0.2);
            border: 1px solid #f59e0b;
            color: #fcd34d;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-top: 1.5rem;
            text-align: left;
        }
        
        .code-block {
            background: #18181b;
            padding: 1rem;
            border-radius: 0.5rem;
            font-family: monospace;
            margin-top: 0.5rem;
            overflow-x: auto;
            font-size: 0.875rem;
        }
        
        .grid-2 {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
        }
        
        .section-title {
            margin: 2rem 0 1rem;
            color: #fafafa;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid #3f3f46;
        }
        
        .password-strength {
            margin-top: 0.5rem;
            font-size: 0.75rem;
        }
        
        .password-strength.weak { color: #ef4444; }
        .password-strength.medium { color: #f59e0b; }
        .password-strength.strong { color: #22c55e; }
        
        .test-result {
            margin-top: 1rem;
            padding: 1rem;
            border-radius: 0.5rem;
            display: none;
        }
        
        .test-result.success {
            background: rgba(34, 197, 94, 0.2);
            border: 1px solid #22c55e;
            color: #86efac;
        }
        
        .test-result.error {
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid #ef4444;
            color: #fca5a5;
        }
        
        @media (max-width: 640px) {
            .grid-2 {
                grid-template-columns: 1fr;
            }
            
            .steps {
                justify-content: center;
            }
            
            .step {
                min-width: 50px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 TempMail Installer</h1>
            <p>Self-Hosted PHP Backend Setup Wizard</p>
        </div>
        
        <div class="steps">
            <?php foreach ($steps as $num => $label): ?>
            <div class="step <?php echo $num === $currentStep ? 'active' : ($num < $currentStep ? 'completed' : ''); ?>">
                <div class="step-number"><?php echo $num < $currentStep ? '✓' : $num; ?></div>
                <div class="step-label"><?php echo $label; ?></div>
            </div>
            <?php endforeach; ?>
        </div>
        
        <?php if (!empty($errors)): ?>
        <div class="alert alert-error">
            <?php foreach ($errors as $error): ?>
            <p><?php echo htmlspecialchars($error); ?></p>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>
        
        <?php if (!empty($success)): ?>
        <div class="alert alert-success">
            <?php foreach ($success as $msg): ?>
            <p><?php echo htmlspecialchars($msg); ?></p>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>
        
        <div class="card">
            <?php if ($currentStep === 1): ?>
            <!-- Step 1: Requirements Check -->
            <h2>Step 1: Requirements Check</h2>
            <p style="margin-bottom: 1.5rem; color: #a1a1aa;">
                Let's make sure your server meets all the requirements.
            </p>
            
            <div class="requirements-list">
                <?php foreach ($requirements as $name => $passed): ?>
                <div class="requirement">
                    <div class="requirement-icon <?php echo $passed ? 'pass' : 'fail'; ?>">
                        <?php echo $passed ? '✓' : '✗'; ?>
                    </div>
                    <span><?php echo htmlspecialchars($name); ?></span>
                </div>
                <?php endforeach; ?>
            </div>
            
            <div class="actions">
                <?php if ($allRequirementsMet): ?>
                <form method="post">
                    <input type="hidden" name="step" value="2">
                    <button type="submit" class="btn btn-primary">Continue →</button>
                </form>
                <?php else: ?>
                <p style="color: #ef4444;">Please resolve the failed requirements before continuing.</p>
                <?php endif; ?>
            </div>
            
            <?php elseif ($currentStep === 2): ?>
            <!-- Step 2: Database Configuration -->
            <h2>Step 2: Database Configuration</h2>
            <p style="margin-bottom: 1.5rem; color: #a1a1aa;">
                Enter your MySQL database credentials. You can find these in cPanel under "MySQL Databases".
            </p>
            
            <form method="post">
                <input type="hidden" name="step" value="2">
                
                <div class="grid-2">
                    <div class="form-group">
                        <label for="db_host">Database Host</label>
                        <input type="text" id="db_host" name="db_host" value="localhost" required>
                        <small>Usually "localhost" for cPanel hosting</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="db_name">Database Name</label>
                        <input type="text" id="db_name" name="db_name" placeholder="cpaneluser_tempmail" required>
                        <small>The database you created in cPanel</small>
                    </div>
                </div>
                
                <div class="grid-2">
                    <div class="form-group">
                        <label for="db_user">Database Username</label>
                        <input type="text" id="db_user" name="db_user" placeholder="cpaneluser_dbuser" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="db_pass">Database Password</label>
                        <input type="password" id="db_pass" name="db_pass" required>
                    </div>
                </div>
                
                <div class="actions">
                    <button type="submit" class="btn btn-primary">Test Connection & Continue →</button>
                </div>
            </form>
            
            <?php elseif ($currentStep === 3): ?>
            <!-- Step 3: Create Tables -->
            <h2>Step 3: Create Database Tables</h2>
            <p style="margin-bottom: 1.5rem; color: #a1a1aa;">
                We'll now create all the necessary database tables for TempMail.
            </p>
            
            <form method="post">
                <input type="hidden" name="step" value="3">
                
                <p>This will create the following tables:</p>
                <div class="code-block">
                    users, profiles, domains, temp_emails, received_emails,<br>
                    email_attachments, user_roles, mailboxes, app_settings,<br>
                    blogs, subscription_tiers, user_subscriptions, and more...
                </div>
                
                <div class="actions">
                    <button type="submit" class="btn btn-primary">Create Tables →</button>
                </div>
            </form>
            
            <?php elseif ($currentStep === 4): ?>
            <!-- Step 4: Admin Account -->
            <h2>Step 4: Create Admin Account</h2>
            <p style="margin-bottom: 1.5rem; color: #a1a1aa;">
                Create the first administrator account for your TempMail installation.
            </p>
            
            <form method="post">
                <input type="hidden" name="step" value="4">
                
                <div class="grid-2">
                    <div class="form-group">
                        <label for="admin_name">Display Name</label>
                        <input type="text" id="admin_name" name="admin_name" value="Admin" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="admin_email">Admin Email</label>
                        <input type="email" id="admin_email" name="admin_email" placeholder="admin@yourdomain.com" required>
                        <small>This will be your login email</small>
                    </div>
                </div>
                
                <div class="grid-2">
                    <div class="form-group">
                        <label for="admin_password">Password</label>
                        <input type="password" id="admin_password" name="admin_password" minlength="8" required 
                               onkeyup="checkPasswordStrength(this.value)">
                        <div id="password-strength" class="password-strength"></div>
                    </div>
                    
                    <div class="form-group">
                        <label for="admin_password_confirm">Confirm Password</label>
                        <input type="password" id="admin_password_confirm" name="admin_password_confirm" minlength="8" required>
                    </div>
                </div>
                
                <div class="actions">
                    <button type="submit" class="btn btn-primary">Create Admin & Continue →</button>
                </div>
            </form>
            
            <script>
            function checkPasswordStrength(password) {
                const indicator = document.getElementById('password-strength');
                let strength = 0;
                
                if (password.length >= 8) strength++;
                if (password.length >= 12) strength++;
                if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
                if (/[0-9]/.test(password)) strength++;
                if (/[^a-zA-Z0-9]/.test(password)) strength++;
                
                if (strength < 2) {
                    indicator.textContent = 'Weak password';
                    indicator.className = 'password-strength weak';
                } else if (strength < 4) {
                    indicator.textContent = 'Medium password';
                    indicator.className = 'password-strength medium';
                } else {
                    indicator.textContent = 'Strong password';
                    indicator.className = 'password-strength strong';
                }
            }
            </script>
            
            <?php elseif ($currentStep === 5): ?>
            <!-- Step 5: SMTP Configuration -->
            <h2>Step 5: Email Configuration</h2>
            <p style="margin-bottom: 1.5rem; color: #a1a1aa;">
                Configure SMTP settings for sending emails and optionally IMAP for receiving.
            </p>
            
            <form method="post" id="configForm">
                <input type="hidden" name="step" value="5">
                
                <div class="grid-2">
                    <div class="form-group">
                        <label for="site_name">Site Name</label>
                        <input type="text" id="site_name" name="site_name" value="TempMail" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="site_url">Site URL</label>
                        <input type="url" id="site_url" name="site_url" placeholder="https://yourdomain.com" required>
                    </div>
                </div>
                
                <div class="grid-2">
                    <div class="form-group">
                        <label for="cors_origin">CORS Origin</label>
                        <input type="text" id="cors_origin" name="cors_origin" value="*">
                        <small>Use * for any origin, or your frontend URL</small>
                    </div>
                    
                    <div class="form-group">
                        <label for="jwt_secret">JWT Secret Key</label>
                        <input type="text" id="jwt_secret" name="jwt_secret" value="<?php echo bin2hex(random_bytes(32)); ?>">
                        <small>Auto-generated secure key</small>
                    </div>
                </div>
                
                <h3 class="section-title">📤 SMTP Settings (Sending Emails)</h3>
                
                <div class="grid-2">
                    <div class="form-group">
                        <label for="smtp_host">SMTP Host</label>
                        <input type="text" id="smtp_host" name="smtp_host" placeholder="mail.yourdomain.com">
                    </div>
                    
                    <div class="form-group">
                        <label for="smtp_port">SMTP Port</label>
                        <input type="number" id="smtp_port" name="smtp_port" value="587">
                        <small>587 for TLS, 465 for SSL, 25 for unencrypted</small>
                    </div>
                </div>
                
                <div class="grid-2">
                    <div class="form-group">
                        <label for="smtp_user">SMTP Username</label>
                        <input type="text" id="smtp_user" name="smtp_user" placeholder="noreply@yourdomain.com">
                    </div>
                    
                    <div class="form-group">
                        <label for="smtp_pass">SMTP Password</label>
                        <input type="password" id="smtp_pass" name="smtp_pass">
                    </div>
                </div>
                
                <div class="grid-2">
                    <div class="form-group">
                        <label for="smtp_from">From Email</label>
                        <input type="email" id="smtp_from" name="smtp_from" placeholder="noreply@yourdomain.com">
                    </div>
                    
                    <div class="form-group">
                        <label for="smtp_encryption">Encryption</label>
                        <select id="smtp_encryption" name="smtp_encryption">
                            <option value="tls">TLS (Recommended)</option>
                            <option value="ssl">SSL</option>
                            <option value="">None</option>
                        </select>
                    </div>
                </div>
                
                <button type="button" class="btn btn-test" onclick="testSmtp()">🧪 Test SMTP Connection</button>
                <div id="smtp-test-result" class="test-result"></div>
                
                <h3 class="section-title">📥 IMAP Settings (Receiving Emails - Optional)</h3>
                <p style="margin-bottom: 1rem; color: #71717a; font-size: 0.875rem;">
                    Configure IMAP to automatically fetch incoming emails. This is optional but recommended.
                </p>
                
                <div class="grid-2">
                    <div class="form-group">
                        <label for="imap_host">IMAP Host</label>
                        <input type="text" id="imap_host" name="imap_host" placeholder="mail.yourdomain.com">
                    </div>
                    
                    <div class="form-group">
                        <label for="imap_port">IMAP Port</label>
                        <input type="number" id="imap_port" name="imap_port" value="993">
                        <small>993 for SSL (default), 143 for TLS</small>
                    </div>
                </div>
                
                <div class="grid-2">
                    <div class="form-group">
                        <label for="imap_user">IMAP Username</label>
                        <input type="text" id="imap_user" name="imap_user" placeholder="inbox@yourdomain.com">
                    </div>
                    
                    <div class="form-group">
                        <label for="imap_pass">IMAP Password</label>
                        <input type="password" id="imap_pass" name="imap_pass">
                    </div>
                </div>
                
                <button type="button" class="btn btn-test" onclick="testImap()">🧪 Test IMAP Connection</button>
                <div id="imap-test-result" class="test-result"></div>
                
                <div class="actions">
                    <button type="submit" class="btn btn-primary">Save & Complete Installation →</button>
                </div>
            </form>
            
            <script>
            async function testSmtp() {
                const result = document.getElementById('smtp-test-result');
                result.style.display = 'block';
                result.className = 'test-result';
                result.textContent = 'Testing SMTP connection...';
                
                const data = {
                    host: document.getElementById('smtp_host').value,
                    port: document.getElementById('smtp_port').value,
                    user: document.getElementById('smtp_user').value,
                    pass: document.getElementById('smtp_pass').value,
                    from: document.getElementById('smtp_from').value,
                    encryption: document.getElementById('smtp_encryption').value
                };
                
                try {
                    const response = await fetch('test-smtp.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    const json = await response.json();
                    
                    if (json.success) {
                        result.className = 'test-result success';
                        result.textContent = '✓ SMTP connection successful! ' + (json.message || '');
                    } else {
                        result.className = 'test-result error';
                        result.textContent = '✗ SMTP test failed: ' + (json.error || 'Unknown error');
                    }
                } catch (e) {
                    result.className = 'test-result error';
                    result.textContent = '✗ Test failed: ' + e.message;
                }
            }
            
            async function testImap() {
                const result = document.getElementById('imap-test-result');
                result.style.display = 'block';
                result.className = 'test-result';
                result.textContent = 'Testing IMAP connection...';
                
                const data = {
                    host: document.getElementById('imap_host').value,
                    port: document.getElementById('imap_port').value,
                    user: document.getElementById('imap_user').value,
                    pass: document.getElementById('imap_pass').value
                };
                
                try {
                    const response = await fetch('test-imap.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    const json = await response.json();
                    
                    if (json.success) {
                        result.className = 'test-result success';
                        result.textContent = '✓ IMAP connection successful! Found ' + (json.messageCount || 0) + ' messages.';
                    } else {
                        result.className = 'test-result error';
                        result.textContent = '✗ IMAP test failed: ' + (json.error || 'Unknown error');
                    }
                } catch (e) {
                    result.className = 'test-result error';
                    result.textContent = '✗ Test failed: ' + e.message;
                }
            }
            </script>
            
            <?php elseif ($currentStep === 6): ?>
            <!-- Step 6: Complete -->
            <div class="complete-message">
                <div class="complete-icon">🎉</div>
                <h2>Installation Complete!</h2>
                <p style="color: #a1a1aa; margin: 1rem 0;">
                    Your TempMail PHP backend has been installed successfully.
                </p>
                
                <?php if (isset($_SESSION['admin_email'])): ?>
                <div class="alert alert-success" style="text-align: left;">
                    <strong>Admin Account Created:</strong><br>
                    Email: <?php echo htmlspecialchars($_SESSION['admin_email']); ?>
                </div>
                <?php endif; ?>
                
                <div class="warning-box">
                    <strong>⚠️ Security Warning:</strong><br>
                    Please delete these files immediately for security:
                    <div class="code-block">rm install.php test-smtp.php test-imap.php</div>
                </div>
                
                <div style="margin-top: 2rem; text-align: left;">
                    <h3 style="margin-bottom: 1rem;">Next Steps:</h3>
                    <ol style="color: #a1a1aa; padding-left: 1.5rem; line-height: 2;">
                        <li>Update your frontend's <code>.env</code> file with:</li>
                    </ol>
                    <div class="code-block">
VITE_PHP_API_URL=https://yourdomain.com/api
                    </div>
                    <ol start="2" style="color: #a1a1aa; padding-left: 1.5rem; line-height: 2; margin-top: 1rem;">
                        <li>Set up cron jobs for email polling:</li>
                    </ol>
                    <div class="code-block">
*/5 * * * * /usr/bin/php /path/to/php-backend/cron/imap-poll.php<br>
0 * * * * /usr/bin/php /path/to/php-backend/cron/maintenance.php
                    </div>
                    <ol start="3" style="color: #a1a1aa; padding-left: 1.5rem; line-height: 2; margin-top: 1rem;">
                        <li>Log in to the admin panel at <code>/admin</code></li>
                        <li>Add your email domains in Domain Management</li>
                        <li>Configure additional mailboxes if needed</li>
                    </ol>
                </div>
                
                <div class="actions" style="justify-content: center; margin-top: 2rem;">
                    <a href="/" class="btn btn-primary">Go to Homepage →</a>
                    <a href="/admin" class="btn btn-secondary">Open Admin Panel →</a>
                </div>
            </div>
            <?php endif; ?>
        </div>
    </div>
</body>
</html>
