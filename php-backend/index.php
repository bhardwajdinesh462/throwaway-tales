<?php
/**
 * Main PHP Backend Entry Point
 * Self-hosted REST API for TempMail
 */

// Load configuration
$config = require __DIR__ . '/config.php';

// Load routes
require_once __DIR__ . '/routes/auth.php';
require_once __DIR__ . '/routes/data.php';
require_once __DIR__ . '/routes/rpc.php';
require_once __DIR__ . '/routes/storage.php';
require_once __DIR__ . '/routes/functions.php';
require_once __DIR__ . '/routes/admin.php';

// CORS Headers
$allowedOrigins = $config['cors']['origins'] ?? ['*'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins) || in_array('*', $allowedOrigins)) {
    header("Access-Control-Allow-Origin: $origin");
}
header("Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, apikey, X-Temp-Email-Id, X-Secret-Token");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database connection
try {
    $dsn = "mysql:host={$config['db']['host']};dbname={$config['db']['name']};charset={$config['db']['charset']}";
    $pdo = new PDO($dsn, $config['db']['user'], $config['db']['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Parse request
$requestUri = $_SERVER['REQUEST_URI'];
$basePath = '/api';
$path = parse_url($requestUri, PHP_URL_PATH);
$path = str_replace($basePath, '', $path);
$path = trim($path, '/');
$segments = explode('/', $path);
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?: [];

// Route handling
try {
    switch ($segments[0] ?? '') {
        case 'auth':
            handleAuthRoute($segments[1] ?? '', $method, $body, $pdo, $config);
            break;
            
        case 'rest':
            handleDataRoute($segments, $method, $body, $pdo, $config);
            break;
            
        case 'rpc':
            handleRpcRoute($segments[1] ?? '', $body, $pdo, $config);
            break;
            
        case 'storage':
            handleStorageRoute($segments, $method, $pdo, $config);
            break;
            
        case 'functions':
            handleFunction($segments[1] ?? '', $body, $pdo, $config);
            break;
            
        case 'admin':
            handleAdminRoute($segments[1] ?? '', $body, $pdo, $config);
            break;
            
        case 'sse':
            // SSE is handled by sse.php
            header('Location: /api/sse.php?' . $_SERVER['QUERY_STRING']);
            exit;
            
        case 'health':
            echo json_encode(['status' => 'ok', 'timestamp' => date('c')]);
            break;
            
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Not found', 'path' => $path]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

// =========== HELPER FUNCTIONS ===========

function generateUUID() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function getAuthUser($pdo, $config) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) {
        return null;
    }
    
    $token = $matches[1];
    $secret = $config['jwt']['secret'];
    
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
        
        return ['id' => $payload['sub'] ?? null, 'email' => $payload['email'] ?? null];
    } catch (Exception $e) {
        return null;
    }
}

function checkIsAdmin($pdo, $userId) {
    if (!$userId) return false;
    $stmt = $pdo->prepare("SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'admin'");
    $stmt->execute([$userId]);
    return (bool) $stmt->fetch();
}

function sendEmail($to, $subject, $body, $config) {
    $smtp = $config['smtp'] ?? [];
    if (empty($smtp['host'])) {
        // Use PHP mail() as fallback
        return mail($to, $subject, $body, "From: {$smtp['from']}\r\nContent-Type: text/plain; charset=UTF-8");
    }
    
    // For production, use PHPMailer or similar
    // This is a simplified version
    return mail($to, $subject, $body, "From: {$smtp['from']}\r\nContent-Type: text/plain; charset=UTF-8");
}
/**
 * Main API Router - PHP Backend for Trash Mails
 * Place in /api/index.php on your cPanel hosting
 */

require_once __DIR__ . '/vendor/autoload.php';

$config = require __DIR__ . '/config.php';

// CORS headers
header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database connection
try {
    $pdo = new PDO(
        "mysql:host={$config['db']['host']};dbname={$config['db']['name']};charset={$config['db']['charset']}",
        $config['db']['user'],
        $config['db']['pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// JWT Helper functions
function generateJWT($userId, $config) {
    $header = base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64_encode(json_encode([
        'sub' => $userId,
        'iat' => time(),
        'exp' => time() + $config['jwt']['expiry']
    ]));
    $signature = base64_encode(hash_hmac('sha256', "$header.$payload", $config['jwt']['secret'], true));
    return "$header.$payload.$signature";
}

function verifyJWT($token, $config) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    
    [$header, $payload, $signature] = $parts;
    $expectedSig = base64_encode(hash_hmac('sha256', "$header.$payload", $config['jwt']['secret'], true));
    
    if (!hash_equals($expectedSig, $signature)) return null;
    
    $data = json_decode(base64_decode($payload), true);
    if ($data['exp'] < time()) return null;
    
    return $data['sub'];
}

function getAuthUser($pdo, $config) {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/Bearer\s+(.+)/', $authHeader, $matches)) return null;
    
    $userId = verifyJWT($matches[1], $config);
    if (!$userId) return null;
    
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

// Route parsing
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = preg_replace('#^/api#', '', $uri);
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true) ?? [];

// Routes
if (preg_match('#^/auth/(.+)$#', $uri, $m)) {
    require __DIR__ . '/routes/auth.php';
    handleAuth($m[1], $method, $body, $pdo, $config);
} elseif (preg_match('#^/data/(.+)$#', $uri, $m)) {
    require __DIR__ . '/routes/data.php';
    handleData($m[1], $method, $body, $pdo, $config);
} elseif (preg_match('#^/rpc/(.+)$#', $uri, $m)) {
    require __DIR__ . '/routes/rpc.php';
    handleRpc($m[1], $body, $pdo, $config);
} elseif (preg_match('#^/storage/(.+)$#', $uri, $m)) {
    require __DIR__ . '/routes/storage.php';
    handleStorage($m[1], $method, $pdo, $config);
} elseif (preg_match('#^/functions/(.+)$#', $uri, $m)) {
    require __DIR__ . '/routes/functions.php';
    handleFunction($m[1], $body, $pdo, $config);
} else {
    http_response_code(404);
    echo json_encode(['error' => 'Not found']);
}
