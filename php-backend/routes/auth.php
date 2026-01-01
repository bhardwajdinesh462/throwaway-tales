<?php
/**
 * Auth Routes - JWT-based authentication
 */

function handleAuth($action, $method, $body, $pdo, $config) {
    switch ($action) {
        case 'signup':
            handleSignup($body, $pdo, $config);
            break;
        case 'login':
            handleLogin($body, $pdo, $config);
            break;
        case 'logout':
            handleLogout($pdo, $config);
            break;
        case 'session':
            handleSession($pdo, $config);
            break;
        case 'reset-password':
            handleResetPassword($body, $pdo, $config);
            break;
        case 'update-password':
            handleUpdatePassword($body, $pdo, $config);
            break;
        case 'profile':
            handleProfile($method, $body, $pdo, $config);
            break;
        case 'google':
            handleGoogleOAuth($pdo, $config);
            break;
        case 'google/callback':
            handleGoogleCallback($pdo, $config);
            break;
        case 'facebook':
            handleFacebookOAuth($pdo, $config);
            break;
        case 'facebook/callback':
            handleFacebookCallback($pdo, $config);
            break;
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Unknown auth action']);
    }
}

function handleSignup($body, $pdo, $config) {
    $email = strtolower(trim($body['email'] ?? ''));
    $password = $body['password'] ?? '';
    $displayName = $body['display_name'] ?? null;

    // Validation
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid email address']);
        return;
    }

    if (strlen($password) < 6) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least 6 characters']);
        return;
    }

    // Check if email exists
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'Email already registered']);
        return;
    }

    // Create user
    $userId = generateUUID();
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $now = date('Y-m-d H:i:s');

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare('
            INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([$userId, $email, $hashedPassword, $displayName, $now, $now]);

        // Create profile
        $stmt = $pdo->prepare('
            INSERT INTO profiles (id, user_id, email, display_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([generateUUID(), $userId, $email, $displayName, $now, $now]);

        // Create default user role
        $stmt = $pdo->prepare('
            INSERT INTO user_roles (id, user_id, role, created_at)
            VALUES (?, ?, ?, ?)
        ');
        $stmt->execute([generateUUID(), $userId, 'user', $now]);

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create account']);
        return;
    }

    // Generate tokens
    $accessToken = generateJWT($userId, $config);
    $refreshToken = bin2hex(random_bytes(32));

    // Store refresh token
    $stmt = $pdo->prepare('UPDATE users SET refresh_token = ?, refresh_token_expires = ? WHERE id = ?');
    $stmt->execute([$refreshToken, date('Y-m-d H:i:s', time() + 86400 * 30), $userId]);

    $user = [
        'id' => $userId,
        'email' => $email,
        'display_name' => $displayName,
        'created_at' => $now,
        'updated_at' => $now,
    ];

    $session = [
        'access_token' => $accessToken,
        'refresh_token' => $refreshToken,
        'expires_at' => time() + $config['jwt']['expiry'],
        'user' => $user,
    ];

    echo json_encode(['user' => $user, 'session' => $session]);
}

function handleLogin($body, $pdo, $config) {
    $email = strtolower(trim($body['email'] ?? ''));
    $password = $body['password'] ?? '';

    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid email or password']);
        return;
    }

    // Check suspension
    $stmt = $pdo->prepare('SELECT * FROM user_suspensions WHERE user_id = ? AND is_active = 1');
    $stmt->execute([$user['id']]);
    $suspension = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($suspension) {
        if (!$suspension['suspended_until'] || strtotime($suspension['suspended_until']) > time()) {
            http_response_code(403);
            echo json_encode(['error' => 'Account suspended: ' . ($suspension['reason'] ?? 'Contact support')]);
            return;
        }
    }

    // Generate tokens
    $accessToken = generateJWT($user['id'], $config);
    $refreshToken = bin2hex(random_bytes(32));

    // Store refresh token
    $stmt = $pdo->prepare('UPDATE users SET refresh_token = ?, refresh_token_expires = ?, last_login = ? WHERE id = ?');
    $stmt->execute([$refreshToken, date('Y-m-d H:i:s', time() + 86400 * 30), date('Y-m-d H:i:s'), $user['id']]);

    $userData = [
        'id' => $user['id'],
        'email' => $user['email'],
        'display_name' => $user['display_name'],
        'avatar_url' => $user['avatar_url'],
        'created_at' => $user['created_at'],
        'updated_at' => $user['updated_at'],
    ];

    $session = [
        'access_token' => $accessToken,
        'refresh_token' => $refreshToken,
        'expires_at' => time() + $config['jwt']['expiry'],
        'user' => $userData,
    ];

    echo json_encode(['user' => $userData, 'session' => $session]);
}

function handleLogout($pdo, $config) {
    $user = getAuthUser($pdo, $config);
    if ($user) {
        $stmt = $pdo->prepare('UPDATE users SET refresh_token = NULL WHERE id = ?');
        $stmt->execute([$user['id']]);
    }
    echo json_encode(['success' => true]);
}

function handleSession($pdo, $config) {
    $user = getAuthUser($pdo, $config);
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired session']);
        return;
    }

    $userData = [
        'id' => $user['id'],
        'email' => $user['email'],
        'display_name' => $user['display_name'],
        'avatar_url' => $user['avatar_url'],
        'created_at' => $user['created_at'],
        'updated_at' => $user['updated_at'],
    ];

    // Get auth header token for session info
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    preg_match('/Bearer\s+(.+)/', $authHeader, $matches);
    $token = $matches[1] ?? '';

    $session = [
        'access_token' => $token,
        'refresh_token' => $user['refresh_token'],
        'expires_at' => time() + $config['jwt']['expiry'],
        'user' => $userData,
    ];

    echo json_encode(['user' => $userData, 'session' => $session]);
}

