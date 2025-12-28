<?php
/**
 * Self-Hosted Temp Email - Configuration
 * 
 * Copy this file to config.php and update with your settings
 */

return [
    // ===========================================
    // DATABASE
    // ===========================================
    'database' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'temp_email',
        'username' => 'your_db_user',
        'password' => 'your_db_password',
        'charset' => 'utf8mb4',
    ],

    // ===========================================
    // APPLICATION
    // ===========================================
    'app' => [
        'name' => 'Temp Email',
        'url' => 'https://yourdomain.com',
        'debug' => false,
        'timezone' => 'UTC',
    ],

    // ===========================================
    // SECURITY
    // ===========================================
    'security' => [
        // Generate with: openssl rand -hex 32
        'jwt_secret' => 'CHANGE_THIS_TO_A_SECURE_RANDOM_STRING',
        'jwt_expiry_hours' => 24,
        
        // Generate with: openssl rand -hex 32
        'encryption_key' => 'CHANGE_THIS_TO_ANOTHER_SECURE_STRING',
        
        // Allowed origins for CORS
        'allowed_origins' => [
            'https://yourdomain.com',
            'http://localhost:5173', // Development
        ],
    ],

    // ===========================================
    // EMAIL / IMAP
    // ===========================================
    'imap' => [
        'enabled' => true,
        'host' => 'mail.yourdomain.com',
        'port' => 993,
        'username' => 'catchall@yourdomain.com',
        'password' => 'your_imap_password',
        'encryption' => 'ssl', // ssl, tls, or none
        'folder' => 'INBOX',
        'poll_interval' => 120, // seconds
        'max_emails_per_poll' => 50,
    ],

    // ===========================================
    // SMTP (for sending verification emails)
    // ===========================================
    'smtp' => [
        'enabled' => true,
        'host' => 'mail.yourdomain.com',
        'port' => 587,
        'username' => 'noreply@yourdomain.com',
        'password' => 'your_smtp_password',
        'encryption' => 'tls',
        'from_email' => 'noreply@yourdomain.com',
        'from_name' => 'Temp Email',
    ],

    // ===========================================
    // STRIPE (optional)
    // ===========================================
    'stripe' => [
        'enabled' => false,
        'secret_key' => 'sk_live_xxx',
        'webhook_secret' => 'whsec_xxx',
    ],

    // ===========================================
    // RATE LIMITING
    // ===========================================
    'rate_limits' => [
        'emails_per_hour' => 20,
        'api_per_minute' => 60,
        'login_attempts' => 5,
        'lockout_minutes' => 15,
    ],

    // ===========================================
    // FILE UPLOADS
    // ===========================================
    'uploads' => [
        'path' => __DIR__ . '/../uploads',
        'max_size_mb' => 25,
        'allowed_types' => [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'text/csv',
        ],
    ],
];
