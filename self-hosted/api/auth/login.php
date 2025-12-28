<?php
/**
 * User Login Endpoint
 * POST /api/auth/login.php
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';
require_once dirname(__DIR__) . '/core/response.php';

Response::setCorsHeaders();
Response::requireMethod('POST');

$input = Response::getJsonInput();

// Validate required fields
$missing = Response::validateRequired($input, ['email', 'password']);
if ($missing) {
    Response::error('Missing required fields: ' . implode(', ', $missing));
}

$email = strtolower(trim($input['email']));
$password = $input['password'];
$totpCode = $input['totp_code'] ?? null;

// Check rate limit
if (!Auth::checkRateLimit('login:' . $email, 5, 15)) {
    Response::tooManyRequests('Too many login attempts. Please try again in 15 minutes.');
}

try {
    // Find user
    $user = Database::fetchOne(
        "SELECT u.*, p.display_name, p.avatar_url 
         FROM users u 
         LEFT JOIN profiles p ON p.user_id = u.id 
         WHERE u.email = ?",
        [$email]
    );
    
    if (!$user) {
        Response::error('Invalid email or password', 401);
    }
    
    // Check if account is active
    if (!$user['is_active']) {
        Response::error('Account is disabled. Please contact support.', 403);
    }
    
    // Verify password
    if (!Auth::verifyPassword($password, $user['password_hash'])) {
        Response::error('Invalid email or password', 401);
    }
    
    // Check 2FA if enabled
    if ($user['two_factor_enabled']) {
        if (!$totpCode) {
            Response::json([
                'success' => false,
                'requires_2fa' => true,
                'message' => 'Two-factor authentication code required'
            ], 200);
        }
        
        if (!Auth::verifyTOTP($user['two_factor_secret'], $totpCode)) {
            Response::error('Invalid two-factor authentication code', 401);
        }
    }
    
    // Update last login
    Database::update(
        'users',
        ['last_login_at' => date('Y-m-d H:i:s')],
        'id = ?',
        [$user['id']]
    );
    
    // Check if user is admin
    $isAdmin = Auth::isAdmin($user);
    
    // Create session and token
    $token = Auth::createSession($user);
    
    // Remove sensitive data
    unset($user['password_hash'], $user['two_factor_secret']);
    
    Response::success([
        'user' => [
            'id' => $user['id'],
            'email' => $user['email'],
            'name' => $user['name'],
            'display_name' => $user['display_name'],
            'avatar_url' => $user['avatar_url'],
            'email_verified' => (bool) $user['email_verified'],
            'is_admin' => $isAdmin
        ],
        'token' => $token
    ], 'Login successful');
    
} catch (Exception $e) {
    error_log("Login error: " . $e->getMessage());
    Response::serverError('Login failed. Please try again.');
}
