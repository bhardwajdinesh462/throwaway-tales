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
    
    // Email (SMTP)
    'smtp' => [
        'host' => 'smtp.example.com',
        'port' => 587,
        'user' => 'your_smtp_user',
        'pass' => 'your_smtp_password',
        'from' => 'noreply@yourdomain.com',
        'from_name' => 'Trash Mails',
    ],
];
