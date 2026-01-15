# TempMail Self-Hosted Deployment Guide

Complete guide for deploying TempMail on your own server using the PHP backend.

---

## 📋 Requirements

### Server Requirements
- **PHP 8.0+** with extensions: `pdo_mysql`, `mbstring`, `json`, `openssl`, `curl`
- **Optional extensions**: `imap` (email receiving), `gd` (images), `zip` (backups)
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

**IMPORTANT**: The build process MUST be run with the correct environment to ensure the frontend uses the PHP backend instead of Cloud.

```bash
# Clone the repository
git clone <your-repo-url>
cd tempmail

# Install dependencies
npm install

# Option A: Use the automated packager (RECOMMENDED)
node scripts/cpanel-package.mjs --zip

# Option B: Manual build with self-hosted flag
VITE_SELF_HOSTED=true npm run build
```

**The packager script automatically:**
- Sets `VITE_SELF_HOSTED=true` for the build
- Validates PHP syntax
- Creates the proper folder structure
- Generates a ready-to-upload .tar.gz archive

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
    ├── requirements-check.php
    ├── verify-installation.php
    ├── schema.sql
    ├── config.example.php
    ├── routes/
    ├── includes/
    ├── cron/
    └── ...
```

### Step 3: Check System Requirements

**Before installation**, verify your server meets all requirements:

```
https://yourdomain.com/api/requirements-check.php
```

This checks:
- ✅ PHP version and configuration
- ✅ Required and optional extensions
- ✅ Filesystem permissions
- ✅ Server configuration
- ✅ Required PHP functions

**Fix any critical issues before proceeding!**

### Step 4: Run the Setup Wizard

1. Navigate to `https://yourdomain.com/api/install.php`
2. Follow the wizard to:
   - **Step 1**: Test database connection and create tables
   - **Step 2**: Create admin account with password strength indicator
   - **Step 3**: View success and next steps

3. **⚠️ CRITICAL: Delete installation files after setup!**

### Step 5: Verify Installation

After setup, run the verification script:

```
https://yourdomain.com/api/verify-installation.php?format=html
```

This checks:
- ✅ All 35+ database tables created
- ✅ Admin account exists
- ✅ File permissions correct
- ✅ Security configuration
- ✅ API endpoints working

### Step 6: Post-Installation Security

```bash
# Delete installation files immediately!
rm public_html/api/install.php
rm public_html/api/requirements-check.php
rm public_html/api/verify-installation.php
```

### Step 7: Set Up Cron Jobs

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

