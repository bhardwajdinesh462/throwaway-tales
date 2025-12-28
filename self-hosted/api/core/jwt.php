<?php
/**
 * JWT Token Handler
 * Lightweight JWT implementation for shared hosting
 */

class JWT {
    private static string $algorithm = 'HS256';
    
    /**
     * Encode payload to JWT token
     */
    public static function encode(array $payload, string $secret): string {
        $header = [
            'typ' => 'JWT',
            'alg' => self::$algorithm
        ];
        
        $headerEncoded = self::base64UrlEncode(json_encode($header));
        $payloadEncoded = self::base64UrlEncode(json_encode($payload));
        
        $signature = self::sign($headerEncoded . '.' . $payloadEncoded, $secret);
        $signatureEncoded = self::base64UrlEncode($signature);
        
        return $headerEncoded . '.' . $payloadEncoded . '.' . $signatureEncoded;
    }
    
    /**
     * Decode and validate JWT token
     */
    public static function decode(string $token, string $secret): ?array {
        $parts = explode('.', $token);
        
        if (count($parts) !== 3) {
            return null;
        }
        
        [$headerEncoded, $payloadEncoded, $signatureEncoded] = $parts;
        
        // Verify signature
        $signature = self::base64UrlDecode($signatureEncoded);
        $expectedSignature = self::sign($headerEncoded . '.' . $payloadEncoded, $secret);
        
        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }
        
        // Decode payload
        $payload = json_decode(self::base64UrlDecode($payloadEncoded), true);
        
        if (!$payload) {
            return null;
        }
        
        // Check expiration
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return null;
        }
        
        return $payload;
    }
    
    /**
     * Generate token for user
     */
    public static function generateToken(array $user, int $expiryHours = 24): string {
        $config = require dirname(__DIR__) . '/config.php';
        $secret = $config['security']['jwt_secret'];
        $expiry = $config['security']['jwt_expiry_hours'] ?? $expiryHours;
        
        $payload = [
            'sub' => $user['id'],
            'email' => $user['email'],
            'name' => $user['name'] ?? null,
            'role' => $user['role'] ?? 'user',
            'iat' => time(),
            'exp' => time() + ($expiry * 3600),
            'jti' => bin2hex(random_bytes(16)) // Unique token ID
        ];
        
        return self::encode($payload, $secret);
    }
    
    /**
     * Validate token and return payload
     */
    public static function validateToken(string $token): ?array {
        $config = require dirname(__DIR__) . '/config.php';
        $secret = $config['security']['jwt_secret'];
        
        return self::decode($token, $secret);
    }
    
    /**
     * Extract token from Authorization header
     */
    public static function extractFromHeader(): ?string {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        
        if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
            return $matches[1];
        }
        
        // Also check query parameter for download links
        if (isset($_GET['token'])) {
            return $_GET['token'];
        }
        
        return null;
    }
    
    /**
     * Sign data with HMAC
     */
    private static function sign(string $data, string $secret): string {
        return hash_hmac('sha256', $data, $secret, true);
    }
    
    /**
     * Base64 URL encode
     */
    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    
    /**
     * Base64 URL decode
     */
    private static function base64UrlDecode(string $data): string {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
