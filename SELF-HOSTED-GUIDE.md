# TempMail Self-Hosted Deployment Guide

Complete guide for deploying TempMail on your own server using the PHP backend (no Supabase/Lovable Cloud required).

---

## 📋 Requirements

### Server Requirements
- **PHP 8.0+** with extensions: `pdo_mysql`, `mbstring`, `json`, `openssl`, `imap` (optional for email receiving)
- **MySQL 5.7+** or MariaDB 10.3+
- **Apache** with `mod_rewrite` enabled, or **Nginx**
- **SSL Certificate** (required for production)

### Optional
- **SMTP Server** for sending emails (verification, password reset)
- **IMAP Server** for receiving emails into temp mailboxes

---

## 🚀 Quick Installation (Recommended)

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

This creates a `cpanel-package.zip` with:
- Frontend files (upload to web root)
- PHP backend (upload to `/api` folder)

### Step 2: Upload Files

**For cPanel:**
1. Upload and extract `cpanel-package.zip`
2. Move files from `dist/` to `public_html/`
3. Move files from `php-backend/` to `public_html/api/`

**File structure should be:**
```
public_html/
├── index.html
├── assets/
├── api/
│   ├── index.php
│   ├── install.php
│   ├── schema.sql
│   ├── config.example.php
│   ├── routes/
│   ├── includes/
│   ├── cron/
│   └── ...
```

### Step 3: Run the Setup Wizard

1. Navigate to `https://yourdomain.com/api/install.php`
2. Follow the wizard to:
   - Test database connection
   - Create database tables
   - Create admin account
   - Configure SMTP (optional)
   - Configure IMAP (optional)

3. **⚠️ IMPORTANT:** Delete `install.php` after setup!

### Step 4: Configure Frontend Environment

Create `.env` in your project root before building:

```env
# Enable self-hosted mode (REQUIRED)
VITE_SELF_HOSTED=true

# Optional: Custom API URL (defaults to /api on same domain)
# VITE_PHP_API_URL=https://yourdomain.com/api
```

**Note:** If building locally, set these before `npm run build:cpanel`.

### Step 5: Set Up Cron Jobs

Add these cron jobs in cPanel → Cron Jobs:

```bash
# Poll IMAP for new emails (every 2 minutes)
*/2 * * * * /usr/bin/php /home/username/public_html/api/cron/imap-poll.php >> /home/username/logs/imap.log 2>&1

# Run maintenance tasks (daily at 3am)
0 3 * * * /usr/bin/php /home/username/public_html/api/cron/maintenance.php >> /home/username/logs/maintenance.log 2>&1

# Health check (every 5 minutes)
*/5 * * * * /usr/bin/php /home/username/public_html/api/cron/health-check.php >> /home/username/logs/health.log 2>&1
```

Replace `username` with your cPanel username.

### Step 6: Login and Configure

1. Go to `https://yourdomain.com/auth` and login with your admin account
2. Navigate to Admin Panel
3. Add your email domains in Admin → Domains
4. Configure mailboxes in Admin → Mailboxes (for IMAP catch-all)

---

## 🔧 Manual Configuration

If the wizard fails, configure manually:

### Create config.php

Copy `api/config.example.php` to `api/config.php` and update:

```php
<?php
// Database constants (REQUIRED for cron scripts)
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

### Import Database Schema

```bash
mysql -u username -p database_name < api/schema.sql
```

Or use phpMyAdmin to import `api/schema.sql`.

### Create First Admin User

Using MySQL/phpMyAdmin:

```sql
-- Create user (password: changeme123)
INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
VALUES (UUID(), 'admin@yourdomain.com', 
        '$2y$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.TuJF3GmJN0Ot26', 
        'Admin', NOW(), NOW());

-- Get the user ID
SET @user_id = (SELECT id FROM users WHERE email = 'admin@yourdomain.com');

-- Create profile
INSERT INTO profiles (id, user_id, email, display_name, email_verified, created_at, updated_at)
VALUES (UUID(), @user_id, 'admin@yourdomain.com', 'Admin', 1, NOW(), NOW());

