<?php
/**
 * TempMail System Requirements Checker
 * 
 * Run this BEFORE installation to verify your server meets all requirements.
 * DELETE THIS FILE AFTER INSTALLATION!
 */

header('Content-Type: text/html; charset=utf-8');

// Requirements configuration
$requirements = [
    'php' => [
        'name' => 'PHP',
        'checks' => [
            [
                'name' => 'PHP Version',
                'required' => '8.0.0',
                'current' => phpversion(),
                'check' => fn() => version_compare(phpversion(), '8.0.0', '>='),
                'critical' => true,
                'help' => 'Contact your hosting provider to upgrade PHP'
            ],
            [
                'name' => 'Memory Limit',
                'required' => '128M',
                'current' => ini_get('memory_limit'),
                'check' => fn() => intval(ini_get('memory_limit')) >= 128 || ini_get('memory_limit') === '-1',
                'critical' => false,
                'help' => 'Add "memory_limit = 128M" to php.ini'
            ],
            [
                'name' => 'Max Execution Time',
                'required' => '30s',
                'current' => ini_get('max_execution_time') . 's',
                'check' => fn() => intval(ini_get('max_execution_time')) >= 30 || ini_get('max_execution_time') === '0',
                'critical' => false,
                'help' => 'Add "max_execution_time = 60" to php.ini'
            ],
            [
                'name' => 'Upload Max Filesize',
                'required' => '10M',
                'current' => ini_get('upload_max_filesize'),
                'check' => fn() => intval(ini_get('upload_max_filesize')) >= 10,
                'critical' => false,
                'help' => 'Add "upload_max_filesize = 10M" to php.ini'
            ],
            [
                'name' => 'Post Max Size',
                'required' => '10M',
                'current' => ini_get('post_max_size'),
                'check' => fn() => intval(ini_get('post_max_size')) >= 10,
                'critical' => false,
                'help' => 'Add "post_max_size = 10M" to php.ini'
            ],
        ]
    ],
    'extensions_required' => [
        'name' => 'Required Extensions',
        'checks' => [
            [
                'name' => 'PDO',
                'description' => 'Database abstraction layer',
                'check' => fn() => extension_loaded('pdo'),
                'critical' => true,
                'help' => 'Install php-pdo package'
            ],
            [
                'name' => 'PDO MySQL',
                'description' => 'MySQL database driver',
                'check' => fn() => extension_loaded('pdo_mysql'),
                'critical' => true,
                'help' => 'Install php-mysql package'
            ],
            [
                'name' => 'JSON',
                'description' => 'JSON encoding/decoding',
                'check' => fn() => extension_loaded('json'),
                'critical' => true,
                'help' => 'Usually included by default in PHP 8+'
            ],
            [
                'name' => 'OpenSSL',
                'description' => 'Encryption and SSL support',
                'check' => fn() => extension_loaded('openssl'),
                'critical' => true,
                'help' => 'Install php-openssl package'
            ],
            [
                'name' => 'Mbstring',
                'description' => 'Multi-byte string support',
                'check' => fn() => extension_loaded('mbstring'),
                'critical' => true,
                'help' => 'Install php-mbstring package'
            ],
            [
                'name' => 'cURL',
                'description' => 'HTTP requests',
                'check' => fn() => extension_loaded('curl'),
                'critical' => true,
                'help' => 'Install php-curl package'
            ],
        ]
    ],
    'extensions_optional' => [
        'name' => 'Optional Extensions',
        'checks' => [
            [
                'name' => 'IMAP',
                'description' => 'Email fetching via IMAP',
                'check' => fn() => extension_loaded('imap'),
                'critical' => false,
                'help' => 'Install php-imap package for email receiving'
            ],
            [
                'name' => 'GD',
                'description' => 'Image processing',
                'check' => fn() => extension_loaded('gd'),
                'critical' => false,
                'help' => 'Install php-gd package for avatar processing'
            ],
            [
                'name' => 'Zip',
                'description' => 'ZIP archive support',
                'check' => fn() => extension_loaded('zip'),
                'critical' => false,
                'help' => 'Install php-zip package for backup exports'
            ],
            [
                'name' => 'Fileinfo',
                'description' => 'File type detection',
                'check' => fn() => extension_loaded('fileinfo'),
                'critical' => false,
                'help' => 'Install php-fileinfo package'
            ],
            [
                'name' => 'Intl',
                'description' => 'Internationalization',
                'check' => fn() => extension_loaded('intl'),
                'critical' => false,
                'help' => 'Install php-intl package for better i18n'
            ],
        ]
    ],
    'filesystem' => [
        'name' => 'Filesystem',
        'checks' => [
            [
                'name' => 'Config Writable',
                'description' => 'Can create config.php',
                'check' => fn() => is_writable(__DIR__),
                'critical' => true,
                'help' => 'Set directory permissions to 755'
            ],
            [
                'name' => 'Storage Directory',
                'description' => 'Storage folder exists/creatable',
                'check' => fn() => is_dir(__DIR__ . '/storage') || is_writable(__DIR__),
                'critical' => true,
                'help' => 'Create storage/ folder with 755 permissions'
            ],
            [
                'name' => 'Schema File',
                'description' => 'Database schema exists',
                'check' => fn() => file_exists(__DIR__ . '/schema.sql'),
                'critical' => true,
                'help' => 'Ensure schema.sql is uploaded'
            ],
        ]
    ],
    'server' => [
        'name' => 'Server Configuration',
        'checks' => [
            [
                'name' => 'HTTPS',
                'description' => 'Secure connection',
                'check' => fn() => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || 
                                   (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ||
                                   (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] === '443'),
                'critical' => false,
                'help' => 'Enable SSL certificate (required for production)'
            ],
            [
                'name' => 'mod_rewrite',
                'description' => 'URL rewriting',
                'check' => fn() => function_exists('apache_get_modules') ? in_array('mod_rewrite', apache_get_modules()) : true,
                'critical' => false,
                'help' => 'Enable mod_rewrite in Apache'
            ],
            [
                'name' => '.htaccess Support',
                'description' => 'Apache configuration',
                'check' => fn() => file_exists(__DIR__ . '/.htaccess'),
                'critical' => false,
                'help' => 'Ensure .htaccess file is uploaded'
            ],
        ]
    ],
    'functions' => [
        'name' => 'Required Functions',
        'checks' => [
            [
                'name' => 'random_bytes',
                'description' => 'Secure random generation',
                'check' => fn() => function_exists('random_bytes'),
                'critical' => true,
                'help' => 'Update PHP to 7.0+'
            ],
            [
                'name' => 'password_hash',
                'description' => 'Password hashing',
                'check' => fn() => function_exists('password_hash'),
                'critical' => true,
                'help' => 'Update PHP to 5.5+'
            ],
            [
                'name' => 'hash_equals',
                'description' => 'Timing-safe comparison',
                'check' => fn() => function_exists('hash_equals'),
                'critical' => true,
                'help' => 'Update PHP to 5.6+'
            ],
            [
                'name' => 'mail',
                'description' => 'PHP mail function',
                'check' => fn() => function_exists('mail'),
                'critical' => false,
                'help' => 'Not required if using SMTP'
            ],
        ]
    ]
];

