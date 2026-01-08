<?php
/**
 * TempMail PHP Backend Installer
 * 
 * This script helps you set up the TempMail backend on cPanel/shared hosting.
 * Access this file in your browser to run the installation wizard.
 * 
 * IMPORTANT: Delete this file after installation for security!
 */

// ============================================
// EARLY ERROR HANDLING - Before anything else
// ============================================
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Catch fatal errors early
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_PARSE])) {
        if (!headers_sent()) {
            header('Content-Type: application/json');
        }
        echo json_encode([
            'success' => false,
            'error' => 'PHP Fatal Error: ' . $error['message'],
            'file' => basename($error['file']),
            'line' => $error['line'],
            'hint' => 'Check PHP error logs or contact your hosting provider'
        ]);
    }
});

// ============================================
// PHP VERSION AND EXTENSION CHECKS
// ============================================
if (version_compare(PHP_VERSION, '8.0.0', '<')) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'PHP 8.0 or higher is required',
        'current_version' => PHP_VERSION,
        'hint' => 'Contact your hosting provider to upgrade PHP or select PHP 8.0+ in cPanel PHP Selector'
    ]);
    exit;
}

// Check required extensions
$requiredExtensions = ['pdo_mysql', 'mbstring', 'json', 'openssl'];
$missingExtensions = array_filter($requiredExtensions, fn($ext) => !extension_loaded($ext));

if (!empty($missingExtensions)) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Missing required PHP extensions',
        'missing' => array_values($missingExtensions),
        'hint' => 'Enable these extensions in cPanel PHP Selector or contact your hosting provider'
    ]);
    exit;
}

// ============================================
// CREATE LOGS DIRECTORY EARLY
// ============================================
$logsDir = __DIR__ . '/logs';
if (!is_dir($logsDir)) {
    if (!@mkdir($logsDir, 0755, true)) {
        // Log directory creation failed - continue anyway, but note it
        error_log("Warning: Could not create logs directory: $logsDir");
    }
}

// Protect logs directory
$logsHtaccess = $logsDir . '/.htaccess';
if (is_dir($logsDir) && !file_exists($logsHtaccess)) {
    @file_put_contents($logsHtaccess, "Order deny,allow\nDeny from all\n");
}

session_start();

