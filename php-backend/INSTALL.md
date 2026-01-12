# PHP Backend Manual Installation Guide

Complete step-by-step guide to install the TempMail PHP backend on your server.

## Prerequisites

- PHP 8.0+ with extensions: `pdo_mysql`, `mbstring`, `json`, `openssl`, `imap` (optional)
- MySQL 5.7+ or MariaDB 10.3+
- Apache with mod_rewrite OR Nginx
- SSL certificate (required for production)

---

## Step 1: Upload Files

Upload the entire `php-backend/` folder to your server:

```
public_html/
└── api/                    ← Upload here
    ├── config.example.php
    ├── config.php          ← You'll create this
    ├── index.php
    ├── schema.sql
    ├── .htaccess
    ├── routes/
    ├── includes/
    ├── cron/
    └── ...
```

### cPanel File Manager
1. Login to cPanel
2. Open File Manager
3. Navigate to `public_html`
4. Create folder `api`
5. Upload all files from `php-backend/` into `api/`

---

## Step 2: Create Database

### Option A: cPanel (Recommended)

1. Go to **cPanel → MySQL Databases**
2. Create a new database: `yourprefix_tempmail`
3. Create a new user: `yourprefix_mailuser` with a strong password
4. Add user to database with **ALL PRIVILEGES**

### Option B: Command Line

```sql
mysql -u root -p

CREATE DATABASE tempmail_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tempmail_user'@'localhost' IDENTIFIED BY 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON tempmail_db.* TO 'tempmail_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## Step 3: Import Database Schema

### Option A: phpMyAdmin (cPanel)

1. Go to **cPanel → phpMyAdmin**
2. Select your database from the left sidebar
3. Click **Import** tab
4. Choose file: `schema.sql`
5. Click **Go**

### Option B: Command Line

```bash
mysql -u tempmail_user -p tempmail_db < /path/to/api/schema.sql
```

### Verify Tables Created

After import, you should see 36 tables including:
- `users`, `profiles`, `user_roles`
- `temp_emails`, `received_emails`, `domains`
- `mailboxes`, `app_settings`, etc.

---

## Step 4: Create Configuration File

Copy the example config:
```bash
cp config.example.php config.php
```

Edit `config.php` with your settings:

```php
<?php
return [
    // Database - REQUIRED
    'db' => [
        'host' => 'localhost',
        'name' => 'yourprefix_tempmail',    // Your database name
        'user' => 'yourprefix_mailuser',    // Your database user
        'pass' => 'YourSecurePassword123!', // Your password
        'charset' => 'utf8mb4',
    ],
    
    // JWT Authentication - REQUIRED
    'jwt' => [
        'secret' => 'PASTE_YOUR_64_CHAR_SECRET_HERE',
        'expiry' => 604800, // 7 days
        'algorithm' => 'HS256',
    ],
    
    // CORS - Update with your domain
    'cors' => [
        'origins' => [
            'https://yourdomain.com',
            'https://www.yourdomain.com'
        ],
        'methods' => ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        'headers' => ['Content-Type', 'Authorization'],
    ],
    
    // Storage
    'storage' => [
        'path' => __DIR__ . '/storage',
        'max_size' => 10 * 1024 * 1024, // 10MB
        'allowed_types' => ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    ],
    
    // SMTP - Configure via Admin Panel or here
    'smtp' => [
        'host' => 'mail.yourdomain.com',
        'port' => 587,
        'user' => 'noreply@yourdomain.com',
        'pass' => 'your_smtp_password',
        'from' => 'noreply@yourdomain.com',
        'from_name' => 'TempMail',
    ],
    
    // IMAP - Configure via Admin Panel or here
    'imap' => [
        'host' => 'mail.yourdomain.com',
        'port' => 993,
        'user' => 'catchall@yourdomain.com',
        'pass' => 'your_imap_password',
        'encryption' => 'ssl',
        'folder' => 'INBOX',
    ],
    
    // Optional: Stripe
    'stripe' => [
        'publishable_key' => '',
        'secret_key' => '',
        'webhook_secret' => '',
        'test_mode' => true,
    ],
    
    // Optional: reCAPTCHA
    'recaptcha' => [
        'site_key' => '',
        'secret_key' => '',
    ],
    
    // Security
    'security' => [
        'rate_limit' => 100,
        'login_attempts' => 5,
        'lockout_time' => 900,
    ],
    
    // Diagnostics (generate with: php -r "echo bin2hex(random_bytes(16));")
    'diag_token' => '',
];
```

### Generate JWT Secret

Run this command to generate a secure 64-character secret:

```bash
# Option 1: PHP CLI
php -r "echo bin2hex(random_bytes(32)) . PHP_EOL;"

# Option 2: OpenSSL
openssl rand -hex 32
```

Copy the output and paste into `config.php` as the JWT secret.

---

## Step 5: Create Admin User

### Option A: Web Interface (Easiest)

1. Open in browser: `https://yourdomain.com/api/setup-admin.php`
2. Fill in your admin email and password
3. Click "Create Admin Account"
4. **DELETE `setup-admin.php` immediately after!**

### Option B: Direct SQL

