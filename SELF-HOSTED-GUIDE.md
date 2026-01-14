# TempMail Self-Hosted Deployment Guide

Complete guide for deploying TempMail on your own server using the PHP backend.

---

## 📋 Requirements

### Server Requirements
- **PHP 8.0+** with extensions: `pdo_mysql`, `mbstring`, `json`, `openssl`, `imap`, `curl`
- **MySQL 8.0+** or MariaDB 10.4+
- **Apache** with `mod_rewrite` enabled, or **Nginx**
- **SSL Certificate** (required for production)

### Optional Services
- **SMTP Server** for sending emails (verification, password reset, notifications)
- **IMAP Server** for receiving emails into temp mailboxes
- **Stripe/PayPal** for payment processing
- **Google Cloud** for Search Console API integration

---

## 🚀 Quick Installation

### Step 1: Build for Self-Hosting

```bash
# Clone the repository
git clone <your-repo-url>
cd tempmail

# Install dependencies
npm install

# Build for self-hosted (cPanel) deployment
npm run build:cpanel
```

This creates a `cpanel-package/` directory with:
- Frontend files (upload to web root)
- PHP backend (upload to `/api` folder)

### Step 2: Upload Files

**For cPanel:**
1. Upload contents of `cpanel-package/public_html/` to `public_html/`
2. The `api/` folder should be inside `public_html/`

**File structure should be:**
```
public_html/
├── index.html
├── assets/
├── .htaccess
├── robots.txt
├── sitemap.xml
└── api/
    ├── index.php
    ├── install.php
    ├── schema.sql
    ├── config.example.php
    ├── routes/
    ├── includes/
    ├── cron/
    └── ...
```

### Step 3: Run the Setup Wizard

1. Navigate to `https://yourdomain.com/api/install.php`
2. Follow the wizard to:
   - Test database connection
   - Create database tables
   - Create admin account
   - Configure SMTP (optional)
   - Configure IMAP (optional)

3. **⚠️ CRITICAL: Delete `install.php` after setup!**

### Step 4: Set Up Cron Jobs

Add these cron jobs in cPanel → Cron Jobs:

```bash
# Poll IMAP for new emails (every 2 minutes)
*/2 * * * * /usr/bin/php /home/username/public_html/api/cron/imap-poll.php >> /home/username/logs/imap.log 2>&1

# Run maintenance tasks (hourly)
0 * * * * /usr/bin/php /home/username/public_html/api/cron/maintenance.php >> /home/username/logs/maintenance.log 2>&1

# Health check (every 6 hours)
0 */6 * * * /usr/bin/php /home/username/public_html/api/cron/health-check.php >> /home/username/logs/health.log 2>&1
```

Replace `username` with your cPanel username.

### Step 5: Login and Configure

1. Go to `https://yourdomain.com/auth` and login with your admin account
2. Navigate to Admin Panel
3. Add your email domains in Admin → Domains
4. Configure mailboxes in Admin → Mailboxes

---

## 🔧 Manual Configuration

If the wizard fails, configure manually:

### Create config.php

Copy `api/config.example.php` to `api/config.php` and update:

```php
<?php
// Database constants (REQUIRED)
define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database');
define('DB_USER', 'your_username');
define('DB_PASS', 'your_password');

// Security
define('JWT_SECRET', 'generate-a-64-character-random-string-here');
define('JWT_EXPIRY', 604800); // 7 days

// SMTP (optional - can configure via Admin Panel)
define('SMTP_HOST', 'smtp.yourdomain.com');
define('SMTP_PORT', 587);
define('SMTP_USER', 'noreply@yourdomain.com');
define('SMTP_PASS', 'your-smtp-password');
define('SMTP_FROM', 'noreply@yourdomain.com');

// IMAP (optional - can configure via Admin Panel → Mailboxes)
define('IMAP_HOST', 'imap.yourdomain.com');
define('IMAP_PORT', 993);
define('IMAP_USER', 'catchall@yourdomain.com');
define('IMAP_PASS', 'your-imap-password');

define('STORAGE_PATH', __DIR__ . '/storage');
define('ENCRYPTION_KEY', JWT_SECRET);

// Google Search Console (optional)
define('GOOGLE_CLIENT_ID', '');
define('GOOGLE_CLIENT_SECRET', '');

// Stripe (optional)
define('STRIPE_SECRET_KEY', '');
define('STRIPE_WEBHOOK_SECRET', '');

// PayPal (optional)
define('PAYPAL_CLIENT_ID', '');
define('PAYPAL_CLIENT_SECRET', '');

// Array format for main application
return [
    'db' => [
        'host' => DB_HOST,
        'name' => DB_NAME,
        'user' => DB_USER,
        'pass' => DB_PASS,
        'charset' => 'utf8mb4'
    ],
    'jwt' => [
        'secret' => JWT_SECRET,
        'expiry' => JWT_EXPIRY
    ],
    'smtp' => [
        'host' => SMTP_HOST,
        'port' => SMTP_PORT,
        'user' => SMTP_USER,
        'pass' => SMTP_PASS,
        'from' => SMTP_FROM
    ],
    'imap' => [
        'host' => IMAP_HOST,
        'port' => IMAP_PORT,
        'user' => IMAP_USER,
        'pass' => IMAP_PASS
    ],
    'google' => [
        'client_id' => GOOGLE_CLIENT_ID,
        'client_secret' => GOOGLE_CLIENT_SECRET
    ],
    'cors' => [
        'origins' => ['https://yourdomain.com', 'https://www.yourdomain.com']
    ],
    'storage' => [
        'path' => STORAGE_PATH,
        'max_size' => 10485760 // 10MB
    ],
    'recaptcha' => [
        'site_key' => '',
        'secret_key' => ''
    ],
    'diag_token' => '' // Generate with: bin2hex(random_bytes(16))
];
```