// ============================================
// JSON API HANDLERS
// ============================================
if ($_SERVER['REQUEST_METHOD'] === 'POST' && strpos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== false) {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    
    try {
        $rawInput = file_get_contents('php://input');
        $input = json_decode($rawInput, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            echo json_encode(['success' => false, 'error' => 'Invalid JSON input: ' . json_last_error_msg()]);
            exit;
        }
        
        $action = $input['action'] ?? '';
        
        switch ($action) {
            case 'check_setup':
                // Check if installation is needed
                $needsSetup = !file_exists(__DIR__ . '/config.php') || !file_exists(__DIR__ . '/.install_lock');
                echo json_encode([
                    'needs_setup' => $needsSetup,
                    'php_version' => PHP_VERSION,
                    'extensions' => [
                        'pdo_mysql' => extension_loaded('pdo_mysql'),
                        'mbstring' => extension_loaded('mbstring'),
                        'json' => extension_loaded('json'),
                        'openssl' => extension_loaded('openssl'),
                        'imap' => extension_loaded('imap'),
                    ]
                ]);
                exit;
                
            case 'test_database':
                $dbHost = trim($input['host'] ?? 'localhost');
                $dbName = trim($input['name'] ?? '');
                $dbUser = trim($input['user'] ?? '');
                $dbPass = $input['pass'] ?? '';
                
                // Validate inputs
                if (empty($dbHost) || empty($dbName) || empty($dbUser)) {
                    echo json_encode(['success' => false, 'error' => 'Host, database name, and username are required']);
                    exit;
                }
                
                try {
                    $dsn = "mysql:host={$dbHost};charset=utf8mb4";
                    $pdo = new PDO($dsn, $dbUser, $dbPass, [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_TIMEOUT => 10
                    ]);
                    
                    // Try to create/use database
                    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                    $pdo->exec("USE `{$dbName}`");
                    
                    echo json_encode([
                        'success' => true, 
                        'message' => 'Database connection successful',
                        'server_info' => $pdo->getAttribute(PDO::ATTR_SERVER_VERSION)
                    ]);
                } catch (PDOException $e) {
                    $errorMsg = $e->getMessage();
                    $hint = 'Check your database credentials';
                    
                    // Provide helpful hints based on error
                    if (strpos($errorMsg, 'Access denied') !== false) {
                        $hint = 'Username or password is incorrect. Check credentials in cPanel MySQL Databases.';
                    } elseif (strpos($errorMsg, 'Unknown database') !== false) {
                        $hint = 'Database does not exist. Create it in cPanel MySQL Databases first.';
                    } elseif (strpos($errorMsg, 'Connection refused') !== false) {
                        $hint = 'Cannot connect to MySQL server. It may be down or the host is incorrect.';
                    } elseif (strpos($errorMsg, 'getaddrinfo') !== false || strpos($errorMsg, 'Name or service not known') !== false) {
                        $hint = 'Invalid database host. For cPanel, usually use "localhost".';
                    }
                    
                    echo json_encode([
                        'success' => false, 
                        'error' => 'Database connection failed: ' . $errorMsg,
                        'hint' => $hint
                    ]);
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
                        echo json_encode([
                            'success' => false, 
                            'error' => 'schema.sql not found',
                            'hint' => 'Upload schema.sql to the api/ directory'
                        ]);
                        exit;
                    }
                    
                    $schema = file_get_contents($schemaPath);
                    $statements = preg_split('/;\s*$/m', $schema);
                    $created = 0;
                    $errors = [];
                    
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
                                    $errors[] = $e->getMessage();
                                }
                            }
                        }
                    }
                    
                    if (!empty($errors)) {
                        echo json_encode([
                            'success' => false, 
                            'error' => 'Some tables failed to create',
                            'details' => array_slice($errors, 0, 5)
                        ]);
                    } else {
                        echo json_encode(['success' => true, 'tables_created' => $created]);
                    }
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
                
                // Validate email
                if (!filter_var($admin['email'], FILTER_VALIDATE_EMAIL)) {
                    echo json_encode(['success' => false, 'error' => 'Invalid email address']);
                    exit;
                }
                
                // Validate password strength
                if (strlen($admin['password']) < 8) {
                    echo json_encode(['success' => false, 'error' => 'Password must be at least 8 characters']);
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
                    $error = $e->getMessage();
                    if (strpos($error, 'Duplicate entry') !== false) {
                        echo json_encode(['success' => false, 'error' => 'An admin with this email already exists']);
                    } else {
                        echo json_encode(['success' => false, 'error' => $error]);
                    }
                }
                exit;
                
            case 'save_config':
                $db = $input['db'] ?? [];
                $smtp = $input['smtp'] ?? [];
                $imap = $input['imap'] ?? [];
                $jwtSecret = bin2hex(random_bytes(32));
                $diagToken = bin2hex(random_bytes(16));
                $date = date('Y-m-d H:i:s');
                
                // Escape values for PHP string
                $escapeForPhp = function($val) {
                    return addslashes($val);
                };
                
                // Generate config with both constants (for cron scripts) and array format (for main app)
                $configContent = "<?php\n/**\n * TempMail Configuration - Generated {$date}\n * \n * SECURITY: Keep this file secure! Contains database credentials.\n */\n\n";
                
                // Constants for cron scripts and backward compatibility
                $configContent .= "// Database constants for cron scripts\n";
                $configContent .= "define('DB_HOST', '" . $escapeForPhp($db['host']) . "');\n";
                $configContent .= "define('DB_NAME', '" . $escapeForPhp($db['name']) . "');\n";
                $configContent .= "define('DB_USER', '" . $escapeForPhp($db['user']) . "');\n";
                $configContent .= "define('DB_PASS', '" . $escapeForPhp($db['pass']) . "');\n\n";
                $configContent .= "define('JWT_SECRET', '{$jwtSecret}');\n";
                $configContent .= "define('JWT_EXPIRY', 604800);\n\n";
                $configContent .= "define('SMTP_HOST', '" . $escapeForPhp($smtp['host'] ?? '') . "');\n";
                $configContent .= "define('SMTP_PORT', " . intval($smtp['port'] ?? 587) . ");\n";
                $configContent .= "define('SMTP_USER', '" . $escapeForPhp($smtp['user'] ?? '') . "');\n";
                $configContent .= "define('SMTP_PASS', '" . $escapeForPhp($smtp['pass'] ?? '') . "');\n";
                $configContent .= "define('SMTP_FROM', '" . $escapeForPhp($smtp['from'] ?? '') . "');\n\n";
                $configContent .= "define('IMAP_HOST', '" . $escapeForPhp($imap['host'] ?? '') . "');\n";
                $configContent .= "define('IMAP_PORT', " . intval($imap['port'] ?? 993) . ");\n";
                $configContent .= "define('IMAP_USER', '" . $escapeForPhp($imap['user'] ?? '') . "');\n";
                $configContent .= "define('IMAP_PASS', '" . $escapeForPhp($imap['pass'] ?? '') . "');\n\n";
                $configContent .= "define('STORAGE_PATH', __DIR__ . '/storage');\n";
                $configContent .= "define('ENCRYPTION_KEY', '{$jwtSecret}');\n";
                $configContent .= "define('CORS_ORIGIN', '*');\n\n";
                
                // Array format for main application
                $configContent .= "// Array format for main application\n";
                $configContent .= "return [\n";
                $configContent .= "    'db' => [\n";
                $configContent .= "        'host' => '" . $escapeForPhp($db['host']) . "',\n";
                $configContent .= "        'name' => '" . $escapeForPhp($db['name']) . "',\n";
                $configContent .= "        'user' => '" . $escapeForPhp($db['user']) . "',\n";
                $configContent .= "        'pass' => '" . $escapeForPhp($db['pass']) . "',\n";
                $configContent .= "        'charset' => 'utf8mb4'\n";
                $configContent .= "    ],\n";
                $configContent .= "    'jwt' => [\n";
                $configContent .= "        'secret' => '{$jwtSecret}',\n";
                $configContent .= "        'expiry' => 604800\n";
                $configContent .= "    ],\n";
                $configContent .= "    'smtp' => [\n";
                $configContent .= "        'host' => '" . $escapeForPhp($smtp['host'] ?? '') . "',\n";
                $configContent .= "        'port' => " . intval($smtp['port'] ?? 587) . ",\n";
                $configContent .= "        'user' => '" . $escapeForPhp($smtp['user'] ?? '') . "',\n";
                $configContent .= "        'pass' => '" . $escapeForPhp($smtp['pass'] ?? '') . "',\n";
                $configContent .= "        'from' => '" . $escapeForPhp($smtp['from'] ?? '') . "'\n";
                $configContent .= "    ],\n";
                $configContent .= "    'imap' => [\n";
                $configContent .= "        'host' => '" . $escapeForPhp($imap['host'] ?? '') . "',\n";
                $configContent .= "        'port' => " . intval($imap['port'] ?? 993) . ",\n";
                $configContent .= "        'user' => '" . $escapeForPhp($imap['user'] ?? '') . "',\n";
                $configContent .= "        'pass' => '" . $escapeForPhp($imap['pass'] ?? '') . "'\n";
                $configContent .= "    ],\n";
                $configContent .= "    'cors' => [\n";
                $configContent .= "        'origins' => ['*']\n";
                $configContent .= "    ],\n";
                $configContent .= "    'diag_token' => '{$diagToken}',\n";
                $configContent .= "    'site_name' => 'TempMail',\n";
                $configContent .= "    'site_url' => ''\n";
                $configContent .= "];\n";
                
                $configPath = __DIR__ . '/config.php';
                if (file_put_contents($configPath, $configContent)) {
                    // Secure the config file
                    @chmod($configPath, 0600);
                    
                    // Create directories
                    foreach (['/storage', '/storage/avatars', '/storage/attachments', '/logs'] as $dir) {
                        $dirPath = __DIR__ . $dir;
                        if (!is_dir($dirPath)) {
                            @mkdir($dirPath, 0755, true);
                        }
                    }
                    
                    // Protect logs directory
                    $logsHtaccess = __DIR__ . '/logs/.htaccess';
                    if (!file_exists($logsHtaccess)) {
                        file_put_contents($logsHtaccess, "Order deny,allow\nDeny from all\n");
                    }
                    
                    // Create index.php in logs to prevent directory listing
                    $logsIndex = __DIR__ . '/logs/index.php';
                    if (!file_exists($logsIndex)) {
                        file_put_contents($logsIndex, '<?php // Silence is golden');
                    }
                    
                    // Protect storage directory
                    $storageHtaccess = __DIR__ . '/storage/.htaccess';
                    if (!file_exists($storageHtaccess)) {
                        file_put_contents($storageHtaccess, "# Protect direct access to files\n<FilesMatch \"\\.php$\">\nOrder deny,allow\nDeny from all\n</FilesMatch>\n");
                    }
                    
                    echo json_encode([
                        'success' => true,
                        'diag_token' => $diagToken,
                        'message' => 'Configuration saved. Keep the diag_token for diagnostics access.'
                    ]);
                } else {
                    echo json_encode([
                        'success' => false, 
                        'error' => 'Failed to write config.php',
                        'hint' => 'Check that the api/ directory is writable. In cPanel, set permissions to 755.'
                    ]);
                }
                exit;
                
            case 'complete_setup':
                file_put_contents(__DIR__ . '/.install_lock', date('Y-m-d H:i:s'));
                echo json_encode([
                    'success' => true,
                    'message' => 'Installation complete! Please delete install.php for security.'
                ]);
                exit;
                
            default:
                http_response_code(400);
                echo json_encode(['error' => 'Unknown action: ' . $action]);
                exit;
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Server error: ' . $e->getMessage(),
            'hint' => 'Check PHP error logs for more details'
        ]);
        exit;
    }
}

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    exit;
}

