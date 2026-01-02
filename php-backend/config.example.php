<?php
/**
 * Configuration file for PHP Backend
 * Copy to config.php and update values
 */

return [
    // Database
    'db' => [
        'host' => 'localhost',
        'name' => 'trashmails',
        'user' => 'your_db_user',
        'pass' => 'your_db_password',
        'charset' => 'utf8mb4',
    ],
    
    // JWT Authentication
    'jwt' => [
        'secret' => 'CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_64_CHARS_MINIMUM',
        'expiry' => 60 * 60 * 24 * 7, // 7 days
        'algorithm' => 'HS256',
    ],
    
    // CORS
    'cors' => [
        'origins' => ['https://yourdomain.com', 'http://localhost:5173'],
        'methods' => ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        'headers' => ['Content-Type', 'Authorization'],
    ],
    
    // Storage
    'storage' => [
        'path' => __DIR__ . '/storage',
        'max_size' => 10 * 1024 * 1024, // 10MB
        'allowed_types' => ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    ],
    
    // OAuth (optional)
    'oauth' => [
        'google' => [
            'client_id' => '',
            'client_secret' => '',
            'redirect_uri' => 'https://yourdomain.com/api/auth/google/callback',
        ],
        'facebook' => [
            'app_id' => '',
            'app_secret' => '',
            'redirect_uri' => 'https://yourdomain.com/api/auth/facebook/callback',
        ],
    ],
    
    // Email (SMTP) - Can also be configured via Admin Panel
    'smtp' => [
        'host' => 'smtp.example.com',
        'port' => 587,
        'user' => 'your_smtp_user',
        'pass' => 'your_smtp_password',
        'from' => 'noreply@yourdomain.com',
        'from_name' => 'Trash Mails',
    ],
    
    // IMAP Settings - Can also be configured via Admin Panel
    'imap' => [
        'host' => 'imap.example.com',
        'port' => 993,
        'user' => 'your_imap_user',
        'pass' => 'your_imap_password',
        'encryption' => 'ssl', // ssl or tls
        'folder' => 'INBOX',
    ],
    
    // Stripe Payment Gateway (optional - can be configured via Admin Panel)
    'stripe' => [
        'publishable_key' => '', // pk_test_... or pk_live_...
        'secret_key' => '', // sk_test_... or sk_live_...
        'webhook_secret' => '', // whsec_...
        'test_mode' => true,
    ],
    
    // PayPal Payment Gateway (optional - can be configured via Admin Panel)
    'paypal' => [
        'client_id' => '',
        'client_secret' => '',
        'webhook_id' => '',
        'mode' => 'sandbox', // sandbox or live
    ],
    
    // reCAPTCHA (optional)
    'recaptcha' => [
        'site_key' => '',
        'secret_key' => '',
    ],
    
    // Security Settings
    'security' => [
        'rate_limit' => 100, // requests per minute
        'login_attempts' => 5, // max failed login attempts before lockout
        'lockout_time' => 900, // lockout duration in seconds (15 min)
    ],
    
    // Diagnostics Token (optional - for /api/health/diag endpoint)
    // Generate with: bin2hex(random_bytes(16))
    'diag_token' => '',
];
