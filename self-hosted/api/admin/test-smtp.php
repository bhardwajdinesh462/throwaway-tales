<?php
/**
 * Test SMTP Connection
 * POST /api/admin/test-smtp.php
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';
require_once dirname(__DIR__) . '/core/response.php';
require_once dirname(__DIR__) . '/core/mailer.php';

Response::setCorsHeaders();
Response::requireMethod('POST');

Auth::requireAdmin();

$input = Response::getJsonInput();
$action = $input['action'] ?? 'test';

try {
    if ($action === 'test') {
        // Test SMTP connection
        $result = Mailer::testConnection();
        
        if ($result['success']) {
            Response::success($result, 'SMTP connection successful');
        } else {
            Response::error($result['message'], 400, $result['log'] ?? null);
        }
        
    } elseif ($action === 'send_test') {
        // Send test email
        $to = $input['email'] ?? '';
        
        if (empty($to)) {
            Response::error('Email address is required');
        }
        
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email address');
        }
        
        $config = Database::getConfig();
        $appName = $config['app']['name'] ?? 'Temp Email';
        
        $html = '
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;padding:20px;">
    <h1 style="color:#667eea;">SMTP Test Email</h1>
    <p>This is a test email from <strong>' . htmlspecialchars($appName) . '</strong>.</p>
    <p>If you received this email, your SMTP configuration is working correctly!</p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
    <p style="color:#999;font-size:12px;">Sent at: ' . date('Y-m-d H:i:s') . '</p>
</body>
</html>';
        
        $mailer = new Mailer();
        $sent = $mailer->send($to, "Test Email - {$appName}", $html);
        
        if ($sent) {
            Response::success(['sent' => true], 'Test email sent successfully');
        } else {
            Response::error('Failed to send test email. Check server logs for details.');
        }
        
    } else {
        Response::error('Invalid action');
    }
    
} catch (Exception $e) {
    error_log("SMTP test error: " . $e->getMessage());
    Response::serverError('SMTP test failed: ' . $e->getMessage());
}