// Check if already installed (for HTML version)
if (file_exists(__DIR__ . '/.install_lock') && !isset($_GET['force'])) {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html><head><title>TempMail - Already Installed</title>';
    echo '<style>body{font-family:system-ui,sans-serif;max-width:600px;margin:100px auto;padding:20px;text-align:center;}';
    echo '.warning{background:#fef3c7;border:1px solid #f59e0b;padding:20px;border-radius:8px;margin:20px 0;}';
    echo 'h1{color:#059669;}</style></head><body>';
    echo '<h1>✅ TempMail Already Installed</h1>';
    echo '<div class="warning"><strong>⚠️ Security Warning:</strong><br>Delete this file (install.php) immediately for security!</div>';
    echo '<p>Your TempMail backend is already configured.</p>';
    echo '<p><a href="/api/health">Check API Health</a></p>';
    echo '</body></html>';
    exit;
}

// ============================================
// HTML INSTALLATION WIZARD
// ============================================

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
                    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 10]
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
                $msg = $e->getMessage();
                $hint = '';
                if (strpos($msg, 'Access denied') !== false) {
                    $hint = ' Check your username/password in cPanel MySQL Databases.';
                } elseif (strpos($msg, 'Connection refused') !== false) {
                    $hint = ' MySQL server may be down. Contact your hosting provider.';
                }
                $errors[] = "Database connection failed: " . $msg . $hint;
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
                
                for ($i = 0; $i < strlen($schema); $i++) {
                    $char = $schema[$i];
                    
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
                $errors[] = "Database configuration not found. Please go back to step 2.";
                $currentStep = 2;
                break;
            }
            
            $adminEmail = trim($_POST['admin_email'] ?? '');
            $adminPass = $_POST['admin_pass'] ?? '';
            $adminName = trim($_POST['admin_name'] ?? 'Admin');
            
            if (empty($adminEmail) || empty($adminPass)) {
                $errors[] = "Email and password are required.";
                break;
            }
            
            if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
                $errors[] = "Invalid email address format.";
                break;
            }
            
            if (strlen($adminPass) < 8) {
                $errors[] = "Password must be at least 8 characters.";
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
                
                $userId = generateInstallUUID();
                $hashedPassword = password_hash($adminPass, PASSWORD_BCRYPT, ['cost' => 12]);
                
                // Create user
                $stmt = $pdo->prepare("INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())");
                $stmt->execute([$userId, $adminEmail, $hashedPassword]);
                
                // Create profile
                $profileId = generateInstallUUID();
                $stmt = $pdo->prepare("INSERT INTO profiles (id, user_id, email, display_name, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW())");
                $stmt->execute([$profileId, $userId, $adminEmail, $adminName]);
                
                // Assign admin role
                $roleId = generateInstallUUID();
                $stmt = $pdo->prepare("INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, 'admin', NOW())");
                $stmt->execute([$roleId, $userId]);
                
                $_SESSION['admin_created'] = true;
                $success[] = "Admin account created successfully!";
                $currentStep = 5;
            } catch (PDOException $e) {
                if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
                    $errors[] = "An account with this email already exists.";
                } else {
                    $errors[] = "Failed to create admin: " . $e->getMessage();
                }
            }
            break;
            
        case 5:
            // Save configuration
            if (!isset($_SESSION['db'])) {
                $errors[] = "Database configuration not found. Please go back to step 2.";
                $currentStep = 2;
                break;
            }
            
            $db = $_SESSION['db'];
            $smtp = [
                'host' => trim($_POST['smtp_host'] ?? ''),
                'port' => intval($_POST['smtp_port'] ?? 587),
                'user' => trim($_POST['smtp_user'] ?? ''),
                'pass' => $_POST['smtp_pass'] ?? '',
                'from' => trim($_POST['smtp_from'] ?? '')
            ];
            $imap = [
                'host' => trim($_POST['imap_host'] ?? ''),
                'port' => intval($_POST['imap_port'] ?? 993),
                'user' => trim($_POST['imap_user'] ?? ''),
                'pass' => $_POST['imap_pass'] ?? ''
            ];
            
            $jwtSecret = bin2hex(random_bytes(32));
            $diagToken = bin2hex(random_bytes(16));
            
            // Escape values for PHP string
            $escapeForPhp = function($val) {
                return addslashes($val);
            };
            
            $date = date('Y-m-d H:i:s');
            $configContent = "<?php\n/**\n * TempMail Configuration - Generated {$date}\n */\n\n";
            
            // Constants for cron scripts
            $configContent .= "// Constants for cron scripts\n";
            $configContent .= "define('DB_HOST', '" . $escapeForPhp($db['host']) . "');\n";
            $configContent .= "define('DB_NAME', '" . $escapeForPhp($db['name']) . "');\n";
            $configContent .= "define('DB_USER', '" . $escapeForPhp($db['user']) . "');\n";
            $configContent .= "define('DB_PASS', '" . $escapeForPhp($db['pass']) . "');\n\n";
            $configContent .= "define('JWT_SECRET', '{$jwtSecret}');\n";
            $configContent .= "define('JWT_EXPIRY', 604800);\n\n";
            $configContent .= "define('SMTP_HOST', '" . $escapeForPhp($smtp['host']) . "');\n";
            $configContent .= "define('SMTP_PORT', {$smtp['port']});\n";
            $configContent .= "define('SMTP_USER', '" . $escapeForPhp($smtp['user']) . "');\n";
            $configContent .= "define('SMTP_PASS', '" . $escapeForPhp($smtp['pass']) . "');\n";
            $configContent .= "define('SMTP_FROM', '" . $escapeForPhp($smtp['from']) . "');\n\n";
            $configContent .= "define('IMAP_HOST', '" . $escapeForPhp($imap['host']) . "');\n";
            $configContent .= "define('IMAP_PORT', {$imap['port']});\n";
            $configContent .= "define('IMAP_USER', '" . $escapeForPhp($imap['user']) . "');\n";
            $configContent .= "define('IMAP_PASS', '" . $escapeForPhp($imap['pass']) . "');\n\n";
            $configContent .= "define('STORAGE_PATH', __DIR__ . '/storage');\n";
            $configContent .= "define('ENCRYPTION_KEY', '{$jwtSecret}');\n";
            $configContent .= "define('CORS_ORIGIN', '*');\n\n";
            
            // Array format
            $configContent .= "return [\n";
            $configContent .= "    'db' => [\n";
            $configContent .= "        'host' => '" . $escapeForPhp($db['host']) . "',\n";
            $configContent .= "        'name' => '" . $escapeForPhp($db['name']) . "',\n";
            $configContent .= "        'user' => '" . $escapeForPhp($db['user']) . "',\n";
            $configContent .= "        'pass' => '" . $escapeForPhp($db['pass']) . "',\n";
            $configContent .= "        'charset' => 'utf8mb4'\n";
            $configContent .= "    ],\n";
            $configContent .= "    'jwt' => ['secret' => '{$jwtSecret}', 'expiry' => 604800],\n";
            $configContent .= "    'smtp' => [\n";
            $configContent .= "        'host' => '" . $escapeForPhp($smtp['host']) . "',\n";
            $configContent .= "        'port' => {$smtp['port']},\n";
            $configContent .= "        'user' => '" . $escapeForPhp($smtp['user']) . "',\n";
            $configContent .= "        'pass' => '" . $escapeForPhp($smtp['pass']) . "',\n";
            $configContent .= "        'from' => '" . $escapeForPhp($smtp['from']) . "'\n";
            $configContent .= "    ],\n";
            $configContent .= "    'imap' => [\n";
            $configContent .= "        'host' => '" . $escapeForPhp($imap['host']) . "',\n";
            $configContent .= "        'port' => {$imap['port']},\n";
            $configContent .= "        'user' => '" . $escapeForPhp($imap['user']) . "',\n";
            $configContent .= "        'pass' => '" . $escapeForPhp($imap['pass']) . "'\n";
            $configContent .= "    ],\n";
            $configContent .= "    'cors' => ['origins' => ['*']],\n";
            $configContent .= "    'diag_token' => '{$diagToken}',\n";
            $configContent .= "    'site_name' => 'TempMail',\n";
            $configContent .= "    'site_url' => ''\n";
            $configContent .= "];\n";
            
            $configPath = __DIR__ . '/config.php';
            if (file_put_contents($configPath, $configContent)) {
                @chmod($configPath, 0600);
                
                // Create directories
                foreach (['/storage', '/storage/avatars', '/storage/attachments', '/logs'] as $dir) {
                    $dirPath = __DIR__ . $dir;
                    if (!is_dir($dirPath)) @mkdir($dirPath, 0755, true);
                }
                
                // Protect directories
                foreach (['/logs', '/storage'] as $dir) {
                    $htaccess = __DIR__ . $dir . '/.htaccess';
                    if (!file_exists($htaccess)) {
                        file_put_contents($htaccess, "Order deny,allow\nDeny from all\n");
                    }
                }
                
                // Create install lock
                file_put_contents(__DIR__ . '/.install_lock', date('Y-m-d H:i:s'));
                
                $_SESSION['diag_token'] = $diagToken;
                $currentStep = 6;
            } else {
                $errors[] = "Failed to write config.php. Check directory permissions (should be 755).";
            }
            break;
    }
}