### Step 8: Login and Configure

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
return [
    'db' => [
        'host' => 'localhost',
        'name' => 'your_database',
        'user' => 'your_username',
        'pass' => 'your_password',
        'charset' => 'utf8mb4'
    ],
    'jwt' => [
        'secret' => 'generate-a-64-character-random-string-here',
        'expiry' => 604800  // 7 days
    ],
    'cors' => [
        'origins' => ['https://yourdomain.com', 'https://www.yourdomain.com'],
        'methods' => ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        'headers' => ['Content-Type', 'Authorization']
    ],
    'smtp' => [
        'host' => 'mail.yourdomain.com',
        'port' => 587,
        'user' => 'noreply@yourdomain.com',
        'pass' => 'your-smtp-password',
        'from' => 'noreply@yourdomain.com'
    ],
    'imap' => [
        'host' => 'mail.yourdomain.com',
        'port' => 993,
        'user' => 'catchall@yourdomain.com',
        'pass' => 'your-imap-password'
    ],
    'google' => [
        'client_id' => '',      // For GSC integration
        'client_secret' => ''
    ],
    'stripe' => [
        'publishable_key' => '',
        'secret_key' => '',
        'webhook_secret' => ''
    ],
    'paypal' => [
        'client_id' => '',
        'client_secret' => '',
        'mode' => 'sandbox'  // or 'live'
    ],
    'recaptcha' => [
        'site_key' => '',
        'secret_key' => ''
    ],
    'storage' => [
        'path' => __DIR__ . '/storage',
        'max_size' => 10485760  // 10MB
    ],
    'diag_token' => ''  // Generate with: bin2hex(random_bytes(16))
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
| TXT | @ | v=spf1 mx a ~all | - |
| TXT | _dmarc | v=DMARC1; p=none; rua=mailto:admin@yourdomain.com | - |

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

### Post-Installation
- [ ] Delete `install.php`
- [ ] Delete `requirements-check.php`
- [ ] Delete `verify-installation.php`
- [ ] Verify JWT secret is 64+ characters
- [ ] Update CORS origins in config.php

### File Permissions
```bash
chmod 755 api/
chmod 600 api/config.php
chmod 755 api/storage/
chmod 755 api/logs/
```

### General Security
- [ ] SSL certificate installed and HTTPS forced
- [ ] Database user has minimal permissions
- [ ] Regular backups configured
- [ ] Rate limiting enabled
- [ ] Error display disabled (`display_errors = 0`)

---

## 🐛 Troubleshooting

### Pre-Installation Tools

| Tool | URL | Purpose |
|------|-----|---------|
| Requirements Check | `/api/requirements-check.php` | Verify server meets requirements |
| Installation Wizard | `/api/install.php` | Setup database and admin |
| Verify Installation | `/api/verify-installation.php?format=html` | Check everything works |

**Note**: `verify-installation.php` access methods:
- From localhost (no token needed)
- With `?token=YOUR_DIAG_TOKEN` (set in config.php)
- During first-time setup (before admin is created)

### Health Endpoints

```bash
# Basic health check
curl https://yourdomain.com/api/health

# Detailed diagnostics (requires token)
curl "https://yourdomain.com/api/health/diag?token=YOUR_DIAG_TOKEN"
```

### Common Issues

| Issue | Solution |
|-------|----------|
| **Frontend shows 404 errors for API calls** | You built without `VITE_SELF_HOSTED=true`. Rebuild using `node scripts/cpanel-package.mjs` |
| **"Failed to load domains"** | Same as above - rebuild frontend with packager script |
| 500 Internal Server Error | Check `api/logs/php-errors.log`, verify PHP ≥ 8.0 |
| CORS Errors | Update `cors.origins` in config.php with your domain |
| Login Not Working | Verify JWT secret, check browser console, clear localStorage |
| Emails Not Received | Check mailbox config, verify IMAP creds, check cron running |
| API Returns 404 | Verify `.htaccess` exists, enable mod_rewrite |
| Database Connection Failed | Check credentials in config.php, verify MySQL running |

### How to Verify Backend Mode

Open browser console (F12) and look for this message:
- `[API] Backend mode: Self-hosted (PHP)` ✅ Correct for self-hosting
- `[API] Backend mode: Cloud (Supabase)` ❌ Wrong - need to rebuild

If you see "Cloud (Supabase)" but you're self-hosting, **rebuild the frontend**:

```bash
# Delete old build and rebuild
rm -rf dist cpanel-package
node scripts/cpanel-package.mjs --zip

# Upload the new package to your server
```

---

## 📁 Directory Structure

```
api/
├── index.php               # Main API router
├── config.php              # Your configuration
├── schema.sql              # Database schema (35+ tables)
├── error-logger.php        # Error logging system
├── sse.php                 # Server-sent events
├── routes/
│   ├── auth.php            # Authentication
│   ├── data.php            # CRUD operations
│   ├── rpc.php             # RPC functions
│   ├── functions.php       # Edge function equivalents
│   ├── admin.php           # Admin operations
│   ├── seo.php             # SEO routes (sitemap, ping)
│   ├── storage.php         # File uploads
│   ├── forwarding.php      # Email forwarding
│   ├── attachments.php     # Email attachments
│   ├── webhooks.php        # Payment webhooks
│   ├── logs.php            # Log viewing
│   └── google-search-console.php
├── includes/
│   ├── db.php              # Database helper
│   └── helpers.php         # Utility functions
├── cron/
│   ├── imap-poll.php       # Email polling (every 2 min)
│   ├── maintenance.php     # Cleanup tasks (hourly)
│   └── health-check.php    # System monitoring (6 hourly)
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
- Requirements: `https://yourdomain.com/api/requirements-check.php`
