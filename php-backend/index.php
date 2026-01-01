<?php
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