// Generate HTML page
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TempMail Installation</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: system-ui, -apple-system, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 700px; margin: 0 auto; }
        .card {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header p { opacity: 0.9; }
        .steps {
            display: flex;
            justify-content: center;
            gap: 8px;
            padding: 20px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            flex-wrap: wrap;
        }
        .step {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 14px;
            background: #e2e8f0;
            color: #64748b;
        }
        .step.active { background: #3b82f6; color: white; }
        .step.done { background: #10b981; color: white; }
        .content { padding: 30px; }
        .form-group { margin-bottom: 20px; }
        .form-group label {
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
            color: #334155;
        }
        .form-group input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.2s;
        }
        .form-group input:focus {
            outline: none;
            border-color: #3b82f6;
        }
        .form-group small {
            display: block;
            margin-top: 6px;
            color: #64748b;
            font-size: 13px;
        }
        .btn {
            display: inline-block;
            padding: 14px 28px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }
        .btn:hover { background: #2563eb; }
        .btn-success { background: #10b981; }
        .btn-success:hover { background: #059669; }
        .alert {
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .alert-error {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
        }
        .alert-success {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #16a34a;
        }
        .alert-warning {
            background: #fefce8;
            border: 1px solid #fef08a;
            color: #ca8a04;
        }
        .check-list { list-style: none; }
        .check-list li {
            padding: 12px 0;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .check-list li:last-child { border-bottom: none; }
        .check-icon { font-size: 20px; }
        .check-icon.pass { color: #10b981; }
        .check-icon.fail { color: #ef4444; }
        .final-info {
            background: #f8fafc;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }
        .final-info h3 { color: #1e3a5f; margin-bottom: 15px; }
        .final-info code {
            background: #1e293b;
            color: #10b981;
            padding: 8px 12px;
            border-radius: 6px;
            display: block;
            margin: 8px 0;
            word-break: break-all;
            font-size: 13px;
        }
        .row { display: flex; gap: 20px; }
        .row .form-group { flex: 1; }
        @media (max-width: 600px) {
            .row { flex-direction: column; gap: 0; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <h1>📧 TempMail Installation</h1>
                <p>Self-hosted temporary email backend setup</p>
            </div>
            
            <div class="steps">
                <?php for ($i = 1; $i <= 6; $i++): ?>
                <div class="step <?= $i < $currentStep ? 'done' : ($i === $currentStep ? 'active' : '') ?>">
                    <?= $i < $currentStep ? '✓' : $i ?>
                </div>
                <?php endfor; ?>
            </div>
            
            <div class="content">
                <?php if (!empty($errors)): ?>
                    <?php foreach ($errors as $error): ?>
                    <div class="alert alert-error">❌ <?= htmlspecialchars($error) ?></div>
                    <?php endforeach; ?>
                <?php endif; ?>
                
                <?php if (!empty($success)): ?>
                    <?php foreach ($success as $msg): ?>
                    <div class="alert alert-success">✅ <?= htmlspecialchars($msg) ?></div>
                    <?php endforeach; ?>
                <?php endif; ?>
                
                <?php if ($currentStep === 1): ?>
                <!-- Step 1: Requirements Check -->
                <h2 style="margin-bottom: 20px;">System Requirements</h2>
                <ul class="check-list">
                    <li>
                        <span class="check-icon <?= version_compare(PHP_VERSION, '8.0.0', '>=') ? 'pass' : 'fail' ?>">
                            <?= version_compare(PHP_VERSION, '8.0.0', '>=') ? '✅' : '❌' ?>
                        </span>
                        <div>
                            <strong>PHP Version</strong>
                            <div style="color: #64748b; font-size: 14px;">
                                Required: 8.0+ | Current: <?= PHP_VERSION ?>
                            </div>
                        </div>
                    </li>
                    <?php
                    $extensions = [
                        'pdo_mysql' => 'MySQL Database',
                        'mbstring' => 'Multibyte String',
                        'json' => 'JSON Support',
                        'openssl' => 'OpenSSL Encryption',
                        'imap' => 'IMAP (optional, for email)'
                    ];
                    foreach ($extensions as $ext => $label):
                        $loaded = extension_loaded($ext);
                    ?>
                    <li>
                        <span class="check-icon <?= $loaded ? 'pass' : ($ext === 'imap' ? 'pass' : 'fail') ?>">
                            <?= $loaded ? '✅' : ($ext === 'imap' ? '⚠️' : '❌') ?>
                        </span>
                        <div>
                            <strong><?= $label ?></strong>
                            <div style="color: #64748b; font-size: 14px;">
                                Extension: <?= $ext ?> | Status: <?= $loaded ? 'Loaded' : 'Not loaded' ?>
                            </div>
                        </div>
                    </li>
                    <?php endforeach; ?>
                    <li>
                        <span class="check-icon <?= is_writable(__DIR__) ? 'pass' : 'fail' ?>">
                            <?= is_writable(__DIR__) ? '✅' : '❌' ?>
                        </span>
                        <div>
                            <strong>Directory Writable</strong>
                            <div style="color: #64748b; font-size: 14px;">
                                api/ directory must be writable for config file
                            </div>
                        </div>
                    </li>
                </ul>
                
                <?php
                $allRequired = version_compare(PHP_VERSION, '8.0.0', '>=') 
                    && extension_loaded('pdo_mysql') 
                    && extension_loaded('mbstring') 
                    && extension_loaded('json')
                    && extension_loaded('openssl')
                    && is_writable(__DIR__);
                ?>
                
                <?php if ($allRequired): ?>
                <form method="post" style="margin-top: 30px;">
                    <input type="hidden" name="step" value="2">
                    <button type="submit" class="btn btn-success">Continue to Database Setup →</button>
                </form>
                <?php else: ?>
                <div class="alert alert-error" style="margin-top: 20px;">
                    Please fix the requirements above before continuing. Contact your hosting provider if needed.
                </div>
                <?php endif; ?>
                
                <?php elseif ($currentStep === 2): ?>
                <!-- Step 2: Database Configuration -->
                <h2 style="margin-bottom: 20px;">Database Configuration</h2>
                <p style="color: #64748b; margin-bottom: 20px;">Enter your MySQL database credentials from cPanel.</p>
                
                <form method="post">
                    <input type="hidden" name="step" value="2">
                    
                    <div class="form-group">
                        <label>Database Host</label>
                        <input type="text" name="db_host" value="<?= htmlspecialchars($_POST['db_host'] ?? 'localhost') ?>" required>
                        <small>Usually "localhost" for cPanel hosting</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Database Name</label>
                        <input type="text" name="db_name" value="<?= htmlspecialchars($_POST['db_name'] ?? '') ?>" required placeholder="username_tempmail">
                        <small>Create this in cPanel → MySQL Databases</small>
                    </div>
                    
                    <div class="row">
                        <div class="form-group">
                            <label>Database User</label>
                            <input type="text" name="db_user" value="<?= htmlspecialchars($_POST['db_user'] ?? '') ?>" required>
                        </div>
                        <div class="form-group">
                            <label>Database Password</label>
                            <input type="password" name="db_pass" value="">
                        </div>
                    </div>
                    
                    <button type="submit" class="btn">Test Connection & Continue →</button>
                </form>
                
                <?php elseif ($currentStep === 3): ?>
                <!-- Step 3: Create Tables -->
                <h2 style="margin-bottom: 20px;">Create Database Tables</h2>
                <p style="color: #64748b; margin-bottom: 20px;">Click below to create all required database tables.</p>
                
                <form method="post">
                    <input type="hidden" name="step" value="3">
                    <button type="submit" class="btn">Create Tables →</button>
                </form>
                
                <?php elseif ($currentStep === 4): ?>
                <!-- Step 4: Admin Account -->
                <h2 style="margin-bottom: 20px;">Create Admin Account</h2>
                <p style="color: #64748b; margin-bottom: 20px;">Set up your administrator account.</p>
                
                <form method="post">
                    <input type="hidden" name="step" value="4">
                    
                    <div class="form-group">
                        <label>Admin Email</label>
                        <input type="email" name="admin_email" value="<?= htmlspecialchars($_POST['admin_email'] ?? '') ?>" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Admin Password</label>
                        <input type="password" name="admin_pass" required minlength="8">
                        <small>Minimum 8 characters</small>
                    </div>
                    
                    <div class="form-group">
                        <label>Display Name</label>
                        <input type="text" name="admin_name" value="<?= htmlspecialchars($_POST['admin_name'] ?? 'Admin') ?>">
                    </div>
                    
                    <button type="submit" class="btn">Create Admin →</button>
                </form>
                
                <?php elseif ($currentStep === 5): ?>
                <!-- Step 5: SMTP/IMAP Configuration -->
                <h2 style="margin-bottom: 20px;">Email Server Configuration</h2>
                <p style="color: #64748b; margin-bottom: 20px;">Configure SMTP for sending and IMAP for receiving emails. You can skip this and configure later.</p>
                
                <form method="post">
                    <input type="hidden" name="step" value="5">
                    
                    <h3 style="margin: 20px 0 15px; color: #334155;">SMTP Settings (Sending)</h3>
                    <div class="row">
                        <div class="form-group">
                            <label>SMTP Host</label>
                            <input type="text" name="smtp_host" placeholder="mail.yourdomain.com">
                        </div>
                        <div class="form-group">
                            <label>SMTP Port</label>
                            <input type="number" name="smtp_port" value="587">
                        </div>
                    </div>
                    <div class="row">
                        <div class="form-group">
                            <label>SMTP Username</label>
                            <input type="text" name="smtp_user" placeholder="noreply@yourdomain.com">
                        </div>
                        <div class="form-group">
                            <label>SMTP Password</label>
                            <input type="password" name="smtp_pass">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>From Email</label>
                        <input type="email" name="smtp_from" placeholder="noreply@yourdomain.com">
                    </div>
                    
                    <h3 style="margin: 30px 0 15px; color: #334155;">IMAP Settings (Receiving)</h3>
                    <div class="row">
                        <div class="form-group">
                            <label>IMAP Host</label>
                            <input type="text" name="imap_host" placeholder="mail.yourdomain.com">
                        </div>
                        <div class="form-group">
                            <label>IMAP Port</label>
                            <input type="number" name="imap_port" value="993">
                        </div>
                    </div>
                    <div class="row">
                        <div class="form-group">
                            <label>IMAP Username</label>
                            <input type="text" name="imap_user" placeholder="catchall@yourdomain.com">
                        </div>
                        <div class="form-group">
                            <label>IMAP Password</label>
                            <input type="password" name="imap_pass">
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-success">Save Configuration & Finish →</button>
                </form>
                
                <?php elseif ($currentStep === 6): ?>
                <!-- Step 6: Complete -->
                <div style="text-align: center;">
                    <div style="font-size: 80px; margin-bottom: 20px;">🎉</div>
                    <h2 style="color: #10b981; margin-bottom: 20px;">Installation Complete!</h2>
                    <p style="color: #64748b; margin-bottom: 30px;">Your TempMail backend is now ready to use.</p>
                </div>
                
                <div class="alert alert-warning">
                    <strong>⚠️ Security:</strong> Delete this file (install.php) immediately!
                </div>
                
                <div class="final-info">
                    <h3>📋 Next Steps</h3>
                    <ol style="padding-left: 20px; line-height: 2;">
                        <li><strong>Delete install.php</strong> (this file) for security</li>
                        <li>Set up cron jobs in cPanel:
                            <code>*/2 * * * * /usr/bin/php ~/public_html/api/cron/imap-poll.php</code>
                            <code>0 * * * * /usr/bin/php ~/public_html/api/cron/maintenance.php</code>
                        </li>
                        <li>Test the API: <a href="/api/health" target="_blank">/api/health</a></li>
                        <li>Log in to admin panel with your admin credentials</li>
                    </ol>
                    
                    <?php if (isset($_SESSION['diag_token'])): ?>
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                        <strong>Diagnostic Token (save this!):</strong>
                        <code><?= htmlspecialchars($_SESSION['diag_token']) ?></code>
                        <small style="display: block; margin-top: 8px;">Use this to access /api/health/diag?token=YOUR_TOKEN</small>
                    </div>
                    <?php endif; ?>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                    <a href="/" class="btn btn-success">Go to TempMail →</a>
                </div>
                <?php endif; ?>
            </div>
        </div>
        
        <p style="text-align: center; color: white; opacity: 0.8; margin-top: 20px; font-size: 14px;">
            TempMail Self-Hosted • PHP <?= PHP_VERSION ?>
        </p>
    </div>
</body>
</html>
