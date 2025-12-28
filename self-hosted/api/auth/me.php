<?php
/**
 * Get Current User Profile
 * GET /api/auth/me.php
 * PUT /api/auth/me.php (update profile)
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';
require_once dirname(__DIR__) . '/core/response.php';

Response::setCorsHeaders();

$user = Auth::requireAuth();
$method = Response::getMethod();

try {
    if ($method === 'GET') {
        // Get full user profile
        $profile = Database::fetchOne(
            "SELECT u.id, u.email, u.name, u.email_verified, u.two_factor_enabled,
                    u.created_at, u.last_login_at,
                    p.display_name, p.avatar_url, p.bio,
                    s.tier_id, t.name as tier_name, t.features as tier_features
             FROM users u
             LEFT JOIN profiles p ON p.user_id = u.id
             LEFT JOIN user_subscriptions s ON s.user_id = u.id AND s.status = 'active'
             LEFT JOIN subscription_tiers t ON t.id = s.tier_id
             WHERE u.id = ?",
            [$user['id']]
        );
        
        $isAdmin = Auth::isAdmin($user);
        
        Response::success([
            'user' => [
                'id' => $profile['id'],
                'email' => $profile['email'],
                'name' => $profile['name'],
                'display_name' => $profile['display_name'],
                'avatar_url' => $profile['avatar_url'],
                'bio' => $profile['bio'],
                'email_verified' => (bool) $profile['email_verified'],
                'two_factor_enabled' => (bool) $profile['two_factor_enabled'],
                'is_admin' => $isAdmin,
                'created_at' => $profile['created_at'],
                'last_login_at' => $profile['last_login_at'],
                'subscription' => $profile['tier_id'] ? [
                    'tier_id' => $profile['tier_id'],
                    'tier_name' => $profile['tier_name'],
                    'features' => json_decode($profile['tier_features'], true)
                ] : null
            ]
        ]);
        
    } elseif ($method === 'PUT') {
        // Update profile
        $input = Response::getJsonInput();
        
        $allowedFields = ['name', 'display_name', 'bio', 'avatar_url'];
        $updates = [];
        $profileUpdates = [];
        
        foreach ($allowedFields as $field) {
            if (isset($input[$field])) {
                if ($field === 'name') {
                    $updates['name'] = trim($input['name']);
                } else {
                    $profileUpdates[$field] = trim($input[$field]);
                }
            }
        }
        
        Database::beginTransaction();
        
        if (!empty($updates)) {
            $updates['updated_at'] = date('Y-m-d H:i:s');
            Database::update('users', $updates, 'id = ?', [$user['id']]);
        }
        
        if (!empty($profileUpdates)) {
            $profileUpdates['updated_at'] = date('Y-m-d H:i:s');
            Database::update('profiles', $profileUpdates, 'user_id = ?', [$user['id']]);
        }
        
        Database::commit();
        
        Response::success(null, 'Profile updated successfully');
        
    } else {
        Response::error('Method not allowed', 405);
    }
    
} catch (Exception $e) {
    if ($method === 'PUT') {
        Database::rollback();
    }
    error_log("Profile error: " . $e->getMessage());
    Response::serverError('Failed to process profile request');
}