-- Assign admin role
INSERT INTO user_roles (id, user_id, role, created_at)
VALUES (UUID(), @user_id, 'admin', NOW());
```

**⚠️ Change your password immediately after logging in!**

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
   - **Receiving Email:** `*@yourdomain.com` (for catch-all)

### DNS Records Required

| Type | Name | Value | Priority |
|------|------|-------|----------|
| MX | @ | mail.yourdomain.com | 10 |
| A | mail | YOUR_SERVER_IP | - |
| TXT | @ | v=spf1 mx ~all | - |
| TXT | _dmarc | v=DMARC1; p=none | - |

### cPanel Catch-All Setup

1. Email → Email Routing → Set "Local Mail Exchanger"
2. Email → Default Address → Set catch-all to your inbox email
3. Email → Forwarders → Create forwarder if needed

---

## ✅ Deployment Verification Checklist

After uploading new files, use this checklist to verify the deployment is correct.

### Step 1: Verify Files Are Updated

Check the health endpoint for the version stamp:

```bash
curl https://yourdomain.com/api/health
```

Expected response (look for `selfhost_version`):
```json
{
  "status": "ok",
  "timestamp": "2026-01-09T00:00:00+00:00",
  "version": "1.0.0",
  "selfhost_version": "2026-01-09-v2",
  "php_version": "8.2.0",
  "config_present": true,
  "db_connected": true
}
```

**If `selfhost_version` is missing or shows an old date:**
- Your server is running cached/old files
- See "Clearing PHP OPcache" section below

### Step 2: Check Detailed Diagnostics

```bash
curl "https://yourdomain.com/api/health/diag?token=YOUR_DIAG_TOKEN"
```

This shows:
- PHP extensions loaded
- Database connectivity
- File permissions
- IMAP/SMTP status

### Step 3: Test Core Endpoints

| Endpoint | Expected Result |
|----------|----------------|
| `/api/health` | JSON with `status: ok` |
| `/api/auth/session` | JSON (may show `null` if not logged in) |
| `/api/data/domains` | JSON list of domains (or auth error) |

### Step 4: Verify No PHP Errors

Check the error logs:
```bash
# Via SSH
tail -f public_html/api/logs/error-*.log

# Or via browser (admin only)
curl "https://yourdomain.com/api/logs/errors?token=YOUR_DIAG_TOKEN"
```

**Common errors and fixes:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot redeclare function()` | Duplicate function in multiple files | Update to latest version |
| `Unmatched '}'` | Syntax error in PHP file | Update to latest version |
| `Class not found` | Missing include/require | Check file paths |

### Step 5: Test Admin Functions

1. Login as admin at `/auth`
2. Go to Admin → Mailboxes
3. Click "Test Connection" on any mailbox
4. Go to Admin → Backups → Generate Backup

---

## 🔄 Clearing PHP OPcache

If your server caches PHP files (most shared hosting does), changes may not reflect immediately.

### Option 1: Wait
OPcache typically refreshes every 2-5 minutes.

### Option 2: Restart PHP (cPanel)
1. Go to cPanel → MultiPHP Manager
2. Click on your domain
3. Click "Restart PHP"

### Option 3: Touch Files
SSH to your server and run:
```bash
find public_html/api -name "*.php" -exec touch {} \;
```

### Option 4: Add OPcache Reset Endpoint (Advanced)

Create `api/opcache-reset.php` (delete after use!):
```php
<?php
// WARNING: Delete this file after use!
$token = $_GET['token'] ?? '';
if ($token !== 'YOUR_SECRET_TOKEN') {
    http_response_code(403);
    die('Forbidden');
}
if (function_exists('opcache_reset')) {
    opcache_reset();
    echo "OPcache cleared!";
} else {
    echo "OPcache not available";
}
```

Access: `https://yourdomain.com/api/opcache-reset.php?token=YOUR_SECRET_TOKEN`

---

## 📋 Pre-Upload Checklist

Before uploading new files:

- [ ] Backup `api/config.php` (it contains your credentials)
- [ ] Note current `selfhost_version` from `/api/health`
- [ ] Download latest release/build

After uploading:

- [ ] Verify `selfhost_version` has changed in `/api/health`
- [ ] Check `/api/logs/errors` for any new errors
- [ ] Test admin login
- [ ] Test creating a temp email
- [ ] Test IMAP fetch (Admin → Mailboxes → Fetch Emails)

