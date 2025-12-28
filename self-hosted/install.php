<?php
/**
 * Self-Hosted Temp Email - Complete Installation Wizard
 * 
 * A comprehensive setup wizard that:
 * 1. Collects database, domain, URL, and email configuration
 * 2. Tests all connections (DB, IMAP, SMTP)
 * 3. Creates database schema and runs migrations
 * 4. Sets up admin account
 * 5. Locks itself after successful installation
 * 
 * Access: https://yourdomain.com/install.php
 */

session_start();
error_reporting(E_ALL);
ini_set('display_errors', 0);

// ============================================================================
// INSTALLATION LOCK CHECK
// ============================================================================

$configFile = __DIR__ . '/api/config.php';
$isInstalled = false;
$installLockReason = '';

// Check 1: Config file exists with valid database
if (file_exists($configFile)) {
    try {
        $config = require $configFile;
        $dbConfig = $config['database'] ?? $config['db'] ?? null;
        
        if ($dbConfig && !empty($dbConfig['host'])) {
            // Try to connect and check for installation_completed flag
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
                $dbConfig['host'] ?? 'localhost',
                $dbConfig['port'] ?? 3306,
                $dbConfig['name'] ?? $dbConfig['dbname'] ?? ''
            );
            
            $pdo = new PDO($dsn, $dbConfig['username'] ?? $dbConfig['user'] ?? '', $dbConfig['password'] ?? $dbConfig['pass'] ?? '', [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            
            // Check if installation is marked as complete
            $stmt = $pdo->prepare("SELECT value FROM app_settings WHERE `key` = 'installation_completed' LIMIT 1");
            $stmt->execute();
            $result = $stmt->fetchColumn();
            
            if ($result && (json_decode($result) === true || $result === 'true' || $result === '"true"')) {
                $isInstalled = true;
                $installLockReason = 'Installation has been completed. Access the setup wizard from Admin Panel if needed.';
            }
        }
    } catch (Exception $e) {
        // Config exists but can't connect - allow reinstall
    }
}

// Check 2: Install lock file
$lockFile = __DIR__ . '/.install_lock';
if (file_exists($lockFile)) {
    $lockData = json_decode(file_get_contents($lockFile), true);
    if ($lockData && isset($lockData['locked']) && $lockData['locked'] === true) {
        $isInstalled = true;
        $installLockReason = 'Installation locked on ' . ($lockData['date'] ?? 'unknown date') . '. Delete .install_lock to reinstall.';
    }
}

// If installed, show locked message
if ($isInstalled && !isset($_GET['force'])) {
    showLockedPage($installLockReason);
    exit;
}

// ============================================================================
// HANDLE AJAX REQUESTS
// ============================================================================

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['ajax_action'])) {
    header('Content-Type: application/json');

    $hasResponse = false;

    // If PHP fatals (timeouts, parse errors, memory, etc.), return JSON instead of hanging.
    register_shutdown_function(function () use (&$hasResponse) {
        if ($hasResponse) {
            return;
        }
        $err = error_get_last();
        if (!$err) {
            return;
        }
        $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
        if (!in_array($err['type'], $fatalTypes, true)) {
            return;
        }

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Installation failed: ' . ($err['message'] ?? 'Fatal error'),
        ]);
    });

    try {
        $action = $_POST['ajax_action'];

        // Installation can take longer than default shared-hosting limits.
        if ($action === 'run_installation') {
            @ignore_user_abort(true);
            @set_time_limit(300);
            @ini_set('max_execution_time', '300');
        }

        switch ($action) {
            case 'test_database':
                $result = testDatabaseConnection($_POST);
                break;

            case 'test_imap':
                $result = testImapConnection($_POST);
                break;

            case 'test_smtp':
                $result = testSmtpConnection($_POST);
                break;

            case 'verify_domain':
                $skipDns = isset($_POST['skip_dns']) && ($_POST['skip_dns'] === 'true' || $_POST['skip_dns'] === '1');
                $result = verifyDomain($_POST['domain'] ?? '', $skipDns);
                break;

            case 'run_installation':
                $result = runInstallation($_POST);
                break;

            default:
                $result = ['success' => false, 'error' => 'Unknown action'];
        }

        $hasResponse = true;
        echo json_encode($result);
    } catch (Exception $e) {
        $hasResponse = true;
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

function testDatabaseConnection(array $data): array {
    $host = trim($data['db_host'] ?? 'localhost');
    $port = (int)($data['db_port'] ?? 3306);
    $name = trim($data['db_name'] ?? '');
    $user = trim($data['db_user'] ?? '');
    $pass = $data['db_pass'] ?? '';
    
    if (empty($name) || empty($user)) {
        return ['success' => false, 'error' => 'Database name and user are required'];
    }
    
    try {
        // First try to connect without database (to check if we need to create it)
        $dsn = "mysql:host={$host};port={$port};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 10,
        ]);
        
        // Check if database exists
        $stmt = $pdo->prepare("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?");
        $stmt->execute([$name]);
        $dbExists = $stmt->fetchColumn() !== false;
        
        // Try to connect to the specific database
        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        
        // Check MySQL version
        $version = $pdo->query("SELECT VERSION()")->fetchColumn();
        
        // Check for required tables
        $stmt = $pdo->query("SHOW TABLES");
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        return [
            'success' => true,
            'message' => 'Connected successfully!',
            'details' => [
                'mysql_version' => $version,
                'database' => $name,
                'tables_found' => count($tables),
                'db_existed' => $dbExists,
            ]
        ];
        
    } catch (PDOException $e) {
        $errorMsg = $e->getMessage();
        
        // Provide helpful error messages
        if (strpos($errorMsg, 'Access denied') !== false) {
            return ['success' => false, 'error' => 'Access denied. Check username and password.'];
        }
        if (strpos($errorMsg, 'Unknown database') !== false) {
            return ['success' => false, 'error' => "Database '{$name}' does not exist. Create it in cPanel first."];
        }
        if (strpos($errorMsg, 'Connection refused') !== false) {
            return ['success' => false, 'error' => 'Connection refused. Check if MySQL is running.'];
        }
        if (strpos($errorMsg, 'getaddrinfo') !== false || strpos($errorMsg, 'resolve') !== false) {
            return ['success' => false, 'error' => "Cannot resolve hostname '{$host}'. Check the host address."];
        }
        
        return ['success' => false, 'error' => $errorMsg];
    }
}

