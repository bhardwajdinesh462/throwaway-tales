<?php
/**
 * SMTP Email Sender
 * Sends emails via SMTP for verification, password reset, etc.
 */

class Mailer {
    private array $config;
    private $socket;
    private array $log = [];
    
    public function __construct() {
        $fullConfig = require dirname(__DIR__) . '/config.php';
        $this->config = $fullConfig['smtp'] ?? [];
    }
    
    /**
     * Send an email
     */
    public function send(string $to, string $subject, string $htmlBody, ?string $textBody = null): bool {
        if (!($this->config['enabled'] ?? false)) {
            error_log("SMTP is disabled in configuration");
            return false;
        }
        
        $fromEmail = $this->config['from_email'] ?? 'noreply@example.com';
        $fromName = $this->config['from_name'] ?? 'Temp Email';
        
        try {
            // Connect to SMTP server
            $this->connect();
            
            // Send EHLO
            $this->sendCommand("EHLO " . gethostname(), 250);
            
            // Start TLS if configured
            if (($this->config['encryption'] ?? '') === 'tls') {
                $this->sendCommand("STARTTLS", 220);
                stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                $this->sendCommand("EHLO " . gethostname(), 250);
            }
            
            // Authenticate
            $this->authenticate();
            
            // Send email
            $this->sendCommand("MAIL FROM:<{$fromEmail}>", 250);
            $this->sendCommand("RCPT TO:<{$to}>", 250);
            $this->sendCommand("DATA", 354);
            
            // Build message
            $message = $this->buildMessage($to, $fromEmail, $fromName, $subject, $htmlBody, $textBody);
            $this->sendCommand($message . "\r\n.", 250);
            
            // Quit
            $this->sendCommand("QUIT", 221);
            
            $this->disconnect();
            
            return true;
            
        } catch (Exception $e) {
            error_log("SMTP Error: " . $e->getMessage());
            error_log("SMTP Log: " . implode("\n", $this->log));
            $this->disconnect();
            return false;
        }
    }
    
