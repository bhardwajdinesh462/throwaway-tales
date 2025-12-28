<?php
/**
 * Email Verification Endpoint
 * GET /api/auth/verify-email.php?token=xxx
 * POST /api/auth/verify-email.php (resend verification)
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';
require_once dirname(__DIR__) . '/core/response.php';

Response::setCorsHeaders();

$method = Response::getMethod();

if ($method === 'GET') {
    // Verify email with token
    $token = $_GET['token'] ?? '';
    
    if (empty($token)) {
        Response::error('Verification token is required');
    }
    
    try {
        $verification = Database::fetchOne(
            "SELECT * FROM email_verifications 
             WHERE token = ? AND verified_at IS NULL AND expires_at > NOW()",
            [$token]
        );
        
        if (!$verification) {
            Response::error('Invalid or expired verification token', 400);
        }
        
        Database::beginTransaction();
        
        // Mark email as verified
        Database::update(
            'users',
            ['email_verified' => 1, 'updated_at' => date('Y-m-d H:i:s')],
            'id = ?',
            [$verification['user_id']]
        );
        
        // Mark verification as used
        Database::update(
            'email_verifications',
            ['verified_at' => date('Y-m-d H:i:s')],
            'id = ?',
            [$verification['id']]
        );
        
        Database::commit();
        
        Response::success(['verified' => true], 'Email verified successfully');
        
    } catch (Exception $e) {
        Database::rollback();
        error_log("Email verification error: " . $e->getMessage());
        Response::serverError('Verification failed');
    }
    
} elseif ($method === 'POST') {
    // Resend verification email
    $user = Auth::requireAuth();
    
    if ($user['email_verified']) {
        Response::error('Email is already verified');
    }
    
    // Check rate limit
    if (!Auth::checkRateLimit('verify-email:' . $user['id'], 3, 60)) {
        Response::tooManyRequests('Too many verification requests. Please try again later.');
    }
    
    try {
        // Delete old verifications
        Database::delete('email_verifications', 'user_id = ?', [$user['id']]);
        
        // Create new verification
        $token = Auth::generateToken();
        
        Database::insert('email_verifications', [
            'id' => Database::generateUUID(),
            'user_id' => $user['id'],
            'email' => $user['email'],
            'token' => $token,
            'expires_at' => date('Y-m-d H:i:s', time() + 86400),
            'created_at' => date('Y-m-d H:i:s')
        ]);
        
        // TODO: Send verification email via SMTP
        
        Response::success(null, 'Verification email sent');
        
    } catch (Exception $e) {
        error_log("Resend verification error: " . $e->getMessage());
        Response::serverError('Failed to send verification email');
    }
    
} else {
    Response::error('Method not allowed', 405);
}