function testImapConnection(array $data): array {
    $host = trim($data['imap_host'] ?? '');
    $port = (int)($data['imap_port'] ?? 993);
    $user = trim($data['imap_user'] ?? '');
    $pass = $data['imap_pass'] ?? '';
    $encryption = $data['imap_encryption'] ?? 'ssl';
    
    if (empty($host) || empty($user) || empty($pass)) {
        return ['success' => false, 'error' => 'IMAP host, username, and password are required'];
    }
    
    // Check if IMAP extension is available
    if (!function_exists('imap_open')) {
        return [
            'success' => false, 
            'error' => 'IMAP extension not installed. Contact your hosting provider to enable php-imap.',
            'extension_missing' => true
        ];
    }
    
    try {
        // Build connection string
        $flags = '/imap';
        if ($encryption === 'ssl') {
            $flags .= '/ssl';
        } elseif ($encryption === 'tls') {
            $flags .= '/tls';
        }
        $flags .= '/novalidate-cert'; // For self-signed certs
        
        $mailbox = "{" . $host . ":" . $port . $flags . "}INBOX";
        
        // Suppress warnings during connection attempt
        $connection = @imap_open($mailbox, $user, $pass, 0, 1, ['DISABLE_AUTHENTICATOR' => 'GSSAPI']);
        
        if ($connection) {
            // Get mailbox info
            $info = imap_check($connection);
            $msgCount = $info ? $info->Nmsgs : 0;
            
            imap_close($connection);
            
            return [
                'success' => true,
                'message' => 'IMAP connection successful!',
                'details' => [
                    'mailbox' => 'INBOX',
                    'messages' => $msgCount,
                    'host' => $host,
                    'encryption' => $encryption,
                ]
            ];
        } else {
            $error = imap_last_error();
            return ['success' => false, 'error' => $error ?: 'Failed to connect to IMAP server'];
        }
        
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

function testSmtpConnection(array $data): array {
    $host = trim($data['smtp_host'] ?? '');
    $port = (int)($data['smtp_port'] ?? 587);
    $user = trim($data['smtp_user'] ?? '');
    $pass = $data['smtp_pass'] ?? '';
    $encryption = $data['smtp_encryption'] ?? 'tls';
    
    if (empty($host)) {
        return ['success' => false, 'error' => 'SMTP host is required'];
    }
    
    try {
        // Simple socket test
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true,
            ]
        ]);
        
        $prefix = ($encryption === 'ssl') ? 'ssl://' : '';
        $socket = @stream_socket_client(
            $prefix . $host . ':' . $port,
            $errno,
            $errstr,
            10,
            STREAM_CLIENT_CONNECT,
            $context
        );
        
        if (!$socket) {
            return ['success' => false, 'error' => "Cannot connect to {$host}:{$port} - {$errstr}"];
        }
        
        // Read greeting
        $greeting = fgets($socket, 1024);
        
        // Send EHLO
        fwrite($socket, "EHLO localhost\r\n");
        $response = '';
        while ($line = fgets($socket, 1024)) {
            $response .= $line;
            if (substr($line, 3, 1) === ' ') break;
        }
        
        // Check for STARTTLS if using TLS
        $supportsTls = strpos($response, 'STARTTLS') !== false;
        $supportsAuth = strpos($response, 'AUTH') !== false;
        
        fwrite($socket, "QUIT\r\n");
        fclose($socket);
        
        return [
            'success' => true,
            'message' => 'SMTP server is reachable!',
            'details' => [
                'host' => $host,
                'port' => $port,
                'encryption' => $encryption,
                'supports_tls' => $supportsTls,
                'supports_auth' => $supportsAuth,
                'greeting' => trim($greeting),
            ]
        ];
        
    } catch (Exception $e) {
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

function verifyDomain(string $domain, bool $skipDnsCheck = false): array {
    $domain = trim(strtolower($domain));
    
    if (empty($domain)) {
        return ['success' => false, 'error' => 'Domain is required'];
    }
    
    // Remove any protocol
    $domain = preg_replace('/^https?:\/\//', '', $domain);
    $domain = preg_replace('/\/.*$/', '', $domain);
    
    $checks = [
        'valid_format' => false,
        'dns_exists' => false,
        'has_mx' => false,
        'mx_records' => [],
        'skipped' => false,
    ];
    
    // Validate format
    if (preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/', $domain)) {
        $checks['valid_format'] = true;
    }
    
    // If skip DNS check is enabled (same-server installation)
    if ($skipDnsCheck) {
        $checks['skipped'] = true;
        $checks['dns_exists'] = true; // Assume valid for self-hosted
        return [
            'success' => $checks['valid_format'],
            'message' => $checks['valid_format'] ? 'Domain format valid (DNS check skipped for same-server installation)' : 'Invalid domain format',
            'domain' => $domain,
            'checks' => $checks,
        ];
    }
    
    // Try multiple DNS resolvers for reliability
    $dnsChecked = false;
    
    // First try PHP's built-in DNS functions
    if (checkdnsrr($domain, 'A') || checkdnsrr($domain, 'AAAA')) {
        $checks['dns_exists'] = true;
        $dnsChecked = true;
    }
    
    // Fallback: Try external DNS via socket (Google DNS 8.8.8.8)
    if (!$dnsChecked) {
        $externalCheck = @dns_get_record($domain, DNS_A);
        if ($externalCheck && count($externalCheck) > 0) {
            $checks['dns_exists'] = true;
            $dnsChecked = true;
        }
    }
    
    // For same-server hosting, DNS might not resolve externally - give a warning but allow
    if (!$dnsChecked) {
        // Check if we can connect to the domain via HTTP (it might be on same server)
        $context = stream_context_create([
            'http' => ['timeout' => 3, 'ignore_errors' => true],
            'ssl' => ['verify_peer' => false, 'verify_peer_name' => false]
        ]);
        $headers = @get_headers("http://{$domain}", 0, $context);
        if ($headers && count($headers) > 0) {
            $checks['dns_exists'] = true;
            $checks['same_server_detected'] = true;
        }
    }
    
    // Check MX records
    $mxRecords = [];
    if (getmxrr($domain, $mxRecords)) {
        $checks['has_mx'] = true;
        $checks['mx_records'] = array_slice($mxRecords, 0, 3);
    }
    
    $allPassed = $checks['valid_format'] && $checks['dns_exists'];
    
    return [
        'success' => $allPassed,
        'message' => $allPassed ? 'Domain verified!' : 'Domain verification failed. Try enabling "Skip DNS check" if you are hosting on the same server.',
        'domain' => $domain,
        'checks' => $checks,
    ];
}

function executeSqlFile(PDO $pdo, string $filePath): array {
    $content = file_get_contents($filePath);
    $errors = [];
    $executedCount = 0;
    
    // Disable foreign key checks for schema creation
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    $pdo->exec("SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'");
    
    // Robust SQL statement parser that handles edge cases
    $statements = [];
    $current = '';
    $inString = false;
    $stringChar = '';
    $inComment = false;
    $commentType = '';
    $len = strlen($content);
    
    for ($i = 0; $i < $len; $i++) {
        $char = $content[$i];
        $nextChar = ($i + 1 < $len) ? $content[$i + 1] : '';
        
        // Handle single-line comments (-- or #)
        if (!$inString && !$inComment) {
            if (($char === '-' && $nextChar === '-') || $char === '#') {
                $inComment = true;
                $commentType = 'single';
                continue;
            }
            // Handle multi-line comments /* */
            if ($char === '/' && $nextChar === '*') {
                $inComment = true;
                $commentType = 'multi';
                $i++; // Skip next char
                continue;
            }
        }
        
        // End of single-line comment
        if ($inComment && $commentType === 'single' && ($char === "\n" || $char === "\r")) {
            $inComment = false;
            continue;
        }
        
        // End of multi-line comment
        if ($inComment && $commentType === 'multi' && $char === '*' && $nextChar === '/') {
            $inComment = false;
            $i++; // Skip next char
            continue;
        }
        
        // Skip comment content
        if ($inComment) {
            continue;
        }
        
        // Handle string literals (skip escaped quotes)
        if (($char === "'" || $char === '"') && ($i === 0 || $content[$i - 1] !== '\\')) {
            if (!$inString) {
                $inString = true;
                $stringChar = $char;
            } elseif ($char === $stringChar) {
                $inString = false;
            }
        }
        
        // Check for statement terminator
        if ($char === ';' && !$inString) {
            $stmt = trim($current);
            if (!empty($stmt)) {
                $statements[] = $stmt;
            }
            $current = '';
        } else {
            $current .= $char;
        }
    }
    
    // Add final statement if exists (without semicolon)
    $finalStmt = trim($current);
    if (!empty($finalStmt)) {
        $statements[] = $finalStmt;
    }
    
    // Execute each statement
    foreach ($statements as $stmt) {
        // Skip empty or whitespace-only statements
        if (empty(trim($stmt))) {
            continue;
        }
        
        try {
            $pdo->exec($stmt);
            $executedCount++;
        } catch (PDOException $e) {
            $errorMsg = $e->getMessage();
            // Ignore "already exists" and "duplicate" errors for idempotency
            if (strpos($errorMsg, 'already exists') === false && 
                strpos($errorMsg, 'Duplicate') === false &&
                strpos($errorMsg, 'doesn\'t exist') === false) {
                $errors[] = [
                    'statement' => mb_substr($stmt, 0, 150) . (strlen($stmt) > 150 ? '...' : ''),
                    'error' => $errorMsg
                ];
            }
        }
    }
    
    // Re-enable foreign key checks
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    
    return [
        'executed' => $executedCount,
        'errors' => $errors
    ];
}

function verifyRequiredTables(PDO $pdo): array {
    $requiredTables = ['users', 'domains', 'temp_emails', 'received_emails', 'app_settings', 'sessions', 'profiles'];
    $missingTables = [];
    
    foreach ($requiredTables as $table) {
        $result = $pdo->query("SHOW TABLES LIKE '{$table}'")->fetch();
        if (!$result) {
            $missingTables[] = $table;
        }
    }
    
    return $missingTables;
}

function runInstallation(array $data): array {
    global $configFile, $lockFile;

    try {
        // Installation can take a while on shared hosting.
        @ignore_user_abort(true);
        @set_time_limit(300);
        @ini_set('max_execution_time', '300');

        // Validate required fields
        $required = ['db_host', 'db_name', 'db_user', 'site_url', 'admin_email', 'admin_pass', 'domain'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                return ['success' => false, 'error' => "Required field missing: {$field}"];
            }
        }
        
        // Connect to database
        $dsn = sprintf(
            'mysql:host=%s;port=%s;charset=utf8mb4',
            $data['db_host'],
            $data['db_port'] ?? 3306
        );
        
        $pdo = new PDO($dsn, $data['db_user'], $data['db_pass'] ?? '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        
        // Create database if not exists
        $dbName = $data['db_name'];
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `{$dbName}`");
        
        // Run schema using improved parser
        $schemaFile = __DIR__ . '/database/schema.mysql.sql';
        if (!file_exists($schemaFile)) {
            return ['success' => false, 'error' => 'Schema file not found: database/schema.mysql.sql'];
        }
        
        $schemaResult = executeSqlFile($pdo, $schemaFile);
        
        // Check for critical errors
        if (!empty($schemaResult['errors'])) {
            // Only fail if there are real errors (not just "already exists")
            $criticalErrors = array_filter($schemaResult['errors'], function($e) {
                return strpos($e['error'], 'syntax') !== false || 
                       strpos($e['error'], 'Access denied') !== false;
            });
            
            if (!empty($criticalErrors)) {
                $errorDetails = array_map(function($e) {
                    return $e['error'] . ' (SQL: ' . $e['statement'] . ')';
                }, array_slice($criticalErrors, 0, 3));
                
                return ['success' => false, 'error' => 'Schema errors: ' . implode('; ', $errorDetails)];
            }
        }
        
        // Verify critical tables were created
        $missingTables = verifyRequiredTables($pdo);
        if (!empty($missingTables)) {
            return [
                'success' => false, 
                'error' => 'Required tables not created: ' . implode(', ', $missingTables) . 
                          '. Please check the database/schema.mysql.sql file and try running it manually in phpMyAdmin.',
                'debug' => [
                    'executed_statements' => $schemaResult['executed'],
                    'errors' => $schemaResult['errors']
                ]
            ];
        }
        
        // Generate security keys
        $jwtSecret = bin2hex(random_bytes(32));
        $encryptionKey = bin2hex(random_bytes(32));
        
        // Create admin user
        $adminId = sprintf('%08x-%04x-%04x-%04x-%012x',
            mt_rand(0, 0xffffffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffffffffffff)
        );
        
        $passwordHash = password_hash($data['admin_pass'], PASSWORD_ARGON2ID);
        
        // Insert admin user
        $stmt = $pdo->prepare("
            INSERT INTO users (id, email, password_hash, email_verified, email_verified_at, created_at, updated_at)
            VALUES (?, ?, ?, 1, NOW(), NOW(), NOW())
            ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)
        ");
        $stmt->execute([$adminId, $data['admin_email'], $passwordHash]);
        
        // Get actual user ID (in case of duplicate)
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$data['admin_email']]);
        $adminId = $stmt->fetchColumn();
        
        // Create admin role (table already exists from schema, just insert)
        $stmt = $pdo->prepare("
            INSERT INTO user_roles (id, user_id, role, created_at, updated_at)
            VALUES (UUID(), ?, 'super_admin', NOW(), NOW())
            ON DUPLICATE KEY UPDATE role = 'super_admin', updated_at = NOW()
        ");
        $stmt->execute([$adminId]);
        
        // Create admin profile
        $stmt = $pdo->prepare("
            INSERT INTO profiles (id, user_id, display_name, full_name, created_at, updated_at)
            VALUES (UUID(), ?, 'Admin', 'System Administrator', NOW(), NOW())
            ON DUPLICATE KEY UPDATE display_name = 'Admin', updated_at = NOW()
        ");
        $stmt->execute([$adminId]);
        
        // Add domain
        $domain = strtolower(trim($data['domain']));
        $domain = preg_replace('/^https?:\/\//', '', $domain);
        $domain = preg_replace('/\/.*$/', '', $domain);
        
        $stmt = $pdo->prepare("
            INSERT INTO domains (id, domain, display_name, is_active, created_at, updated_at)
            VALUES (UUID(), ?, ?, 1, NOW(), NOW())
            ON DUPLICATE KEY UPDATE is_active = 1
        ");
        $stmt->execute([$domain, $data['site_name'] ?? 'TempMail']);
        
        // Add settings
        $settings = [
            ['site_name', json_encode($data['site_name'] ?? 'TempMail'), 'string', 'general', 1],
            ['site_url', json_encode(rtrim($data['site_url'], '/')), 'string', 'general', 1],
            ['default_email_expiry_hours', '24', 'number', 'email', 1],
            ['max_emails_per_hour', '20', 'number', 'email', 1],
            ['installation_completed', 'true', 'boolean', 'system', 0],
            ['installation_date', json_encode(date('Y-m-d H:i:s')), 'string', 'system', 0],
            ['schema_version', '"1.0.0"', 'string', 'system', 0],
        ];
        
        // Add IMAP settings if provided
        if (!empty($data['imap_host'])) {
            $settings[] = ['imap_enabled', 'true', 'boolean', 'imap', 0];
            $settings[] = ['imap_host', json_encode($data['imap_host']), 'string', 'imap', 0];
            $settings[] = ['imap_port', (string)($data['imap_port'] ?? 993), 'number', 'imap', 0];
            $settings[] = ['imap_username', json_encode($data['imap_user'] ?? ''), 'string', 'imap', 0];
            $settings[] = ['imap_encryption', json_encode($data['imap_encryption'] ?? 'ssl'), 'string', 'imap', 0];
        }
        
        // Add SMTP settings if provided
        if (!empty($data['smtp_host'])) {
            $settings[] = ['smtp_enabled', 'true', 'boolean', 'smtp', 0];
            $settings[] = ['smtp_host', json_encode($data['smtp_host']), 'string', 'smtp', 0];
            $settings[] = ['smtp_port', (string)($data['smtp_port'] ?? 587), 'number', 'smtp', 0];
            $settings[] = ['smtp_username', json_encode($data['smtp_user'] ?? ''), 'string', 'smtp', 0];
            $settings[] = ['smtp_from_email', json_encode($data['smtp_from'] ?? $data['admin_email']), 'string', 'smtp', 0];
        }
        
        $stmt = $pdo->prepare("
            INSERT INTO app_settings (id, `key`, value, value_type, category, is_public, created_at, updated_at)
            VALUES (UUID(), ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE value = VALUES(value)
        ");
        
        foreach ($settings as $setting) {
            $stmt->execute($setting);
        }
        
        // Create config.php
        $siteUrl = rtrim($data['site_url'], '/');
        $configContent = generateConfigFile($data, $jwtSecret, $encryptionKey);
        
        if (!file_put_contents($configFile, $configContent)) {
            return ['success' => false, 'error' => 'Failed to write config.php. Check directory permissions.'];
        }
        
        // Create install lock
        $lockData = [
            'locked' => true,
            'date' => date('Y-m-d H:i:s'),
            'admin_email' => $data['admin_email'],
            'domain' => $domain,
        ];
        file_put_contents($lockFile, json_encode($lockData, JSON_PRETTY_PRINT));
        
        // Store success in session for redirect
        $_SESSION['install_success'] = true;
        $_SESSION['install_admin_email'] = $data['admin_email'];
        $_SESSION['install_domain'] = $domain;
        
        return [
            'success' => true,
            'message' => 'Installation completed successfully!',
            'redirect' => '/',
            'details' => [
                'admin_email' => $data['admin_email'],
                'domain' => $domain,
                'site_url' => $siteUrl,
            ]
        ];
        
    } catch (Exception $e) {
        return ['success' => false, 'error' => 'Installation failed: ' . $e->getMessage()];
    }
}

function generateConfigFile(array $data, string $jwtSecret, string $encryptionKey): string {
    $siteUrl = rtrim($data['site_url'], '/');
    
    return "<?php
/**
 * Application Configuration
 * Generated by installer on " . date('Y-m-d H:i:s') . "
 * 
 * WARNING: Do not edit manually unless you know what you're doing!
 */

return [
    // Database Configuration
    'database' => [
        'host' => " . var_export($data['db_host'], true) . ",
        'port' => " . var_export((int)($data['db_port'] ?? 3306), true) . ",
        'name' => " . var_export($data['db_name'], true) . ",
        'username' => " . var_export($data['db_user'], true) . ",
        'password' => " . var_export($data['db_pass'] ?? '', true) . ",
        'charset' => 'utf8mb4',
    ],
    
    // Legacy database key (for compatibility)
    'db' => [
        'host' => " . var_export($data['db_host'], true) . ",
        'name' => " . var_export($data['db_name'], true) . ",
        'user' => " . var_export($data['db_user'], true) . ",
        'pass' => " . var_export($data['db_pass'] ?? '', true) . ",
        'charset' => 'utf8mb4',
    ],
    
    // Application Settings
    'app' => [
        'name' => " . var_export($data['site_name'] ?? 'TempMail', true) . ",
        'url' => " . var_export($siteUrl, true) . ",
        'debug' => false,
        'timezone' => 'UTC',
    ],
    
    // Legacy site key
    'site' => [
        'url' => " . var_export($siteUrl, true) . ",
        'name' => " . var_export($data['site_name'] ?? 'TempMail', true) . ",
    ],
    
    // Security Settings
    'security' => [
        'jwt_secret' => " . var_export($jwtSecret, true) . ",
        'jwt_expiry_hours' => 168,
        'encryption_key' => " . var_export($encryptionKey, true) . ",
        'allowed_origins' => [
            " . var_export($siteUrl, true) . ",
        ],
    ],
    
    // Webhooks (for instant email delivery)
    'webhooks' => [
        'enabled' => true,
        'secrets' => [
            // Add your webhook provider secret here
        ],
        'rate_limit_per_minute' => 100,
    ],
    
    // Real-time Updates
    'realtime' => [
        'enabled' => true,
        'poll_interval_ms' => 3000,
        'connection_timeout' => 30,
    ],
    
    // IMAP Settings" . (!empty($data['imap_host']) ? "
    'imap' => [
        'enabled' => true,
        'host' => " . var_export($data['imap_host'], true) . ",
        'port' => " . var_export((int)($data['imap_port'] ?? 993), true) . ",
        'username' => " . var_export($data['imap_user'] ?? '', true) . ",
        'password' => " . var_export($data['imap_pass'] ?? '', true) . ",
        'encryption' => " . var_export($data['imap_encryption'] ?? 'ssl', true) . ",
        'folder' => 'INBOX',
        'poll_interval' => 120,
        'max_emails_per_poll' => 50,
    ]," : "
    'imap' => [
        'enabled' => false,
        'host' => '',
        'port' => 993,
        'username' => '',
        'password' => '',
        'encryption' => 'ssl',
        'folder' => 'INBOX',
        'poll_interval' => 120,
    ],") . "
    
    // SMTP Settings" . (!empty($data['smtp_host']) ? "
    'smtp' => [
        'enabled' => true,
        'host' => " . var_export($data['smtp_host'], true) . ",
        'port' => " . var_export((int)($data['smtp_port'] ?? 587), true) . ",
        'username' => " . var_export($data['smtp_user'] ?? '', true) . ",
        'password' => " . var_export($data['smtp_pass'] ?? '', true) . ",
        'encryption' => " . var_export($data['smtp_encryption'] ?? 'tls', true) . ",
        'from_email' => " . var_export($data['smtp_from'] ?? $data['admin_email'], true) . ",
        'from_name' => " . var_export($data['site_name'] ?? 'TempMail', true) . ",
    ]," : "
    'smtp' => [
        'enabled' => false,
        'host' => '',
        'port' => 587,
        'username' => '',
        'password' => '',
        'encryption' => 'tls',
        'from_email' => '',
        'from_name' => '',
    ],") . "
    
    // Stripe Payments (optional)
    'stripe' => [
        'enabled' => false,
        'secret_key' => '',
        'webhook_secret' => '',
    ],
    
    // Rate Limiting
    'rate_limits' => [
        'emails_per_hour' => 20,
        'api_per_minute' => 60,
        'webhook_per_minute' => 100,
        'login_attempts' => 5,
        'lockout_minutes' => 15,
    ],
    
    // File Uploads
    'uploads' => [
        'path' => __DIR__ . '/../uploads',
        'max_size_mb' => 25,
        'allowed_extensions' => ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'zip'],
    ],
];
";
}

function showLockedPage(string $reason): void {
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Installation Locked</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 2rem;
                color: #e2e8f0;
            }
            .card {
                background: rgba(30, 41, 59, 0.8);
                border: 1px solid rgba(71, 85, 105, 0.5);
                border-radius: 1rem;
                padding: 3rem;
                max-width: 500px;
                text-align: center;
                backdrop-filter: blur(10px);
            }
            .icon { font-size: 4rem; margin-bottom: 1.5rem; }
            h1 { font-size: 1.5rem; margin-bottom: 1rem; color: #f1f5f9; }
            p { color: #94a3b8; line-height: 1.6; margin-bottom: 1.5rem; }
            .btn {
                display: inline-block;
                padding: 0.75rem 1.5rem;
                background: #3b82f6;
                color: white;
                text-decoration: none;
                border-radius: 0.5rem;
                font-weight: 500;
                margin: 0.5rem;
            }
            .btn:hover { background: #2563eb; }
            .btn-outline {
                background: transparent;
                border: 1px solid #475569;
            }
            .btn-outline:hover { background: rgba(71, 85, 105, 0.3); }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">🔒</div>
            <h1>Installation Complete</h1>
            <p><?= htmlspecialchars($reason) ?></p>
            <a href="/" class="btn">Go to Homepage</a>
            <a href="/admin" class="btn btn-outline">Admin Panel</a>
        </div>
    </body>
    </html>
    <?php
}

// ============================================================================
// MAIN PAGE RENDER
// ============================================================================

$step = (int)($_GET['step'] ?? 1);
$maxSteps = 5;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Install - TempMail Self-Hosted</title>
    <style>
        :root {
            --bg: #0f172a;
            --card: #1e293b;
            --border: #334155;
            --text: #f1f5f9;
            --text-muted: #94a3b8;
            --primary: #3b82f6;
            --primary-hover: #2563eb;
            --success: #22c55e;
            --warning: #f59e0b;
            --danger: #ef4444;
        }
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, var(--bg) 0%, #1a1a2e 100%);
            min-height: 100vh;
            color: var(--text);
            line-height: 1.6;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        /* Header */
        .header {
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .logo {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
        }
        
        .header h1 {
            font-size: 1.75rem;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .header p { color: var(--text-muted); }
        
        /* Progress Steps */
        .steps {
            display: flex;
            justify-content: center;
            gap: 0.25rem;
            margin-bottom: 2rem;
        }
        
        .step {
            width: 3rem;
            height: 3rem;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            background: var(--card);
            border: 2px solid var(--border);
            color: var(--text-muted);
            position: relative;
        }
        
        .step.active {
            background: var(--primary);
            border-color: var(--primary);
            color: white;
        }
        
        .step.done {
            background: var(--success);
            border-color: var(--success);
            color: white;
        }
        
        .step:not(:last-child)::after {
            content: '';
            position: absolute;
            left: 100%;
            top: 50%;
            width: 1rem;
            height: 2px;
            background: var(--border);
        }
        
        .step.done:not(:last-child)::after {
            background: var(--success);
        }
        
        /* Card */
        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 1rem;
            padding: 2rem;
            margin-bottom: 1.5rem;
        }
        
        .card-title {
            font-size: 1.25rem;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .card-description {
            color: var(--text-muted);
            margin-bottom: 1.5rem;
            font-size: 0.875rem;
        }
        
        /* Form Elements */
        .form-group {
            margin-bottom: 1.25rem;
        }
        
        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }
        
        @media (max-width: 600px) {
            .form-row { grid-template-columns: 1fr; }
        }
        
        label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            font-size: 0.875rem;
        }
        
        input, select {
            width: 100%;
            padding: 0.75rem 1rem;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            color: var(--text);
            font-size: 1rem;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        
        input:focus, select:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
        }
        
        input::placeholder { color: var(--text-muted); }
        
        .hint {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 0.25rem;
        }
        
        /* Buttons */
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 0.5rem;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn-primary {
            background: var(--primary);
            color: white;
        }
        
        .btn-primary:hover { background: var(--primary-hover); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: var(--text);
            border: 1px solid var(--border);
        }
        
        .btn-secondary:hover { background: rgba(255, 255, 255, 0.15); }
        
        .btn-success { background: var(--success); color: white; }
        .btn-danger { background: var(--danger); color: white; }
        
        .btn-group {
            display: flex;
            gap: 1rem;
            margin-top: 2rem;
        }
        
        .btn-group .btn { flex: 1; }
        
        /* Test Result */
        .test-result {
            padding: 1rem;
            border-radius: 0.5rem;
            margin-top: 1rem;
            display: none;
        }
        
        .test-result.success {
            background: rgba(34, 197, 94, 0.15);
            border: 1px solid rgba(34, 197, 94, 0.3);
            color: #86efac;
        }
        
        .test-result.error {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
        }
        
        .test-result.warning {
            background: rgba(245, 158, 11, 0.15);
            border: 1px solid rgba(245, 158, 11, 0.3);
            color: #fcd34d;
        }
        
        /* Status Indicator */
        .status {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        .status-success { background: rgba(34, 197, 94, 0.2); color: #86efac; }
        .status-error { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
        .status-pending { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }
        
        /* Collapsible Section */
        .collapsible {
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            margin-bottom: 1rem;
            overflow: hidden;
        }
        
        .collapsible-header {
            padding: 1rem;
            background: rgba(0, 0, 0, 0.2);
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .collapsible-header:hover { background: rgba(0, 0, 0, 0.3); }
        
        .collapsible-content {
            padding: 1rem;
            display: none;
        }
        
        .collapsible.open .collapsible-content { display: block; }
        .collapsible.open .collapsible-arrow { transform: rotate(180deg); }
        
        /* Success Page */
        .success-page {
            text-align: center;
            padding: 3rem 2rem;
        }
        
        .success-icon {
            width: 5rem;
            height: 5rem;
            background: var(--success);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.5rem;
            margin: 0 auto 1.5rem;
        }
        
        .checklist {
            text-align: left;
            margin: 2rem auto;
            max-width: 400px;
        }
        
        .checklist li {
            padding: 0.75rem 0;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
        
        .checklist li:last-child { border-bottom: none; }
        
        /* Loading Spinner */
        .spinner {
            width: 1.25rem;
            height: 1.25rem;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* Alert */
        .alert {
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1rem;
        }
        
        .alert-info {
            background: rgba(59, 130, 246, 0.15);
            border: 1px solid rgba(59, 130, 246, 0.3);
            color: #93c5fd;
        }
        
        .alert-warning {
            background: rgba(245, 158, 11, 0.15);
            border: 1px solid rgba(245, 158, 11, 0.3);
            color: #fcd34d;
        }
        
        /* Environment Check */
        .env-check {
            display: grid;
            gap: 0.5rem;
        }
        
        .env-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
            border-bottom: 1px solid var(--border);
        }
        
        .env-item:last-child { border-bottom: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">📧</div>
            <h1>TempMail Installation</h1>
            <p>Self-Hosted Setup Wizard</p>
        </div>
        
        <div class="steps">
            <?php for ($i = 1; $i <= $maxSteps; $i++): ?>
            <div class="step <?= $i < $step ? 'done' : ($i === $step ? 'active' : '') ?>">
                <?= $i < $step ? '✓' : $i ?>
            </div>
            <?php endfor; ?>
        </div>
        
        <?php if ($step === 1): ?>
        <!-- Step 1: Environment Check & Database -->
        <div class="card">
            <h2 class="card-title">🔍 Environment Check</h2>
            <p class="card-description">Checking your server requirements...</p>
            
            <div class="env-check">
                <?php
                $envChecks = [
                    'PHP Version' => [version_compare(PHP_VERSION, '8.0.0', '>='), PHP_VERSION . ' (requires 8.0+)'],
                    'PDO MySQL' => [extension_loaded('pdo_mysql'), extension_loaded('pdo_mysql') ? 'Installed' : 'Missing'],
                    'JSON Extension' => [extension_loaded('json'), extension_loaded('json') ? 'Installed' : 'Missing'],
                    'OpenSSL' => [extension_loaded('openssl'), extension_loaded('openssl') ? 'Installed' : 'Missing'],
                    'IMAP Extension' => [extension_loaded('imap'), extension_loaded('imap') ? 'Installed' : 'Optional - for IMAP polling'],
                    'Config Writable' => [is_writable(__DIR__ . '/api'), is_writable(__DIR__ . '/api') ? 'Yes' : 'No - fix permissions'],
                ];
                
                $allPassed = true;
                foreach ($envChecks as $check => $result):
                    if (!$result[0] && $check !== 'IMAP Extension') $allPassed = false;
                ?>
                <div class="env-item">
                    <span><?= $check ?></span>
                    <span class="status <?= $result[0] ? 'status-success' : ($check === 'IMAP Extension' ? 'status-pending' : 'status-error') ?>">
                        <?= $result[1] ?>
                    </span>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        
        <div class="card">
            <h2 class="card-title">🗄️ Database Configuration</h2>
            <p class="card-description">Enter your MySQL database credentials from cPanel</p>
            
            <form id="step1Form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="db_host">Database Host</label>
                        <input type="text" id="db_host" name="db_host" value="localhost" required>
                        <span class="hint">Usually 'localhost' for cPanel hosting</span>
                    </div>
                    <div class="form-group">
                        <label for="db_port">Port</label>
                        <input type="number" id="db_port" name="db_port" value="3306">
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="db_name">Database Name</label>
                    <input type="text" id="db_name" name="db_name" placeholder="username_tempmail" required>
                    <span class="hint">Format: cpanelusername_databasename</span>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="db_user">Database Username</label>
                        <input type="text" id="db_user" name="db_user" placeholder="username_dbuser" required>
                    </div>
                    <div class="form-group">
                        <label for="db_pass">Database Password</label>
                        <input type="password" id="db_pass" name="db_pass">
                    </div>
                </div>
                
                <div id="dbTestResult" class="test-result"></div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="testDatabase()">
                        <span id="dbTestText">Test Connection</span>
                    </button>
                    <button type="submit" class="btn btn-primary" id="step1Next" disabled>
                        Next →
                    </button>
                </div>
            </form>
        </div>
        
        <?php elseif ($step === 2): ?>
        <!-- Step 2: Site & Admin Configuration -->
        <div class="card">
            <h2 class="card-title">🌐 Site Configuration</h2>
            <p class="card-description">Configure your TempMail site settings</p>
            
            <form id="step2Form">
                <div class="form-group">
                    <label for="site_name">Site Name</label>
                    <input type="text" id="site_name" name="site_name" placeholder="TempMail" value="TempMail" required>
                </div>
                
                <div class="form-group">
                    <label for="site_url">Site URL</label>
                    <input type="url" id="site_url" name="site_url" placeholder="https://tempmail.yourdomain.com" required>
                    <span class="hint">Full URL without trailing slash (e.g., https://mail.example.com)</span>
                </div>
                
                <div class="form-group">
                    <label for="domain">Email Domain</label>
                    <input type="text" id="domain" name="domain" placeholder="tempmail.com" required>
                    <span class="hint">Domain for temporary emails (e.g., user@tempmail.com)</span>
                </div>
                
                <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" id="skip_dns" name="skip_dns" style="width: auto;">
                    <label for="skip_dns" style="margin-bottom: 0; font-weight: normal;">
                        Skip DNS verification (use if hosting domain on same server)
                    </label>
                </div>
                <span class="hint" style="display: block; margin-top: -0.5rem; margin-bottom: 1rem;">
                    Enable this if DNS lookups fail because your domain is hosted on the same server.
                </span>
                
                <div id="domainTestResult" class="test-result"></div>
        </div>
        
        <div class="card">
            <h2 class="card-title">👤 Admin Account</h2>
            <p class="card-description">Create your administrator account</p>
            
                <div class="form-group">
                    <label for="admin_email">Admin Email</label>
                    <input type="email" id="admin_email" name="admin_email" placeholder="admin@example.com" required>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="admin_pass">Password</label>
                        <input type="password" id="admin_pass" name="admin_pass" minlength="8" required>
                        <span class="hint">Minimum 8 characters</span>
                    </div>
                    <div class="form-group">
                        <label for="admin_pass_confirm">Confirm Password</label>
                        <input type="password" id="admin_pass_confirm" name="admin_pass_confirm" required>
                    </div>
                </div>
                
                <div class="btn-group">
                    <a href="?step=1" class="btn btn-secondary">← Back</a>
                    <button type="button" class="btn btn-secondary" onclick="verifyDomain()">Verify Domain</button>
                    <button type="submit" class="btn btn-primary">Next →</button>
                </div>
            </form>
        </div>
        
        <?php elseif ($step === 3): ?>
        <!-- Step 3: SMTP Configuration -->
        <div class="card">
            <h2 class="card-title">📤 SMTP Configuration (Optional)</h2>
            <p class="card-description">For sending verification emails and notifications</p>
            
            <div class="alert alert-info">
                💡 SMTP is optional but recommended for sending email verification and password reset emails.
            </div>
            
            <form id="step3Form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="smtp_host">SMTP Host</label>
                        <input type="text" id="smtp_host" name="smtp_host" placeholder="mail.yourdomain.com">
                    </div>
                    <div class="form-group">
                        <label for="smtp_port">Port</label>
                        <select id="smtp_port" name="smtp_port">
                            <option value="587">587 (TLS - Recommended)</option>
                            <option value="465">465 (SSL)</option>
                            <option value="25">25 (Unencrypted)</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="smtp_user">SMTP Username</label>
                        <input type="text" id="smtp_user" name="smtp_user" placeholder="noreply@yourdomain.com">
                    </div>
                    <div class="form-group">
                        <label for="smtp_pass">SMTP Password</label>
                        <input type="password" id="smtp_pass" name="smtp_pass">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="smtp_encryption">Encryption</label>
                        <select id="smtp_encryption" name="smtp_encryption">
                            <option value="tls">TLS</option>
                            <option value="ssl">SSL</option>
                            <option value="">None</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="smtp_from">From Email</label>
                        <input type="email" id="smtp_from" name="smtp_from" placeholder="noreply@yourdomain.com">
                    </div>
                </div>
                
                <div id="smtpTestResult" class="test-result"></div>
                
                <div class="btn-group">
                    <a href="?step=2" class="btn btn-secondary">← Back</a>
                    <button type="button" class="btn btn-secondary" onclick="testSmtp()">Test SMTP</button>
                    <button type="submit" class="btn btn-primary">Next →</button>
                </div>
            </form>
        </div>
        
        <?php elseif ($step === 4): ?>
        <!-- Step 4: IMAP Configuration -->
        <div class="card">
            <h2 class="card-title">📥 IMAP Configuration (Optional)</h2>
            <p class="card-description">For polling emails from your mailbox</p>
            
            <div class="alert alert-info">
                💡 Use IMAP if your email provider doesn't support webhooks. 
                Webhooks are recommended for instant email delivery.
            </div>
            
            <?php if (!extension_loaded('imap')): ?>
            <div class="alert alert-warning">
                ⚠️ PHP IMAP extension is not installed. Contact your hosting provider to enable it, or use webhooks instead.
            </div>
            <?php endif; ?>
            
            <form id="step4Form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="imap_host">IMAP Host</label>
                        <input type="text" id="imap_host" name="imap_host" placeholder="mail.yourdomain.com">
                    </div>
                    <div class="form-group">
                        <label for="imap_port">Port</label>
                        <select id="imap_port" name="imap_port">
                            <option value="993">993 (SSL - Recommended)</option>
                            <option value="143">143 (TLS/None)</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="imap_user">IMAP Username</label>
                        <input type="text" id="imap_user" name="imap_user" placeholder="catchall@yourdomain.com">
                        <span class="hint">Use a catch-all email account</span>
                    </div>
                    <div class="form-group">
                        <label for="imap_pass">IMAP Password</label>
                        <input type="password" id="imap_pass" name="imap_pass">
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="imap_encryption">Encryption</label>
                    <select id="imap_encryption" name="imap_encryption">
                        <option value="ssl">SSL</option>
                        <option value="tls">TLS</option>
                        <option value="">None</option>
                    </select>
                </div>
                
                <div id="imapTestResult" class="test-result"></div>
                
                <div class="btn-group">
                    <a href="?step=3" class="btn btn-secondary">← Back</a>
                    <button type="button" class="btn btn-secondary" onclick="testImap()" <?= !extension_loaded('imap') ? 'disabled' : '' ?>>
                        Test IMAP
                    </button>
                    <button type="submit" class="btn btn-primary">Next →</button>
                </div>
            </form>
        </div>
        
        <?php elseif ($step === 5): ?>
        <!-- Step 5: Review & Install -->
        <div class="card">
            <h2 class="card-title">✅ Review & Install</h2>
            <p class="card-description">Review your configuration before installing</p>
            
            <?php
            $install = $_SESSION['install'] ?? [];
            ?>
            
            <div class="collapsible open">
                <div class="collapsible-header" onclick="toggleCollapsible(this)">
                    <span>🗄️ Database</span>
                    <span class="collapsible-arrow">▼</span>
                </div>
                <div class="collapsible-content">
                    <div class="env-check">
                        <div class="env-item">
                            <span>Host</span>
                            <span><?= htmlspecialchars($install['db_host'] ?? 'localhost') ?>:<?= htmlspecialchars($install['db_port'] ?? '3306') ?></span>
                        </div>
                        <div class="env-item">
                            <span>Database</span>
                            <span><?= htmlspecialchars($install['db_name'] ?? '') ?></span>
                        </div>
                        <div class="env-item">
                            <span>Username</span>
                            <span><?= htmlspecialchars($install['db_user'] ?? '') ?></span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="collapsible open">
                <div class="collapsible-header" onclick="toggleCollapsible(this)">
                    <span>🌐 Site & Domain</span>
                    <span class="collapsible-arrow">▼</span>
                </div>
                <div class="collapsible-content">
                    <div class="env-check">
                        <div class="env-item">
                            <span>Site Name</span>
                            <span><?= htmlspecialchars($install['site_name'] ?? 'TempMail') ?></span>
                        </div>
                        <div class="env-item">
                            <span>Site URL</span>
                            <span><?= htmlspecialchars($install['site_url'] ?? '') ?></span>
                        </div>
                        <div class="env-item">
                            <span>Email Domain</span>
                            <span><?= htmlspecialchars($install['domain'] ?? '') ?></span>
                        </div>
                        <div class="env-item">
                            <span>Admin Email</span>
                            <span><?= htmlspecialchars($install['admin_email'] ?? '') ?></span>
                        </div>
                    </div>
                </div>
            </div>
            
            <?php if (!empty($install['smtp_host'])): ?>
            <div class="collapsible">
                <div class="collapsible-header" onclick="toggleCollapsible(this)">
                    <span>📤 SMTP</span>
                    <span class="status status-success">Configured</span>
                </div>
                <div class="collapsible-content">
                    <div class="env-check">
                        <div class="env-item">
                            <span>Host</span>
                            <span><?= htmlspecialchars($install['smtp_host']) ?>:<?= htmlspecialchars($install['smtp_port'] ?? '587') ?></span>
                        </div>
                    </div>
                </div>
            </div>
            <?php endif; ?>
            
            <?php if (!empty($install['imap_host'])): ?>
            <div class="collapsible">
                <div class="collapsible-header" onclick="toggleCollapsible(this)">
                    <span>📥 IMAP</span>
                    <span class="status status-success">Configured</span>
                </div>
                <div class="collapsible-content">
                    <div class="env-check">
                        <div class="env-item">
                            <span>Host</span>
                            <span><?= htmlspecialchars($install['imap_host']) ?>:<?= htmlspecialchars($install['imap_port'] ?? '993') ?></span>
                        </div>
                    </div>
                </div>
            </div>
            <?php endif; ?>
            
            <div id="installResult" class="test-result"></div>
            
            <div class="btn-group">
                <a href="?step=4" class="btn btn-secondary">← Back</a>
                <button type="button" class="btn btn-primary btn-success" onclick="runInstall()" id="installBtn">
                    <span id="installText">🚀 Install Now</span>
                </button>
            </div>
        </div>
        
        <?php elseif (isset($_SESSION['install_success']) && $_SESSION['install_success']): ?>
        <!-- Success Page -->
        <div class="card success-page">
            <div class="success-icon">✓</div>
            <h2>Installation Complete!</h2>
            <p style="color: var(--text-muted);">Your TempMail application has been successfully installed.</p>
            
            <ul class="checklist">
                <li><span style="color: var(--success);">✓</span> Database tables created</li>
                <li><span style="color: var(--success);">✓</span> Admin account created</li>
                <li><span style="color: var(--success);">✓</span> Configuration saved</li>
                <li><span style="color: var(--success);">✓</span> Domain configured</li>
                <li><span style="color: var(--success);">✓</span> Installation locked</li>
            </ul>
            
            <div class="alert alert-warning" style="text-align: left; margin-top: 2rem;">
                <strong>Next Steps:</strong><br>
                1. Set up webhooks with your email provider (see WEBHOOK-SETUP.md)<br>
                2. Or configure IMAP polling in Admin Panel<br>
                3. Set up a cron job for cleanup tasks
            </div>
            
            <div class="btn-group" style="justify-content: center;">
                <a href="/" class="btn btn-primary">Go to Homepage</a>
                <a href="/admin" class="btn btn-secondary">Admin Panel</a>
            </div>
        </div>
        <?php 
        // Clear success flag
        unset($_SESSION['install_success']);
        ?>
        <?php endif; ?>
    </div>
    
    <script>
    // Store form data in session between steps
    const installData = <?= json_encode($_SESSION['install'] ?? []) ?>;
    
async function postAjax(action, data = {}, options = {}) {
        const { timeoutMs = 20000 } = options;

        const formData = new FormData();
        formData.append('ajax_action', action);

        for (const [key, value] of Object.entries(data)) {
            formData.append(key, value);
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch('', {
                method: 'POST',
                body: formData,
                signal: controller.signal,
            });
            return await response.json();
        } catch (err) {
            const message = err?.name === 'AbortError'
                ? `Request timed out after ${Math.round(timeoutMs / 1000)}s. Please try again.`
                : (err?.message || 'Network error. Please try again.');
            return { success: false, error: message };
        } finally {
            clearTimeout(timer);
        }
    }
    
    function showResult(elementId, result) {
        const el = document.getElementById(elementId);
        el.style.display = 'block';
        el.className = 'test-result ' + (result.success ? 'success' : 'error');
        
        let html = result.success ? '✅ ' : '❌ ';
        html += result.message || result.error;
        
        if (result.details) {
            html += '<br><small style="opacity: 0.8;">';
            html += Object.entries(result.details)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' | ');
            html += '</small>';
        }
        
        el.innerHTML = html;
        return result.success;
    }
    
    async function testDatabase() {
        const btn = document.querySelector('[onclick="testDatabase()"]');
        const text = document.getElementById('dbTestText');
        
        btn.disabled = true;
        text.innerHTML = '<span class="spinner"></span> Testing...';
        
        const data = {
            db_host: document.getElementById('db_host').value,
            db_port: document.getElementById('db_port').value,
            db_name: document.getElementById('db_name').value,
            db_user: document.getElementById('db_user').value,
            db_pass: document.getElementById('db_pass').value,
        };
        
        const result = await postAjax('test_database', data);
        const success = showResult('dbTestResult', result);
        
        document.getElementById('step1Next').disabled = !success;
        
        btn.disabled = false;
        text.textContent = 'Test Connection';
    }
    
    async function verifyDomain() {
        const domain = document.getElementById('domain').value;
        const skipDns = document.getElementById('skip_dns')?.checked ? 'true' : 'false';
        const result = await postAjax('verify_domain', { domain, skip_dns: skipDns });
        
        // Show result with appropriate styling for skipped check
        const el = document.getElementById('domainTestResult');
        el.style.display = 'block';
        
        if (result.success) {
            if (result.checks?.skipped) {
                el.className = 'test-result warning';
                el.innerHTML = '⚠️ ' + result.message + '<br><small>DNS verification was skipped. Make sure your domain is properly configured.</small>';
            } else {
                el.className = 'test-result success';
                let html = '✅ ' + result.message;
                if (result.checks?.same_server_detected) {
                    html += '<br><small>Same-server hosting detected - domain accessible locally.</small>';
                }
                el.innerHTML = html;
            }
        } else {
            el.className = 'test-result error';
            el.innerHTML = '❌ ' + (result.message || result.error);
        }
    }
    
    async function testSmtp() {
        const btn = document.querySelector('[onclick="testSmtp()"]');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Testing...';
        
        const data = {
            smtp_host: document.getElementById('smtp_host').value,
            smtp_port: document.getElementById('smtp_port').value,
            smtp_user: document.getElementById('smtp_user').value,
            smtp_pass: document.getElementById('smtp_pass').value,
            smtp_encryption: document.getElementById('smtp_encryption').value,
        };
        
        const result = await postAjax('test_smtp', data);
        showResult('smtpTestResult', result);
        
        btn.disabled = false;
        btn.textContent = 'Test SMTP';
    }
    
    async function testImap() {
        const btn = document.querySelector('[onclick="testImap()"]');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Testing...';
        
        const data = {
            imap_host: document.getElementById('imap_host').value,
            imap_port: document.getElementById('imap_port').value,
            imap_user: document.getElementById('imap_user').value,
            imap_pass: document.getElementById('imap_pass').value,
            imap_encryption: document.getElementById('imap_encryption').value,
        };
        
        const result = await postAjax('test_imap', data);
        showResult('imapTestResult', result);
        
        btn.disabled = false;
        btn.textContent = 'Test IMAP';
    }
    
async function runInstall() {
        const btn = document.getElementById('installBtn');
        const text = document.getElementById('installText');

        btn.disabled = true;
        text.innerHTML = '<span class="spinner"></span> Installing...';

        // Schema creation can take time on shared hosting.
        const result = await postAjax('run_installation', installData, { timeoutMs: 300000 });

        if (result.success) {
            showResult('installResult', result);
            setTimeout(() => {
                window.location.href = result.redirect || '/';
            }, 2000);
        } else {
            showResult('installResult', result);
            btn.disabled = false;
            text.textContent = '🚀 Install Now';
        }
    }
    
    function toggleCollapsible(header) {
        header.parentElement.classList.toggle('open');
    }
    
    // Form submission handlers
    document.getElementById('step1Form')?.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Store in session via hidden form
        const formData = new FormData(this);
        formData.append('save_step', '1');
        
        fetch('', {
            method: 'POST',
            body: formData
        }).then(() => {
            // Store locally and navigate
            const data = Object.fromEntries(formData);
            sessionStorage.setItem('install_step1', JSON.stringify(data));
            window.location.href = '?step=2';
        });
    });
    
    document.getElementById('step2Form')?.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const pass = document.getElementById('admin_pass').value;
        const confirm = document.getElementById('admin_pass_confirm').value;
        
        if (pass !== confirm) {
            alert('Passwords do not match!');
            return;
        }
        
        if (pass.length < 8) {
            alert('Password must be at least 8 characters!');
            return;
        }
        
        const formData = new FormData(this);
        formData.append('save_step', '2');
        
        fetch('', { method: 'POST', body: formData }).then(() => {
            window.location.href = '?step=3';
        });
    });
    
    document.getElementById('step3Form')?.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        formData.append('save_step', '3');
        
        fetch('', { method: 'POST', body: formData }).then(() => {
            window.location.href = '?step=4';
        });
    });
    
    document.getElementById('step4Form')?.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        formData.append('save_step', '4');
        
        fetch('', { method: 'POST', body: formData }).then(() => {
            window.location.href = '?step=5';
        });
    });
    </script>
    
    <?php
    // Handle saving step data
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['save_step'])) {
        $step = (int)$_POST['save_step'];
        
        if (!isset($_SESSION['install'])) {
            $_SESSION['install'] = [];
        }
        
        switch ($step) {
            case 1:
                $_SESSION['install']['db_host'] = $_POST['db_host'] ?? 'localhost';
                $_SESSION['install']['db_port'] = $_POST['db_port'] ?? 3306;
                $_SESSION['install']['db_name'] = $_POST['db_name'] ?? '';
                $_SESSION['install']['db_user'] = $_POST['db_user'] ?? '';
                $_SESSION['install']['db_pass'] = $_POST['db_pass'] ?? '';
                break;
                
            case 2:
                $_SESSION['install']['site_name'] = $_POST['site_name'] ?? 'TempMail';
                $_SESSION['install']['site_url'] = $_POST['site_url'] ?? '';
                $_SESSION['install']['domain'] = $_POST['domain'] ?? '';
                $_SESSION['install']['admin_email'] = $_POST['admin_email'] ?? '';
                $_SESSION['install']['admin_pass'] = $_POST['admin_pass'] ?? '';
                break;
                
            case 3:
                $_SESSION['install']['smtp_host'] = $_POST['smtp_host'] ?? '';
                $_SESSION['install']['smtp_port'] = $_POST['smtp_port'] ?? 587;
                $_SESSION['install']['smtp_user'] = $_POST['smtp_user'] ?? '';
                $_SESSION['install']['smtp_pass'] = $_POST['smtp_pass'] ?? '';
                $_SESSION['install']['smtp_encryption'] = $_POST['smtp_encryption'] ?? 'tls';
                $_SESSION['install']['smtp_from'] = $_POST['smtp_from'] ?? '';
                break;
                
            case 4:
                $_SESSION['install']['imap_host'] = $_POST['imap_host'] ?? '';
                $_SESSION['install']['imap_port'] = $_POST['imap_port'] ?? 993;
                $_SESSION['install']['imap_user'] = $_POST['imap_user'] ?? '';
                $_SESSION['install']['imap_pass'] = $_POST['imap_pass'] ?? '';
                $_SESSION['install']['imap_encryption'] = $_POST['imap_encryption'] ?? 'ssl';
                break;
        }
    }
    ?>
</body>
</html>