    /**
     * Connect to SMTP server
     */
    private function connect(): void {
        $host = $this->config['host'] ?? 'localhost';
        $port = $this->config['port'] ?? 587;
        $encryption = $this->config['encryption'] ?? 'tls';
        
        $protocol = $encryption === 'ssl' ? 'ssl://' : '';
        $address = $protocol . $host . ':' . $port;
        
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ]);
        
        $this->socket = @stream_socket_client(
            $address,
            $errno,
            $errstr,
            30,
            STREAM_CLIENT_CONNECT,
            $context
        );
        
        if (!$this->socket) {
            throw new Exception("Could not connect to SMTP server: {$errstr} ({$errno})");
        }
        
        // Read greeting
        $this->getResponse(220);
    }
    
    /**
     * Authenticate with SMTP server
     */
    private function authenticate(): void {
        $username = $this->config['username'] ?? '';
        $password = $this->config['password'] ?? '';
        
        if (empty($username) || empty($password)) {
            return; // No authentication required
        }
        
        $this->sendCommand("AUTH LOGIN", 334);
        $this->sendCommand(base64_encode($username), 334);
        $this->sendCommand(base64_encode($password), 235);
    }
    
    /**
     * Send command and check response
     */
    private function sendCommand(string $command, int $expectedCode): string {
        // Don't log password
        $logCommand = strpos($command, base64_encode($this->config['password'] ?? '')) !== false 
            ? '[PASSWORD]' 
            : $command;
        $this->log[] = "C: " . $logCommand;
        
        fwrite($this->socket, $command . "\r\n");
        
        return $this->getResponse($expectedCode);
    }
    
    /**
     * Get response from server
     */
    private function getResponse(int $expectedCode): string {
        $response = '';
        
        while ($line = fgets($this->socket, 515)) {
            $response .= $line;
            $this->log[] = "S: " . trim($line);
            
            // Check if this is the last line (no hyphen after code)
            if (preg_match('/^(\d{3}) /', $line, $matches)) {
                break;
            }
        }
        
        $code = (int) substr($response, 0, 3);
        
        if ($code !== $expectedCode) {
            throw new Exception("Unexpected response: {$response} (expected {$expectedCode})");
        }
        
        return $response;
    }
    
    /**
     * Build email message
     */
    private function buildMessage(
        string $to,
        string $fromEmail,
        string $fromName,
        string $subject,
        string $htmlBody,
        ?string $textBody
    ): string {
        $boundary = md5(uniqid(time()));
        
        $headers = [];
        $headers[] = "From: {$fromName} <{$fromEmail}>";
        $headers[] = "To: {$to}";
        $headers[] = "Subject: " . $this->encodeHeader($subject);
        $headers[] = "MIME-Version: 1.0";
        $headers[] = "Date: " . date('r');
        $headers[] = "Message-ID: <" . uniqid() . "@" . parse_url($this->config['host'] ?? 'localhost', PHP_URL_HOST) . ">";
        
        if ($textBody) {
            $headers[] = "Content-Type: multipart/alternative; boundary=\"{$boundary}\"";
            
            $body = "--{$boundary}\r\n";
            $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
            $body .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
            $body .= quoted_printable_encode($textBody) . "\r\n\r\n";
            
            $body .= "--{$boundary}\r\n";
            $body .= "Content-Type: text/html; charset=UTF-8\r\n";
            $body .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
            $body .= quoted_printable_encode($htmlBody) . "\r\n\r\n";
            
            $body .= "--{$boundary}--";
        } else {
            $headers[] = "Content-Type: text/html; charset=UTF-8";
            $headers[] = "Content-Transfer-Encoding: quoted-printable";
            $body = quoted_printable_encode($htmlBody);
        }
        
        return implode("\r\n", $headers) . "\r\n\r\n" . $body;
    }
    
    /**
     * Encode header for UTF-8
     */
    private function encodeHeader(string $text): string {
        if (preg_match('/[^\x20-\x7E]/', $text)) {
            return '=?UTF-8?B?' . base64_encode($text) . '?=';
        }
        return $text;
    }
    
    /**
     * Disconnect from server
     */
    private function disconnect(): void {
        if ($this->socket) {
            @fclose($this->socket);
            $this->socket = null;
        }
    }
    
    /**
     * Send verification email
     */
    public static function sendVerificationEmail(string $to, string $name, string $token): bool {
        $config = require dirname(__DIR__) . '/config.php';
        $appUrl = $config['app']['url'] ?? 'https://yourdomain.com';
        $appName = $config['app']['name'] ?? 'Temp Email';
        
        $verifyUrl = $appUrl . '/verify-email?token=' . urlencode($token);
        
        $html = self::getEmailTemplate('verification', [
            'name' => htmlspecialchars($name ?: 'User'),
            'app_name' => htmlspecialchars($appName),
            'verify_url' => $verifyUrl,
            'year' => date('Y')
        ]);
        
        $text = "Hello {$name},\n\n";
        $text .= "Please verify your email address by clicking the link below:\n\n";
        $text .= $verifyUrl . "\n\n";
        $text .= "This link will expire in 24 hours.\n\n";
        $text .= "If you didn't create an account, you can ignore this email.\n\n";
        $text .= "Best regards,\n{$appName}";
        
        $mailer = new self();
        return $mailer->send($to, "Verify your email - {$appName}", $html, $text);
    }
    
    /**
     * Send password reset email
     */
    public static function sendPasswordResetEmail(string $to, string $name, string $token): bool {
        $config = require dirname(__DIR__) . '/config.php';
        $appUrl = $config['app']['url'] ?? 'https://yourdomain.com';
        $appName = $config['app']['name'] ?? 'Temp Email';
        
        $resetUrl = $appUrl . '/reset-password?token=' . urlencode($token);
        
        $html = self::getEmailTemplate('password-reset', [
            'name' => htmlspecialchars($name ?: 'User'),
            'app_name' => htmlspecialchars($appName),
            'reset_url' => $resetUrl,
            'year' => date('Y')
        ]);
        
        $text = "Hello {$name},\n\n";
        $text .= "We received a request to reset your password.\n\n";
        $text .= "Click the link below to reset your password:\n\n";
        $text .= $resetUrl . "\n\n";
        $text .= "This link will expire in 1 hour.\n\n";
        $text .= "If you didn't request a password reset, you can ignore this email.\n\n";
        $text .= "Best regards,\n{$appName}";
        
        $mailer = new self();
        return $mailer->send($to, "Reset your password - {$appName}", $html, $text);
    }
    
    /**
     * Send welcome email
     */
    public static function sendWelcomeEmail(string $to, string $name): bool {
        $config = require dirname(__DIR__) . '/config.php';
        $appUrl = $config['app']['url'] ?? 'https://yourdomain.com';
        $appName = $config['app']['name'] ?? 'Temp Email';
        
        $html = self::getEmailTemplate('welcome', [
            'name' => htmlspecialchars($name ?: 'User'),
            'app_name' => htmlspecialchars($appName),
            'app_url' => $appUrl,
            'year' => date('Y')
        ]);
        
        $text = "Welcome to {$appName}, {$name}!\n\n";
        $text .= "Your account has been successfully created.\n\n";
        $text .= "Get started: {$appUrl}\n\n";
        $text .= "Best regards,\n{$appName}";
        
        $mailer = new self();
        return $mailer->send($to, "Welcome to {$appName}!", $html, $text);
    }
    
    /**
     * Get email template
     */
    private static function getEmailTemplate(string $template, array $vars): string {
        $templates = [
            'verification' => '
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;">
                            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:600;">{{app_name}}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:40px;">
                            <h2 style="margin:0 0 20px;color:#333333;font-size:24px;">Verify Your Email</h2>
                            <p style="margin:0 0 20px;color:#666666;font-size:16px;line-height:1.6;">
                                Hello {{name}},
                            </p>
                            <p style="margin:0 0 30px;color:#666666;font-size:16px;line-height:1.6;">
                                Please verify your email address by clicking the button below:
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <a href="{{verify_url}}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:6px;font-size:16px;font-weight:600;">
                                            Verify Email
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:30px 0 0;color:#999999;font-size:14px;line-height:1.6;">
                                This link will expire in 24 hours. If you didn\'t create an account, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color:#f8f9fa;padding:20px 40px;text-align:center;">
                            <p style="margin:0;color:#999999;font-size:12px;">
                                &copy; {{year}} {{app_name}}. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>',
            
            'password-reset' => '
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);padding:40px;text-align:center;">
                            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:600;">{{app_name}}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:40px;">
                            <h2 style="margin:0 0 20px;color:#333333;font-size:24px;">Reset Your Password</h2>
                            <p style="margin:0 0 20px;color:#666666;font-size:16px;line-height:1.6;">
                                Hello {{name}},
                            </p>
                            <p style="margin:0 0 30px;color:#666666;font-size:16px;line-height:1.6;">
                                We received a request to reset your password. Click the button below to create a new password:
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <a href="{{reset_url}}" style="display:inline-block;background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:6px;font-size:16px;font-weight:600;">
                                            Reset Password
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:30px 0 0;color:#999999;font-size:14px;line-height:1.6;">
                                This link will expire in 1 hour. If you didn\'t request a password reset, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color:#f8f9fa;padding:20px 40px;text-align:center;">
                            <p style="margin:0;color:#999999;font-size:12px;">
                                &copy; {{year}} {{app_name}}. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>',
            
            'welcome' => '
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background:linear-gradient(135deg,#11998e 0%,#38ef7d 100%);padding:40px;text-align:center;">
                            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:600;">Welcome to {{app_name}}! 🎉</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:40px;">
                            <h2 style="margin:0 0 20px;color:#333333;font-size:24px;">Hello {{name}}!</h2>
                            <p style="margin:0 0 20px;color:#666666;font-size:16px;line-height:1.6;">
                                Your account has been successfully created. You\'re now ready to start using our temporary email service.
                            </p>
                            <p style="margin:0 0 30px;color:#666666;font-size:16px;line-height:1.6;">
                                With {{app_name}}, you can:
                            </p>
                            <ul style="margin:0 0 30px;padding-left:20px;color:#666666;font-size:16px;line-height:1.8;">
                                <li>Generate unlimited temporary email addresses</li>
                                <li>Receive emails instantly</li>
                                <li>Keep your real inbox clean and private</li>
                            </ul>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <a href="{{app_url}}" style="display:inline-block;background:linear-gradient(135deg,#11998e 0%,#38ef7d 100%);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:6px;font-size:16px;font-weight:600;">
                                            Get Started
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color:#f8f9fa;padding:20px 40px;text-align:center;">
                            <p style="margin:0;color:#999999;font-size:12px;">
                                &copy; {{year}} {{app_name}}. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>'
        ];
        
        $html = $templates[$template] ?? '';
        
        foreach ($vars as $key => $value) {
            $html = str_replace('{{' . $key . '}}', $value, $html);
        }
        
        return $html;
    }
    
    /**
     * Test SMTP connection
     */
    public static function testConnection(): array {
        $mailer = new self();
        
        try {
            $mailer->connect();
            $mailer->sendCommand("EHLO " . gethostname(), 250);
            
            if (($mailer->config['encryption'] ?? '') === 'tls') {
                $mailer->sendCommand("STARTTLS", 220);
                stream_socket_enable_crypto($mailer->socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                $mailer->sendCommand("EHLO " . gethostname(), 250);
            }
            
            $mailer->authenticate();
            $mailer->sendCommand("QUIT", 221);
            $mailer->disconnect();
            
            return [
                'success' => true,
                'message' => 'SMTP connection successful'
            ];
            
        } catch (Exception $e) {
            $mailer->disconnect();
            
            return [
                'success' => false,
                'message' => $e->getMessage(),
                'log' => $mailer->log
            ];
        }
    }
}