### Generate JWT Secret

```bash
# Option 1: PHP CLI
php -r "echo bin2hex(random_bytes(32)) . PHP_EOL;"

# Option 2: OpenSSL
openssl rand -hex 32
```

### Import Database Schema

```bash
mysql -u username -p database_name < api/schema.sql
```

Or use phpMyAdmin to import `api/schema.sql`.

### Create First Admin User

Using MySQL/phpMyAdmin:

```sql
-- Generate bcrypt hash for your password first:
-- php -r "echo password_hash('YourPassword123', PASSWORD_BCRYPT, ['cost' => 12]);"

SET @user_id = UUID();

INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
VALUES (@user_id, 'admin@yourdomain.com', 
        '$2y$12$YOUR_GENERATED_HASH', 
        'Admin', NOW(), NOW());

INSERT INTO profiles (id, user_id, email, display_name, email_verified, created_at, updated_at)
VALUES (UUID(), @user_id, 'admin@yourdomain.com', 'Admin', 1, NOW(), NOW());

INSERT INTO user_roles (id, user_id, role, created_at)
VALUES (UUID(), @user_id, 'admin', NOW());
```

---

## 📧 Email Domain Setup

### Add Domain in Admin Panel

1. Go to Admin → Domains
2. Click "Add Domain"
3. Enter your domain (e.g., `tempmail.example.com`)

### Configure Catch-All Mailbox

1. Go to Admin → Mailboxes
2. Click "Add Mailbox"
3. Configure:
   - **Name:** Main Inbox
   - **IMAP Host:** Your mail server
   - **IMAP Port:** 993
   - **IMAP User:** The catch-all email account
   - **IMAP Password:** Account password

### Required DNS Records

| Type | Name | Value | Priority |
|------|------|-------|----------|
| MX | @ | mail.yourdomain.com | 10 |
| A | mail | YOUR_SERVER_IP | - |
| TXT | @ | v=spf1 mx ~all | - |
| TXT | _dmarc | v=DMARC1; p=none | - |

### cPanel Catch-All Setup

1. Email → Email Routing → Set "Local Mail Exchanger"
2. Email → Default Address → Set catch-all to your inbox email

---

## 🌐 Google Search Console Integration

### Setup OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Search Console API"
4. Go to Credentials → Create OAuth 2.0 Client ID
5. Set authorized redirect URI: `https://yourdomain.com/api/gsc/callback`
6. Add Client ID and Secret to `config.php`

### Features
- Automatic sitemap submission
- Performance analytics (clicks, impressions, CTR, position)
- URL indexing requests

---

## 🔒 Security Checklist

- [ ] SSL certificate installed and HTTPS forced
- [ ] `install.php` deleted after setup
- [ ] Strong JWT secret (64+ characters)
- [ ] `config.php` not accessible via web (600 permissions)
- [ ] `logs/` directory protected (.htaccess)
- [ ] Database user has minimal permissions
- [ ] Regular backups configured
- [ ] Rate limiting enabled
- [ ] Error display disabled (`display_errors = 0`)

### File Permissions

```bash
chmod 755 api/
chmod 600 api/config.php
chmod 755 api/storage/
chmod 755 api/logs/
```

---

## 🐛 Troubleshooting

### 500 Internal Server Error
1. Check `api/logs/php-errors.log`
2. Verify PHP version ≥ 8.0
3. Check file permissions
4. Verify all PHP extensions installed

### CORS Errors
Update `config.php` cors origins:
```php
'cors' => [
    'origins' => ['https://yourdomain.com', 'https://www.yourdomain.com']
]
```

### Login Not Working
1. Verify JWT secret in config
2. Check database connection
3. Clear browser localStorage
4. Check browser console for errors

### Emails Not Received
1. Check mailbox config in Admin → Mailboxes
2. Verify IMAP credentials (use test connection button)
3. Check cron job is running: `tail -f api/logs/imap-poll.log`
4. Verify MX records point to your server

### API Returns 404
1. Verify `.htaccess` is present in `/api`
2. Enable `mod_rewrite` in Apache
3. For Nginx, add proper rewrite rules

---

## 📁 Directory Structure

```
api/
├── index.php           # Main API router
├── config.php          # Your configuration
├── schema.sql          # Database schema
├── routes/
│   ├── auth.php        # Authentication
│   ├── data.php        # CRUD operations
│   ├── rpc.php         # RPC functions
│   ├── functions.php   # Edge function equivalents
│   ├── admin.php       # Admin operations
│   ├── seo.php         # SEO routes (sitemap, ping)
│   ├── google-search-console.php  # GSC API integration
│   └── ...
├── includes/
│   ├── db.php          # Database helper
│   └── helpers.php     # Utility functions
├── cron/
│   ├── imap-poll.php   # Email polling
│   ├── maintenance.php # Cleanup tasks
│   └── health-check.php
├── storage/
│   ├── avatars/
│   └── attachments/
└── logs/
```

---

## 🔄 Upgrading

1. **Backup** `api/config.php` and database
2. Download latest release
3. Upload new files (don't overwrite `config.php`)
4. Check release notes for schema changes
5. Run any migration SQL if needed
6. Clear PHP OPcache if applicable

### Clearing OPcache

```bash
# Touch files to invalidate cache
find public_html/api -name "*.php" -exec touch {} \;

# Or restart PHP-FPM
sudo systemctl restart php8.1-fpm
```

---

## 📞 Support

- Check logs at `api/logs/` for errors
- Health endpoint: `https://yourdomain.com/api/health`
- Diagnostics: `https://yourdomain.com/api/health/diag?token=YOUR_TOKEN`
