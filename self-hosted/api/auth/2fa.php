<?php
/**
 * Two-Factor Authentication Endpoint
 * POST /api/auth/2fa.php
 * 
 * Actions: setup, verify, enable, disable, backup-codes
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';
require_once dirname(__DIR__) . '/core/response.php';

Response::setCorsHeaders();
Response::requireMethod('POST');

$user = Auth::requireAuth();
$input = Response::getJsonInput();
$action = $input['action'] ?? '';

try {
    switch ($action) {
        case 'setup':
            // Generate new 2FA secret
            if ($user['two_factor_enabled']) {
                Response::error('Two-factor authentication is already enabled');
            }
            
            $secret = Auth::generateTOTPSecret();
            $config = Database::getConfig();
            $appName = $config['app']['name'] ?? 'TempEmail';
            
            // Store secret temporarily (not enabled yet)
            Database::update(
                'users',
                [
                    'two_factor_secret' => $secret,
                    'updated_at' => date('Y-m-d H:i:s')
                ],
                'id = ?',
                [$user['id']]
            );
            
            // Generate QR code URL (otpauth format)
            $otpauthUrl = sprintf(
                'otpauth://totp/%s:%s?secret=%s&issuer=%s',
                urlencode($appName),
                urlencode($user['email']),
                $secret,
                urlencode($appName)
            );
            
            Response::success([
                'secret' => $secret,
                'qr_url' => $otpauthUrl
            ], 'Two-factor authentication setup initiated');
            break;
            
        case 'verify':
            // Verify TOTP code during setup
            $code = $input['code'] ?? '';
            
            if (empty($code)) {
                Response::error('Verification code is required');
            }
            
            // Get current secret
            $userData = Database::fetchOne(
                "SELECT two_factor_secret FROM users WHERE id = ?",
                [$user['id']]
            );
            
            if (!$userData || !$userData['two_factor_secret']) {
                Response::error('Two-factor authentication not set up');
            }
            
            if (!Auth::verifyTOTP($userData['two_factor_secret'], $code)) {
                Response::error('Invalid verification code');
            }
            
            Response::success(['valid' => true], 'Code verified successfully');
            break;
            
        case 'enable':
            // Enable 2FA after verification
            $code = $input['code'] ?? '';
            
            if (empty($code)) {
                Response::error('Verification code is required');
            }
            
            $userData = Database::fetchOne(
                "SELECT two_factor_secret FROM users WHERE id = ?",
                [$user['id']]
            );
            
            if (!$userData || !$userData['two_factor_secret']) {
                Response::error('Two-factor authentication not set up');
            }
            
            if (!Auth::verifyTOTP($userData['two_factor_secret'], $code)) {
                Response::error('Invalid verification code');
            }
            
            // Generate backup codes
            $backupCodes = [];
            for ($i = 0; $i < 10; $i++) {
                $backupCodes[] = strtoupper(bin2hex(random_bytes(4)));
            }
            
            // Enable 2FA
            Database::update(
                'users',
                [
                    'two_factor_enabled' => 1,
                    'two_factor_backup_codes' => json_encode($backupCodes),
                    'updated_at' => date('Y-m-d H:i:s')
                ],
                'id = ?',
                [$user['id']]
            );
            
            Response::success([
                'enabled' => true,
                'backup_codes' => $backupCodes
            ], 'Two-factor authentication enabled');
            break;
            
        case 'disable':
            // Disable 2FA
            $password = $input['password'] ?? '';
            
            if (empty($password)) {
                Response::error('Password is required to disable 2FA');
            }
            
            $userData = Database::fetchOne(
                "SELECT password_hash FROM users WHERE id = ?",
                [$user['id']]
            );
            
            if (!Auth::verifyPassword($password, $userData['password_hash'])) {
                Response::error('Invalid password');
            }
            
            Database::update(
                'users',
                [
                    'two_factor_enabled' => 0,
                    'two_factor_secret' => null,
                    'two_factor_backup_codes' => null,
                    'updated_at' => date('Y-m-d H:i:s')
                ],
                'id = ?',
                [$user['id']]
            );
            
            Response::success(['disabled' => true], 'Two-factor authentication disabled');
            break;
            
        case 'backup-codes':
            // Regenerate backup codes
            if (!$user['two_factor_enabled']) {
                Response::error('Two-factor authentication is not enabled');
            }
            
            $password = $input['password'] ?? '';
            
            if (empty($password)) {
                Response::error('Password is required');
            }
            
            $userData = Database::fetchOne(
                "SELECT password_hash FROM users WHERE id = ?",
                [$user['id']]
            );
            
            if (!Auth::verifyPassword($password, $userData['password_hash'])) {
                Response::error('Invalid password');
            }
            
            $backupCodes = [];
            for ($i = 0; $i < 10; $i++) {
                $backupCodes[] = strtoupper(bin2hex(random_bytes(4)));
            }
            
            Database::update(
                'users',
                [
                    'two_factor_backup_codes' => json_encode($backupCodes),
                    'updated_at' => date('Y-m-d H:i:s')
                ],
                'id = ?',
                [$user['id']]
            );
            
            Response::success(['backup_codes' => $backupCodes], 'Backup codes regenerated');
            break;
            
        default:
            Response::error('Invalid action. Valid actions: setup, verify, enable, disable, backup-codes');
    }
    
} catch (Exception $e) {
    error_log("2FA error: " . $e->getMessage());
    Response::serverError('Two-factor authentication operation failed');
}
