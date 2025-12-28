<?php
/**
 * Authentication Middleware
 * Handles user authentication, sessions, and permissions
 */

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/response.php';

class Auth {
    private static ?array $currentUser = null;
    
    /**
     * Hash password using bcrypt
     */
    public static function hashPassword(string $password): string {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    }
    
    /**
     * Verify password
     */
    public static function verifyPassword(string $password, string $hash): bool {
        return password_verify($password, $hash);
    }
    
    /**
     * Get current authenticated user
     */
    public static function getCurrentUser(): ?array {
        if (self::$currentUser !== null) {
            return self::$currentUser;
        }
        
        $token = JWT::extractFromHeader();
        
        if (!$token) {
            return null;
        }
        
        $payload = JWT::validateToken($token);
        
        if (!$payload) {
            return null;
        }
        
        // Fetch fresh user data
        $user = Database::fetchOne(
            "SELECT u.*, p.display_name, p.avatar_url, p.bio 
             FROM users u 
             LEFT JOIN profiles p ON p.user_id = u.id 
             WHERE u.id = ? AND u.is_active = 1",
            [$payload['sub']]
        );
        
        if ($user) {
            // Remove password from user data
            unset($user['password_hash']);
            self::$currentUser = $user;
        }
        
        return self::$currentUser;
    }
    
    /**
     * Require authentication
     */
    public static function requireAuth(): array {
        $user = self::getCurrentUser();
        
        if (!$user) {
            Response::unauthorized('Authentication required');
        }
        
        return $user;
    }
    
    /**
     * Require admin role
     */
    public static function requireAdmin(): array {
        $user = self::requireAuth();
        
        // Check user_roles table
        $role = Database::fetchOne(
            "SELECT * FROM user_roles WHERE user_id = ? AND role IN ('admin', 'super_admin')",
            [$user['id']]
        );
        
        if (!$role) {
            Response::forbidden('Admin access required');
        }
        
        return $user;
    }
    
    /**
     * Check if user is admin
     */
    public static function isAdmin(?array $user = null): bool {
        $user = $user ?? self::getCurrentUser();
        
        if (!$user) {
            return false;
        }
        
        $role = Database::fetchOne(
            "SELECT * FROM user_roles WHERE user_id = ? AND role IN ('admin', 'super_admin')",
            [$user['id']]
        );
        
        return $role !== null;
    }
    
    /**
     * Create user session
     */
    public static function createSession(array $user): string {
        $token = JWT::generateToken($user);
        $tokenId = bin2hex(random_bytes(16));
        
        // Store session in database
        Database::insert('sessions', [
            'id' => $tokenId,
            'user_id' => $user['id'],
            'token_hash' => hash('sha256', $token),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
            'expires_at' => date('Y-m-d H:i:s', time() + (24 * 3600)),
            'created_at' => date('Y-m-d H:i:s')
        ]);
        
        return $token;
    }
    
    /**
     * Invalidate session
     */
    public static function destroySession(): void {
        $token = JWT::extractFromHeader();
        
        if ($token) {
            $tokenHash = hash('sha256', $token);
            Database::delete('sessions', 'token_hash = ?', [$tokenHash]);
        }
    }
    
    /**
     * Check rate limit
     */
    public static function checkRateLimit(string $key, int $maxAttempts, int $windowMinutes): bool {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $identifier = $key . ':' . $ip;
        
        // Clean old entries
        Database::query(
            "DELETE FROM rate_limits WHERE expires_at < NOW()"
        );
        
        // Check current count
        $limit = Database::fetchOne(
            "SELECT * FROM rate_limits WHERE identifier = ?",
            [$identifier]
        );
        
        if (!$limit) {
            // First attempt
            Database::insert('rate_limits', [
                'identifier' => $identifier,
                'attempts' => 1,
                'expires_at' => date('Y-m-d H:i:s', time() + ($windowMinutes * 60))
            ]);
            return true;
        }
        
        if ($limit['attempts'] >= $maxAttempts) {
            return false;
        }
        
        // Increment attempts
        Database::update(
            'rate_limits',
            ['attempts' => $limit['attempts'] + 1],
            'identifier = ?',
            [$identifier]
        );
        
        return true;
    }
    
    /**
     * Validate email format
     */
    public static function validateEmail(string $email): bool {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }
    
    /**
     * Validate password strength
     */
    public static function validatePassword(string $password): array {
        $errors = [];
        
        if (strlen($password) < 8) {
            $errors[] = 'Password must be at least 8 characters';
        }
        
        if (!preg_match('/[A-Z]/', $password)) {
            $errors[] = 'Password must contain at least one uppercase letter';
        }
        
        if (!preg_match('/[a-z]/', $password)) {
            $errors[] = 'Password must contain at least one lowercase letter';
        }
        
        if (!preg_match('/[0-9]/', $password)) {
            $errors[] = 'Password must contain at least one number';
        }
        
        return $errors;
    }
    
    /**
     * Generate random token
     */
    public static function generateToken(int $length = 32): string {
        return bin2hex(random_bytes($length));
    }
    
    /**
     * Generate TOTP secret for 2FA
     */
    public static function generateTOTPSecret(): string {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $secret = '';
        
        for ($i = 0; $i < 16; $i++) {
            $secret .= $chars[random_int(0, 31)];
        }
        
        return $secret;
    }
    
    /**
     * Verify TOTP code
     */
    public static function verifyTOTP(string $secret, string $code): bool {
        $timeSlice = floor(time() / 30);
        
        // Check current and adjacent time slices
        for ($i = -1; $i <= 1; $i++) {
            $calculatedCode = self::calculateTOTP($secret, $timeSlice + $i);
            if (hash_equals($calculatedCode, $code)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Calculate TOTP code
     */
    private static function calculateTOTP(string $secret, int $timeSlice): string {
        $secretKey = self::base32Decode($secret);
        $time = pack('N*', 0) . pack('N*', $timeSlice);
        $hash = hash_hmac('sha1', $time, $secretKey, true);
        $offset = ord($hash[19]) & 0x0F;
        $code = (
            ((ord($hash[$offset]) & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) << 8) |
            (ord($hash[$offset + 3]) & 0xFF)
        ) % 1000000;
        
        return str_pad($code, 6, '0', STR_PAD_LEFT);
    }
    
    /**
     * Base32 decode
     */
    private static function base32Decode(string $input): string {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $output = '';
        $buffer = 0;
        $bitsLeft = 0;
        
        for ($i = 0; $i < strlen($input); $i++) {
            $val = strpos($chars, strtoupper($input[$i]));
            if ($val === false) continue;
            
            $buffer = ($buffer << 5) | $val;
            $bitsLeft += 5;
            
            if ($bitsLeft >= 8) {
                $bitsLeft -= 8;
                $output .= chr(($buffer >> $bitsLeft) & 0xFF);
            }
        }
        
        return $output;
    }
}