// Run all checks
$results = [];
$totalPassed = 0;
$totalFailed = 0;
$criticalFailed = 0;

foreach ($requirements as $category => $categoryData) {
    $results[$category] = [
        'name' => $categoryData['name'],
        'checks' => []
    ];
    
    foreach ($categoryData['checks'] as $check) {
        $passed = $check['check']();
        
        $results[$category]['checks'][] = [
            'name' => $check['name'],
            'description' => $check['description'] ?? '',
            'required' => $check['required'] ?? null,
            'current' => $check['current'] ?? null,
            'passed' => $passed,
            'critical' => $check['critical'],
            'help' => $check['help']
        ];
        
        if ($passed) {
            $totalPassed++;
        } else {
            $totalFailed++;
            if ($check['critical']) {
                $criticalFailed++;
            }
        }
    }
}

$totalChecks = $totalPassed + $totalFailed;
$canInstall = $criticalFailed === 0;
$score = round(($totalPassed / $totalChecks) * 100);

// Server info
$serverInfo = [
    'PHP Version' => phpversion(),
    'Server Software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
    'Server OS' => PHP_OS,
    'Server Time' => date('Y-m-d H:i:s T'),
    'Document Root' => $_SERVER['DOCUMENT_ROOT'] ?? 'Unknown',
    'Current Path' => __DIR__,
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TempMail - System Requirements Check</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            padding: 40px 20px;
            color: #e4e4e7;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
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
        .score-card {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 30px;
            text-align: center;
        }
        .score {
            font-size: 64px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .score.pass { color: #10b981; }
        .score.warn { color: #f59e0b; }
        .score.fail { color: #ef4444; }
        .status-badge {
            display: inline-block;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: 600;
            margin-top: 10px;
        }
        .status-badge.ready {
            background: rgba(16, 185, 129, 0.2);
            color: #6ee7b7;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .status-badge.not-ready {
            background: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .summary {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin-top: 20px;
            flex-wrap: wrap;
        }
        .summary-item {
            text-align: center;
        }
        .summary-value {
            font-size: 24px;
            font-weight: bold;
        }
        .summary-label {
            font-size: 12px;
            color: #a1a1aa;
        }
        .category {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 20px;
        }
        .category h2 {
            font-size: 18px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .category-badge {
            font-size: 12px;
            padding: 4px 10px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.1);
        }
        .check-item {
            display: flex;
            align-items: flex-start;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .check-item:last-child {
            border-bottom: none;
        }
        .check-icon {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            flex-shrink: 0;
            font-size: 14px;
        }
        .check-icon.pass {
            background: rgba(16, 185, 129, 0.2);
            color: #6ee7b7;
        }
        .check-icon.fail {
            background: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
        }
        .check-icon.warn {
            background: rgba(245, 158, 11, 0.2);
            color: #fcd34d;
        }
        .check-content {
            flex: 1;
        }
        .check-name {
            font-weight: 500;
            margin-bottom: 2px;
        }
        .check-description {
            font-size: 13px;
            color: #a1a1aa;
        }
        .check-values {
            display: flex;
            gap: 15px;
            margin-top: 6px;
            font-size: 12px;
        }
        .check-values span {
            padding: 2px 8px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
        }
        .check-help {
            margin-top: 8px;
            font-size: 12px;
            color: #fcd34d;
            background: rgba(245, 158, 11, 0.1);
            padding: 8px 12px;
            border-radius: 6px;
            border-left: 3px solid #f59e0b;
        }
        .critical-badge {
            font-size: 10px;
            padding: 2px 6px;
            background: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
            border-radius: 4px;
            margin-left: 8px;
        }
        .server-info {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 24px;
            margin-top: 30px;
        }
        .server-info h2 {
            font-size: 18px;
            margin-bottom: 15px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
        }
        .info-item {
            background: rgba(0, 0, 0, 0.2);
            padding: 12px;
            border-radius: 8px;
        }
        .info-label {
            font-size: 11px;
            color: #a1a1aa;
            margin-bottom: 4px;
        }
        .info-value {
            font-size: 13px;
            font-family: monospace;
            word-break: break-all;
        }
        .actions {
            display: flex;
            gap: 15px;
            margin-top: 30px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .btn {
            padding: 14px 28px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            text-decoration: none;
            transition: transform 0.2s, box-shadow 0.2s;
            display: inline-block;
        }
        .btn:hover {
            transform: translateY(-2px);
        }
        .btn-primary {
            background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
            color: #fff;
            border: none;
        }
        .btn-primary:hover {
            box-shadow: 0 10px 20px -10px rgba(139, 92, 246, 0.5);
        }
        .btn-primary.disabled {
            opacity: 0.5;
            pointer-events: none;
        }
        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .refresh-note {
            text-align: center;
            margin-top: 20px;
            color: #71717a;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 System Requirements Check</h1>
        <p class="subtitle">Verify your server meets TempMail requirements</p>
        
        <div class="score-card">
            <div class="score <?php echo $score >= 80 ? 'pass' : ($score >= 50 ? 'warn' : 'fail'); ?>">
                <?php echo $score; ?>%
            </div>
            <div>
                <?php echo $totalPassed; ?> of <?php echo $totalChecks; ?> checks passed
            </div>
            <div class="status-badge <?php echo $canInstall ? 'ready' : 'not-ready'; ?>">
                <?php echo $canInstall ? '✓ Ready to Install' : '✗ Critical Requirements Missing'; ?>
            </div>
            
            <div class="summary">
                <div class="summary-item">
                    <div class="summary-value" style="color: #6ee7b7;"><?php echo $totalPassed; ?></div>
                    <div class="summary-label">Passed</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value" style="color: #fca5a5;"><?php echo $totalFailed; ?></div>
                    <div class="summary-label">Failed</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value" style="color: #fcd34d;"><?php echo $criticalFailed; ?></div>
                    <div class="summary-label">Critical</div>
                </div>
            </div>
        </div>
        
        <?php foreach ($results as $categoryKey => $category): ?>
        <div class="category">
            <h2>
                <?php echo htmlspecialchars($category['name']); ?>
                <span class="category-badge">
                    <?php 
                    $catPassed = count(array_filter($category['checks'], fn($c) => $c['passed']));
                    echo $catPassed . '/' . count($category['checks']);
                    ?>
                </span>
            </h2>
            
            <?php foreach ($category['checks'] as $check): ?>
            <div class="check-item">
                <div class="check-icon <?php echo $check['passed'] ? 'pass' : ($check['critical'] ? 'fail' : 'warn'); ?>">
                    <?php echo $check['passed'] ? '✓' : '✗'; ?>
                </div>
                <div class="check-content">
                    <div class="check-name">
                        <?php echo htmlspecialchars($check['name']); ?>
                        <?php if ($check['critical'] && !$check['passed']): ?>
                            <span class="critical-badge">CRITICAL</span>
                        <?php endif; ?>
                    </div>
                    <?php if ($check['description']): ?>
                    <div class="check-description"><?php echo htmlspecialchars($check['description']); ?></div>
                    <?php endif; ?>
                    
                    <?php if ($check['required'] || $check['current']): ?>
                    <div class="check-values">
                        <?php if ($check['required']): ?>
                        <span>Required: <?php echo htmlspecialchars($check['required']); ?></span>
                        <?php endif; ?>
                        <?php if ($check['current']): ?>
                        <span>Current: <?php echo htmlspecialchars($check['current']); ?></span>
                        <?php endif; ?>
                    </div>
                    <?php endif; ?>
                    
                    <?php if (!$check['passed'] && $check['help']): ?>
                    <div class="check-help">💡 <?php echo htmlspecialchars($check['help']); ?></div>
                    <?php endif; ?>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
        <?php endforeach; ?>
        
        <div class="server-info">
            <h2>📊 Server Information</h2>
            <div class="info-grid">
                <?php foreach ($serverInfo as $label => $value): ?>
                <div class="info-item">
                    <div class="info-label"><?php echo htmlspecialchars($label); ?></div>
                    <div class="info-value"><?php echo htmlspecialchars($value); ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        
        <div class="actions">
            <a href="?refresh=1" class="btn btn-secondary">🔄 Re-check</a>
            <a href="install.php" class="btn btn-primary <?php echo $canInstall ? '' : 'disabled'; ?>">
                <?php echo $canInstall ? '→ Continue to Installation' : '⚠ Fix Critical Issues First'; ?>
            </a>
        </div>
        
        <p class="refresh-note">
            Last checked: <?php echo date('Y-m-d H:i:s'); ?> • 
            <a href="?format=json" style="color: #8b5cf6;">View as JSON</a>
        </p>
    </div>
</body>
</html>
<?php
// JSON output option
if (isset($_GET['format']) && $_GET['format'] === 'json') {
    header('Content-Type: application/json');
    echo json_encode([
        'score' => $score,
        'can_install' => $canInstall,
        'passed' => $totalPassed,
        'failed' => $totalFailed,
        'critical_failed' => $criticalFailed,
        'results' => $results,
        'server_info' => $serverInfo,
        'checked_at' => date('c')
    ], JSON_PRETTY_PRINT);
    exit;
}
?>