function handleResetPassword($body, $pdo, $config) {
    $email = strtolower(trim($body['email'] ?? ''));

    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    // Always return success to prevent email enumeration
    if (!$user) {
        echo json_encode(['success' => true]);
        return;
    }

    // Generate reset token
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', time() + 3600); // 1 hour

    $stmt = $pdo->prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?');
    $stmt->execute([$token, $expires, $user['id']]);

    // Send email (implement with your SMTP settings)
    $resetLink = ($_SERVER['HTTP_ORIGIN'] ?? 'https://yourdomain.com') . "/auth?mode=reset&token=$token";
    sendEmail($email, 'Password Reset', "Click here to reset your password: $resetLink", $config);

    echo json_encode(['success' => true]);
}

function handleUpdatePassword($body, $pdo, $config) {
    $password = $body['password'] ?? '';
    $token = $body['token'] ?? null;

    if (strlen($password) < 6) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least 6 characters']);
        return;
    }

    $user = null;

    if ($token) {
        // Token-based reset
        $stmt = $pdo->prepare('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()');
        $stmt->execute([$token]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
    } else {
        // Authenticated update
        $user = getAuthUser($pdo, $config);
    }

    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired reset token']);
        return;
    }

    $hashedPassword = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $stmt = $pdo->prepare('UPDATE users SET password_hash = ?, reset_token = NULL, updated_at = NOW() WHERE id = ?');
    $stmt->execute([$hashedPassword, $user['id']]);

    echo json_encode(['success' => true]);
}

function handleProfile($method, $body, $pdo, $config) {
    $user = getAuthUser($pdo, $config);
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }

    if ($method === 'PATCH') {
        $allowedFields = ['display_name', 'avatar_url'];
        $updates = [];
        $params = [];

        foreach ($allowedFields as $field) {
            if (isset($body[$field])) {
                $updates[] = "$field = ?";
                $params[] = $body[$field];
            }
        }

        if (empty($updates)) {
            echo json_encode($user);
            return;
        }

        $params[] = $user['id'];
        $sql = 'UPDATE users SET ' . implode(', ', $updates) . ', updated_at = NOW() WHERE id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        // Also update profile
        $sql = 'UPDATE profiles SET ' . implode(', ', $updates) . ', updated_at = NOW() WHERE user_id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    echo json_encode([
        'id' => $user['id'],
        'email' => $user['email'],
        'display_name' => $user['display_name'],
        'avatar_url' => $user['avatar_url'],
        'created_at' => $user['created_at'],
        'updated_at' => $user['updated_at'],
    ]);
}

function handleGoogleOAuth($pdo, $config) {
    $oauth = $config['oauth']['google'];
    if (empty($oauth['client_id'])) {
        http_response_code(503);
        echo json_encode(['error' => 'Google OAuth not configured']);
        return;
    }

    $state = bin2hex(random_bytes(16));
    $_SESSION['oauth_state'] = $state;

    $params = http_build_query([
        'client_id' => $oauth['client_id'],
        'redirect_uri' => $oauth['redirect_uri'],
        'response_type' => 'code',
        'scope' => 'email profile',
        'state' => $state,
    ]);

    header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . $params);
    exit;
}