---

## 🔒 Security Checklist

- [ ] SSL certificate installed and HTTPS forced
- [ ] `install.php` deleted after setup
- [ ] Strong JWT secret (64+ characters)
- [ ] `config.php` not accessible via web
- [ ] `logs/` directory protected (.htaccess)
- [ ] Database user has minimal permissions
- [ ] Regular backups configured
- [ ] Rate limiting enabled
- [ ] Error display disabled (`display_errors = 0`)

### File Permissions

```bash
chmod 750 api/
chmod 640 api/config.php
chmod 755 api/storage/
chmod 755 api/logs/
```

---

## 🐛 Troubleshooting

### 500 Internal Server Error
1. Check `api/logs/php-errors.log`
2. Check `api/logs/error-*.log`
3. Verify PHP version ≥ 8.0
4. Check file permissions

### CORS Errors
Update `config.php`:
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
5. Check that temp emails haven't expired

### API Returns 404
1. Verify `.htaccess` is present in `/api`
2. Enable `mod_rewrite` in Apache
3. For Nginx, add rewrite rules

---

## 📁 Directory Structure

```
api/
├── index.php           # Main API router
├── config.php          # Your configuration
├── config.example.php  # Configuration template
├── schema.sql          # Database schema
├── install.php         # Setup wizard (DELETE after install!)
├── error-logger.php    # Logging system
├── sse.php             # Real-time events (Server-Sent Events)
├── routes/
│   ├── auth.php        # Authentication
│   ├── data.php        # CRUD operations
│   ├── rpc.php         # RPC functions
│   ├── storage.php     # File uploads
│   ├── functions.php   # Edge function equivalents
│   ├── admin.php       # Admin operations
│   ├── forwarding.php  # Email forwarding
│   ├── attachments.php # File attachments
│   └── webhooks.php    # Webhook handlers
├── includes/
│   ├── db.php          # Database helper
│   └── helpers.php     # Utility functions
├── cron/
│   ├── imap-poll.php   # Email polling (runs every 2 min)
│   ├── maintenance.php # Cleanup tasks (daily)
│   └── health-check.php # Service monitoring
├── storage/
│   ├── avatars/        # User avatars
│   └── attachments/    # Email attachments
└── logs/
    ├── php-errors.log
    ├── error-YYYY-MM-DD.log
    └── imap-poll.log
```

---

## 🔄 Upgrading

1. **Backup** `api/config.php` and database
2. Download new version
3. Run `npm run build:cpanel`
4. Upload new files (don't overwrite `config.php`)
5. Check release notes for schema migrations
6. Clear browser cache

---

## 🌐 API Endpoints Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/session` | Get current session |
| POST | `/api/auth/reset-password` | Request password reset |
| PATCH | `/api/auth/profile` | Update profile |

### Data (CRUD)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data/{table}` | List records |
| POST | `/api/data/{table}` | Create record |
| PATCH | `/api/data/{table}?filter[id]=xxx` | Update record |
| DELETE | `/api/data/{table}?filter[id]=xxx` | Delete record |

### Query Parameters
- `select=column1,column2` - Select specific columns
- `limit=10` - Limit results
- `offset=0` - Pagination offset
- `order=column.asc` or `order=column.desc` - Sorting
- `eq[column]=value` - Equal filter
- `ilike[column]=%value%` - Case-insensitive search

### RPC Functions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rpc/create_temp_email` | Create temporary email |
| POST | `/api/rpc/is_admin` | Check admin status |
| POST | `/api/rpc/check_rate_limit` | Check rate limits |

### Functions (Edge Function Equivalents)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/functions/validate-temp-email` | Validate temp email |
| POST | `/api/functions/get-public-stats` | Get public stats |
| POST | `/api/functions/secure-email-access` | Access with token |
| POST | `/api/functions/fetch-imap-emails` | Trigger IMAP fetch |

### Health & Status
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Basic health check |
| GET | `/api/health/diag?token=xxx` | Detailed diagnostics |
| GET | `/api/public-status` | Public status page data |

---

## 📞 Support

- Check `/api/health/diag` for system status
- Review logs in `api/logs/`
- For issues, check browser console and network tab
