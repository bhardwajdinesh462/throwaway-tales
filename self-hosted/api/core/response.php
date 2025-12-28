<?php
/**
 * API Response Handler
 * Handles JSON responses, CORS, and error formatting
 */

class Response {
    /**
     * Set CORS headers
     */
    public static function setCorsHeaders(): void {
        $config = require dirname(__DIR__) . '/config.php';
        $allowedOrigins = $config['security']['allowed_origins'] ?? ['*'];
        
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        
        if (in_array('*', $allowedOrigins) || in_array($origin, $allowedOrigins)) {
            header('Access-Control-Allow-Origin: ' . ($origin ?: '*'));
        }
        
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Max-Age: 86400');
        
        // Handle preflight
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
    
    /**
     * Send JSON response
     */
    public static function json(array $data, int $statusCode = 200): void {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    
    /**
     * Send success response
     */
    public static function success(mixed $data = null, string $message = 'Success', int $statusCode = 200): void {
        self::json([
            'success' => true,
            'message' => $message,
            'data' => $data
        ], $statusCode);
    }
    
    /**
     * Send error response
     */
    public static function error(string $message, int $statusCode = 400, ?array $errors = null): void {
        $response = [
            'success' => false,
            'error' => $message
        ];
        
        if ($errors) {
            $response['errors'] = $errors;
        }
        
        self::json($response, $statusCode);
    }
    
    /**
     * Send 401 Unauthorized
     */
    public static function unauthorized(string $message = 'Unauthorized'): void {
        self::error($message, 401);
    }
    
    /**
     * Send 403 Forbidden
     */
    public static function forbidden(string $message = 'Forbidden'): void {
        self::error($message, 403);
    }
    
    /**
     * Send 404 Not Found
     */
    public static function notFound(string $message = 'Not found'): void {
        self::error($message, 404);
    }
    
    /**
     * Send 500 Internal Server Error
     */
    public static function serverError(string $message = 'Internal server error'): void {
        self::error($message, 500);
    }
    
    /**
     * Send 429 Too Many Requests
     */
    public static function tooManyRequests(string $message = 'Rate limit exceeded'): void {
        self::error($message, 429);
    }
    
    /**
     * Validate required fields
     */
    public static function validateRequired(array $data, array $required): ?array {
        $missing = [];
        
        foreach ($required as $field) {
            if (!isset($data[$field]) || (is_string($data[$field]) && trim($data[$field]) === '')) {
                $missing[] = $field;
            }
        }
        
        return empty($missing) ? null : $missing;
    }
    
    /**
     * Get JSON input
     */
    public static function getJsonInput(): array {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        return $data ?? [];
    }
    
    /**
     * Get request method
     */
    public static function getMethod(): string {
        return strtoupper($_SERVER['REQUEST_METHOD']);
    }
    
    /**
     * Require specific HTTP method
     */
    public static function requireMethod(string|array $methods): void {
        $methods = is_array($methods) ? $methods : [$methods];
        $current = self::getMethod();
        
        if (!in_array($current, $methods)) {
            self::error('Method not allowed', 405);
        }
    }
}