function handleGoogleCallback($pdo, $config) {
    // Exchange code for token, get user info, create/update user, redirect with token
    $code = $_GET['code'] ?? '';
    $oauth = $config['oauth']['google'];

    if (empty($code)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing authorization code']);
        return;
    }

    // Exchange code for access token
    $tokenResponse = file_get_contents('https://oauth2.googleapis.com/token', false, stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/x-www-form-urlencoded',
            'content' => http_build_query([
                'code' => $code,
                'client_id' => $oauth['client_id'],
                'client_secret' => $oauth['client_secret'],
                'redirect_uri' => $oauth['redirect_uri'],
                'grant_type' => 'authorization_code',
            ]),
        ],
    ]));

    $tokenData = json_decode($tokenResponse, true);
    if (empty($tokenData['access_token'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Failed to exchange code for token']);
        return;
    }

    // Get user info
    $userInfo = json_decode(file_get_contents('https://www.googleapis.com/oauth2/v2/userinfo', false, stream_context_create([
        'http' => ['header' => 'Authorization: Bearer ' . $tokenData['access_token']],
    ])), true);

    $email = strtolower($userInfo['email'] ?? '');
    $displayName = $userInfo['name'] ?? '';
    $avatarUrl = $userInfo['picture'] ?? '';

    // Find or create user
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    $now = date('Y-m-d H:i:s');

    if (!$user) {
        $userId = generateUUID();
        $stmt = $pdo->prepare('INSERT INTO users (id, email, display_name, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$userId, $email, $displayName, $avatarUrl, $now, $now]);

        $stmt = $pdo->prepare('INSERT INTO profiles (id, user_id, email, display_name, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([generateUUID(), $userId, $email, $displayName, $avatarUrl, $now, $now]);

        $stmt = $pdo->prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)');
        $stmt->execute([generateUUID(), $userId, 'user', $now]);
    } else {
        $userId = $user['id'];
        $stmt = $pdo->prepare('UPDATE users SET display_name = COALESCE(display_name, ?), avatar_url = COALESCE(avatar_url, ?), updated_at = ? WHERE id = ?');
        $stmt->execute([$displayName, $avatarUrl, $now, $userId]);
    }

    // Generate tokens
    $accessToken = generateJWT($userId, $config);
    $refreshToken = bin2hex(random_bytes(32));

    $stmt = $pdo->prepare('UPDATE users SET refresh_token = ?, refresh_token_expires = ?, last_login = ? WHERE id = ?');
    $stmt->execute([$refreshToken, date('Y-m-d H:i:s', time() + 86400 * 30), $now, $userId]);

    // Redirect back to frontend with token
    $frontendUrl = $_SERVER['HTTP_ORIGIN'] ?? 'https://yourdomain.com';
    header("Location: $frontendUrl/?token=$accessToken&refresh_token=$refreshToken");
    exit;
}

function handleFacebookOAuth($pdo, $config) {
    $oauth = $config['oauth']['facebook'];
    if (empty($oauth['app_id'])) {
        http_response_code(503);
        echo json_encode(['error' => 'Facebook OAuth not configured']);
        return;
    }

    $state = bin2hex(random_bytes(16));
    $_SESSION['oauth_state'] = $state;

    $params = http_build_query([
        'client_id' => $oauth['app_id'],
        'redirect_uri' => $oauth['redirect_uri'],
        'scope' => 'email,public_profile',
        'state' => $state,
    ]);

    header('Location: https://www.facebook.com/v18.0/dialog/oauth?' . $params);
    exit;
}

function handleFacebookCallback($pdo, $config) {
    $code = $_GET['code'] ?? '';
    $oauth = $config['oauth']['facebook'];

    if (empty($code)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing authorization code']);
        return;
    }

    // Exchange code for token
    $tokenUrl = 'https://graph.facebook.com/v18.0/oauth/access_token?' . http_build_query([
        'client_id' => $oauth['app_id'],
        'client_secret' => $oauth['app_secret'],
        'redirect_uri' => $oauth['redirect_uri'],
        'code' => $code,
    ]);

    $tokenData = json_decode(file_get_contents($tokenUrl), true);
    if (empty($tokenData['access_token'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Failed to exchange code for token']);
        return;
    }

    // Get user info
    $userInfo = json_decode(file_get_contents('https://graph.facebook.com/me?fields=id,name,email,picture&access_token=' . $tokenData['access_token']), true);

    $email = strtolower($userInfo['email'] ?? '');
    $displayName = $userInfo['name'] ?? '';
    $avatarUrl = $userInfo['picture']['data']['url'] ?? '';

    if (empty($email)) {
        http_response_code(400);
        echo json_encode(['error' => 'Email permission required']);
        return;
    }

    // Find or create user (same as Google)
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    $now = date('Y-m-d H:i:s');

    if (!$user) {
        $userId = generateUUID();
        $stmt = $pdo->prepare('INSERT INTO users (id, email, display_name, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$userId, $email, $displayName, $avatarUrl, $now, $now]);

        $stmt = $pdo->prepare('INSERT INTO profiles (id, user_id, email, display_name, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([generateUUID(), $userId, $email, $displayName, $avatarUrl, $now, $now]);

        $stmt = $pdo->prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, ?)');
        $stmt->execute([generateUUID(), $userId, 'user', $now]);
    } else {
        $userId = $user['id'];
    }

    $accessToken = generateJWT($userId, $config);
    $refreshToken = bin2hex(random_bytes(32));

    $stmt = $pdo->prepare('UPDATE users SET refresh_token = ?, refresh_token_expires = ?, last_login = ? WHERE id = ?');
    $stmt->execute([$refreshToken, date('Y-m-d H:i:s', time() + 86400 * 30), $now, $userId]);

    $frontendUrl = $_SERVER['HTTP_ORIGIN'] ?? 'https://yourdomain.com';
    header("Location: $frontendUrl/?token=$accessToken&refresh_token=$refreshToken");
    exit;
}

// Helper functions
function generateUUID() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function sendEmail($to, $subject, $body, $config) {
    $smtp = $config['smtp'];
    if (empty($smtp['host'])) return false;

    // Simple mail() fallback - in production use PHPMailer
    $headers = "From: {$smtp['from_name']} <{$smtp['from']}>\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    
    return mail($to, $subject, $body, $headers);
}
