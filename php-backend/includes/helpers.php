<?php
/**
 * Shared Helper Functions for PHP Backend
 */

/**
 * Generate a UUID v4
 */
function generateHelperUUID(): string {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

/**
 * Get authenticated user from JWT token (standalone version)
 * For use in pages that don't include index.php
 */
function getAuthUserStandalone(PDO $pdo, array $config): ?array {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    
    // Also check for session-based auth
    if (empty($authHeader) && isset($_SESSION['user_id'])) {
        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$_SESSION['user_id']]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }
    
    if (!preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
        return null;
    }
    
    $token = $matches[1];
    $secret = $config['jwt']['secret'] ?? (defined('JWT_SECRET') ? JWT_SECRET : '');
    
    if (empty($secret)) {
        return null;
    }
    
    try {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        
        $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
        
        if (!$payload || ($payload['exp'] ?? 0) < time()) {
            return null;
        }
        
        // Verify signature
        $signatureInput = $parts[0] . '.' . $parts[1];
        $expectedSignature = rtrim(strtr(base64_encode(hash_hmac('sha256', $signatureInput, $secret, true)), '+/', '-_'), '=');
        
        if (!hash_equals($expectedSignature, $parts[2])) {
            return null;
        }
        
        $userId = $payload['sub'] ?? $payload['user_id'] ?? null;
        
        if ($userId) {
            $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        }
        
        return null;
    } catch (Exception $e) {
        return null;
    }
}

/**
 * Check if user is admin (standalone version)
 */
function checkIsAdminStandalone(PDO $pdo, string $userId): bool {
    if (!$userId) return false;
    $stmt = $pdo->prepare("SELECT 1 FROM user_roles WHERE user_id = ? AND role IN ('admin', 'moderator')");
    $stmt->execute([$userId]);
    return (bool) $stmt->fetch();
}

/**
 * Get config array from either constants or file
 */
function getConfigArray(): array {
    // If constants are defined, build array from them
    if (defined('DB_HOST')) {
        return [
            'db' => [
                'host' => DB_HOST,
                'name' => DB_NAME,
                'user' => DB_USER,
                'pass' => DB_PASS,
                'charset' => 'utf8mb4'
            ],
            'jwt' => [
                'secret' => defined('JWT_SECRET') ? JWT_SECRET : '',
                'expiry' => defined('JWT_EXPIRY') ? JWT_EXPIRY : 604800
            ],
            'smtp' => [
                'host' => defined('SMTP_HOST') ? SMTP_HOST : '',
                'port' => defined('SMTP_PORT') ? SMTP_PORT : 587,
                'user' => defined('SMTP_USER') ? SMTP_USER : '',
                'pass' => defined('SMTP_PASS') ? SMTP_PASS : '',
                'from' => defined('SMTP_FROM') ? SMTP_FROM : ''
            ],
            'imap' => [
                'host' => defined('IMAP_HOST') ? IMAP_HOST : '',
                'port' => defined('IMAP_PORT') ? IMAP_PORT : 993,
                'user' => defined('IMAP_USER') ? IMAP_USER : '',
                'pass' => defined('IMAP_PASS') ? IMAP_PASS : ''
            ],
            'site_name' => defined('SITE_NAME') ? SITE_NAME : 'TempMail',
            'site_url' => defined('SITE_URL') ? SITE_URL : ''
        ];
    }
    
    // Load from config file
    $configPath = __DIR__ . '/../config.php';
    if (file_exists($configPath)) {
        $config = require $configPath;
        if (is_array($config)) {
            return $config;
        }
    }
    
    return [];
}

/**
 * Sanitize string for safe output
 */
function sanitizeString(string $str): string {
    return htmlspecialchars(trim($str), ENT_QUOTES, 'UTF-8');
}

/**
 * Log a message to a file
 */
function logToFile(string $message, string $level = 'INFO', string $logFile = 'app.log'): void {
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[$timestamp] [$level] $message\n";
    file_put_contents($logDir . '/' . $logFile, $logEntry, FILE_APPEND);
}
