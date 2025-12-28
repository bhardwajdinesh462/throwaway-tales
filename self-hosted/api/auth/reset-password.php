<?php
/**
 * Password Reset Endpoint
 * POST /api/auth/reset-password.php
 * 
 * Actions: request (send reset email), reset (change password with token)
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';
require_once dirname(__DIR__) . '/core/response.php';
require_once dirname(__DIR__) . '/core/mailer.php';

Response::setCorsHeaders();
Response::requireMethod('POST');

$input = Response::getJsonInput();
$action = $input['action'] ?? 'request';

try {
    if ($action === 'request') {
        // Request password reset
        $email = strtolower(trim($input['email'] ?? ''));
        
        if (empty($email)) {
            Response::error('Email is required');
        }
        
        if (!Auth::validateEmail($email)) {
            Response::error('Invalid email format');
        }
        
        // Check rate limit
        if (!Auth::checkRateLimit('password-reset:' . $email, 3, 60)) {
            Response::tooManyRequests('Too many reset requests. Please try again later.');
        }
        
        $user = Database::fetchOne(
            "SELECT id, email, name FROM users WHERE email = ? AND is_active = 1",
            [$email]
        );
        
        // Always return success to prevent email enumeration
        if (!$user) {
            Response::success([
                'message' => 'If an account exists with this email, a reset link will be sent.'
            ], 'Password reset requested');
        }
        
        // Generate reset token
        $token = Auth::generateToken();
        $expiresAt = date('Y-m-d H:i:s', time() + 3600); // 1 hour
        
        // Delete old reset tokens
        Database::delete('password_resets', 'user_id = ?', [$user['id']]);
        
        // Store reset token (store hash, not plain token)
        Database::insert('password_resets', [
            'id' => Database::generateUUID(),
            'user_id' => $user['id'],
            'token' => hash('sha256', $token),
            'expires_at' => $expiresAt,
            'created_at' => date('Y-m-d H:i:s')
        ]);
        
        // Send password reset email
        $emailSent = Mailer::sendPasswordResetEmail(
            $user['email'],
            $user['name'] ?: explode('@', $user['email'])[0],
            $token
        );
        
        Response::success([
            'message' => 'If an account exists with this email, a reset link will be sent.',
            'email_sent' => $emailSent
        ], 'Password reset requested');
        
    } elseif ($action === 'reset') {
        // Reset password with token
        $token = $input['token'] ?? '';
        $newPassword = $input['password'] ?? '';
        
        if (empty($token) || empty($newPassword)) {
            Response::error('Token and new password are required');
        }
        
        // Validate password strength
        $passwordErrors = Auth::validatePassword($newPassword);
        if (!empty($passwordErrors)) {
            Response::error('Password validation failed', 400, $passwordErrors);
        }
        
        // Find valid reset token
        $reset = Database::fetchOne(
            "SELECT * FROM password_resets 
             WHERE token = ? AND expires_at > NOW() AND used_at IS NULL",
            [hash('sha256', $token)]
        );
        
        if (!$reset) {
            Response::error('Invalid or expired reset token', 400);
        }
        
        // Get user for welcome back email
        $user = Database::fetchOne(
            "SELECT email, name FROM users WHERE id = ?",
            [$reset['user_id']]
        );
        
        Database::beginTransaction();
        
        // Update password
        $passwordHash = Auth::hashPassword($newPassword);
        
        Database::update(
            'users',
            [
                'password_hash' => $passwordHash,
                'updated_at' => date('Y-m-d H:i:s')
            ],
            'id = ?',
            [$reset['user_id']]
        );
        
        // Mark token as used
        Database::update(
            'password_resets',
            ['used_at' => date('Y-m-d H:i:s')],
            'id = ?',
            [$reset['id']]
        );
        
        // Invalidate all sessions
        Database::delete('sessions', 'user_id = ?', [$reset['user_id']]);
        
        Database::commit();
        
        Response::success([
            'message' => 'Password reset successfully. Please login with your new password.'
        ], 'Password reset successful');
        
    } else {
        Response::error('Invalid action');
    }
    
} catch (Exception $e) {
    if (isset($action) && $action === 'reset') {
        Database::rollback();
    }
    error_log("Password reset error: " . $e->getMessage());
    Response::serverError('Password reset failed');
}