```sql
-- Generate these UUIDs or use UUID() function
SET @user_id = UUID();
SET @profile_id = UUID();
SET @role_id = UUID();

-- Create user (use a bcrypt hash generator for the password)
INSERT INTO users (id, email, password_hash, created_at, updated_at) 
VALUES (@user_id, 'admin@yourdomain.com', '$2y$12$YOUR_BCRYPT_HASH', NOW(), NOW());

-- Create profile
INSERT INTO profiles (id, user_id, email, display_name, email_verified, created_at, updated_at)
VALUES (@profile_id, @user_id, 'admin@yourdomain.com', 'Admin', 1, NOW(), NOW());

-- Assign admin role
INSERT INTO user_roles (id, user_id, role, created_at)
VALUES (@role_id, @user_id, 'admin', NOW());
```

To generate a bcrypt hash:
```bash
php -r "echo password_hash('YourPassword123', PASSWORD_BCRYPT, ['cost' => 12]) . PHP_EOL;"
```

---

## Step 6: Set File Permissions

### cPanel File Manager
Right-click each folder/file → Change Permissions

### Command Line
```bash
# Directories
chmod 755 api/
chmod 755 api/logs/
chmod 755 api/storage/
chmod 755 api/storage/attachments/
chmod 755 api/storage/avatars/

# Files
chmod 644 api/*.php
chmod 644 api/config.php

# Protect sensitive files
chmod 600 api/config.php  # More secure option
```

### Create Required Directories
```bash
mkdir -p api/logs
mkdir -p api/storage/attachments
mkdir -p api/storage/avatars
```

---

## Step 7: Configure Cron Jobs

### cPanel (Cron Jobs)

Add these cron jobs:

| Schedule | Command | Purpose |
|----------|---------|---------|
| Every 2 min | `/usr/bin/php ~/public_html/api/cron/imap-poll.php` | Fetch new emails |
| Every hour | `/usr/bin/php ~/public_html/api/cron/health-check.php` | System health check |
| Daily 3 AM | `/usr/bin/php ~/public_html/api/cron/maintenance.php` | Cleanup old data |

### Command Line (crontab -e)
```cron
*/2 * * * * /usr/bin/php /home/username/public_html/api/cron/imap-poll.php >> /home/username/public_html/api/logs/imap-poll.log 2>&1
0 * * * * /usr/bin/php /home/username/public_html/api/cron/health-check.php >> /home/username/public_html/api/logs/health-check.log 2>&1
0 3 * * * /usr/bin/php /home/username/public_html/api/cron/maintenance.php >> /home/username/public_html/api/logs/maintenance.log 2>&1
```

---

## Step 8: Verify Installation

### Test Health Endpoint
```bash
curl https://yourdomain.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-12T12:00:00Z",
  "db_connected": true,
  "selfhost_version": "2026-01-09-v2"
}
```

### Test with Diagnostics Token
If you set a `diag_token` in config:
```bash
curl "https://yourdomain.com/api/health/diag?token=YOUR_DIAG_TOKEN"
```

### Common Verification Checks
- [ ] Health endpoint returns `"status": "ok"`
- [ ] Database shows `"db_connected": true`
- [ ] Login with admin credentials works
- [ ] Admin panel loads at `/admin`
- [ ] Cron jobs appear in logs

---

## Step 9: Security Cleanup

**CRITICAL: Do these immediately after successful setup!**

```bash
# Delete setup scripts
rm api/setup-admin.php
rm api/debug.php

# Verify .htaccess is protecting logs and storage
cat api/logs/.htaccess    # Should contain "Deny from all"
cat api/storage/.htaccess # Should contain "Deny from all"
```

---

## Troubleshooting

### 500 Internal Server Error
1. Check PHP error logs: `tail -f ~/logs/error.log`
2. Run diagnostics: `https://yourdomain.com/api/debug.php`
3. Verify all PHP extensions are installed

### Database Connection Failed
1. Verify credentials in `config.php`
2. Check database user has proper privileges
3. Ensure database exists: `mysql -u user -p -e "SHOW DATABASES;"`

### CORS Errors
1. Add your frontend domain to `cors.origins` in config
2. Include both `https://domain.com` and `https://www.domain.com`

### 404 on API Routes
1. Verify `.htaccess` is uploaded and working
2. Check mod_rewrite is enabled: `a2enmod rewrite`
3. For Nginx, add proper rewrite rules

### Emails Not Receiving
1. Verify IMAP credentials in Admin → Mailboxes
2. Check cron job is running: `crontab -l`
3. Review IMAP logs: `tail -f api/logs/imap-poll.log`

---

## Quick Reference

| Task | Command/URL |
|------|-------------|
| Health check | `curl https://yourdomain.com/api/health` |
| Generate JWT secret | `php -r "echo bin2hex(random_bytes(32));"` |
| Generate bcrypt hash | `php -r "echo password_hash('pass', PASSWORD_BCRYPT);"` |
| Test IMAP manually | `php api/test-imap.php` |
| Test SMTP manually | `php api/test-smtp.php` |
| View PHP errors | `tail -f ~/logs/error.log` |
| Clear OPcache | Touch index.php or restart PHP |

---

## Support

- Documentation: See `SELF-HOSTED-GUIDE.md` for detailed configuration
- Debug info: `https://yourdomain.com/api/debug.php` (delete after use!)
- Health diagnostics: `https://yourdomain.com/api/health/diag?token=YOUR_TOKEN`
