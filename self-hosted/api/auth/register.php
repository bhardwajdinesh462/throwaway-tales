<?php
/**
 * User Registration Endpoint
 * POST /api/auth/register.php
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';
require_once dirname(__DIR__) . '/core/response.php';
require_once dirname(__DIR__) . '/core/mailer.php';

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
$name = trim($input['name'] ?? '');

// Validate email format
if (!Auth::validateEmail($email)) {
    Response::error('Invalid email format');
}

// Validate password strength
$passwordErrors = Auth::validatePassword($password);
if (!empty($passwordErrors)) {
    Response::error('Password validation failed', 400, $passwordErrors);
}

// Check rate limit
if (!Auth::checkRateLimit('register', 5, 60)) {
    Response::tooManyRequests('Too many registration attempts. Please try again later.');
}

try {
    // Check if email already exists
    $existing = Database::fetchOne(
        "SELECT id FROM users WHERE email = ?",
        [$email]
    );
    
    if ($existing) {
        Response::error('An account with this email already exists', 409);
    }
    
    // Create user
    $userId = Database::generateUUID();
    $passwordHash = Auth::hashPassword($password);
    $verificationToken = Auth::generateToken();
    
    Database::beginTransaction();
    
    // Insert user
    Database::insert('users', [
        'id' => $userId,
        'email' => $email,
        'password_hash' => $passwordHash,
        'name' => $name ?: null,
        'is_active' => 1,
        'email_verified' => 0,
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s')
    ]);
    
    // Create profile
    Database::insert('profiles', [
        'id' => Database::generateUUID(),
        'user_id' => $userId,
        'display_name' => $name ?: explode('@', $email)[0],
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s')
    ]);
    
    // Create email verification record
    Database::insert('email_verifications', [
        'id' => Database::generateUUID(),
        'user_id' => $userId,
        'email' => $email,
        'token' => $verificationToken,
        'expires_at' => date('Y-m-d H:i:s', time() + 86400), // 24 hours
        'created_at' => date('Y-m-d H:i:s')
    ]);
    
    Database::commit();
    
    // Send verification email
    $emailSent = Mailer::sendVerificationEmail($email, $name ?: explode('@', $email)[0], $verificationToken);
    
    // Generate auth token
    $user = [
        'id' => $userId,
        'email' => $email,
        'name' => $name
    ];
    
    $token = Auth::createSession($user);
    
    Response::success([
        'user' => [
            'id' => $userId,
            'email' => $email,
            'name' => $name,
            'email_verified' => false
        ],
        'token' => $token,
        'verification_email_sent' => $emailSent,
        'message' => $emailSent 
            ? 'Registration successful. Please check your email to verify your account.'
            : 'Registration successful. Please verify your email.'
    ], 'Registration successful', 201);
    
} catch (Exception $e) {
    Database::rollback();
    error_log("Registration error: " . $e->getMessage());
    Response::serverError('Registration failed. Please try again.');
}
