# TempMail - Self-Hosted Temporary Email Service

A complete self-hosted temporary email solution with React frontend and PHP backend. Generate instant, anonymous email addresses for sign-ups, testing, and keeping your real inbox spam-free.

## Features

### Core Features
- **Temporary Email Generation** - Create disposable email addresses instantly
- **Real-time Inbox** - Server-Sent Events (SSE) for instant email notifications
- **Multi-Domain Support** - Add unlimited custom domains
- **Email Forwarding** - Forward emails to your real address (Premium)
- **QR Code Sharing** - Share email addresses via QR codes
- **Email History** - Track all received emails

### Admin Features
- **Complete Admin Dashboard** - Manage all aspects of your instance
- **User Management** - Create, suspend, and manage users
- **Domain Management** - Add and configure email domains
- **Mailbox Configuration** - IMAP/SMTP setup for multiple mailboxes
- **Subscription Tiers** - Configure pricing and features
- **SEO Management** - Full SEO control with sitemap generation
- **Analytics & Logs** - Detailed email logs and statistics

### Premium Features
- **Extended Email Expiry** - Up to 168 hours (1 week)
- **Email Forwarding** - Automatic forwarding to real email
- **Custom Domains** - Use your own domains
- **API Access** - Full REST API access
- **Priority Support** - Premium support queue
- **AI Email Summaries** - AI-powered email summaries

### Security Features
- **Two-Factor Authentication (2FA)** - TOTP-based 2FA
- **IP Blocking** - Block abusive IP addresses
- **Email Pattern Blocking** - Block specific email patterns
- **Country Blocking** - Geo-based access control
- **Rate Limiting** - Prevent abuse with rate limits
- **SSL/HTTPS Required** - Secure all connections

---

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

---

## cPanel Deployment Guide

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| PHP | 8.0+ | 8.2+ |
| MySQL | 8.0+ | 8.0+ |
| Memory | 128MB | 256MB |
| Storage | 500MB | 2GB+ |
| SSL | Required | Required |

**Required PHP Extensions:**
- pdo, pdo_mysql (database)
- openssl (encryption)
- mbstring (string handling)
- json (API responses)
- curl (HTTP requests)

**Optional PHP Extensions:**
- imap (email receiving)
- gd (image processing)
- zip (backup exports)
- fileinfo (file type detection)

### Step 1: Build the Package

```bash
# Clone or download the repository
git clone https://github.com/your-repo/tempmail.git
cd tempmail

# Install dependencies
npm install

# Build the cPanel package
npm run build && node scripts/cpanel-package.mjs
```

This creates a `cpanel-package/` directory with everything ready for upload.

### Step 2: Create MySQL Database

1. Login to cPanel
2. Go to **MySQL® Databases**
3. Create a new database (e.g., `username_tempmail`)
4. Create a new user with a strong password
5. Add user to database with **ALL PRIVILEGES**
6. Note down: database name, username, password

### Step 3: Upload Files

**Option A: Using File Manager**
1. Go to **File Manager** in cPanel
2. Navigate to `public_html` (or your domain's root)
3. Upload `cpanel-package/public_html/*` contents
4. Extract if you uploaded as ZIP

**Option B: Using FTP**
```bash
# Connect via FTP/SFTP
# Upload cpanel-package/public_html/* to public_html/
```

**Final structure:**
```
public_html/
├── index.html          # React app
├── assets/             # JS/CSS files
├── .htaccess           # SPA routing
└── api/
    ├── index.php       # API router
    ├── install.php     # Setup wizard
    ├── requirements-check.php  # System checker
    ├── verify-installation.php # Post-install verification
    ├── config.example.php
    ├── schema.sql
    ├── routes/
    ├── includes/
    └── cron/
```

### Step 4: Check System Requirements

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

### Step 5: Run Installation Wizard

1. Visit: `https://yourdomain.com/api/install.php`
2. **Step 1**: Enter MySQL credentials
   - Click "Test Connection" to verify before submitting
   - Host: `localhost`
   - Database: `username_tempmail`
   - Username: Your MySQL username
   - Password: Your MySQL password
3. **Step 2**: Create admin account
   - Enter email and a strong password
   - Password strength indicator shows requirements
4. **Step 3**: Installation complete!

### Step 6: Verify Installation

After installation, run the verification script:

```
https://yourdomain.com/api/verify-installation.php?format=html
```

This checks:
- ✅ PHP version and extensions
- ✅ Database connection and all tables
- ✅ Admin account exists
- ✅ File permissions
- ✅ Security configuration
- ✅ Email configuration

### Step 7: Post-Installation Security

**CRITICAL: Delete installation files!**
```bash
# Via File Manager or SSH:
rm public_html/api/install.php
rm public_html/api/requirements-check.php
rm public_html/api/verify-installation.php
```

**Update CORS in config.php:**
```php
'cors' => [
    'origins' => ['https://yourdomain.com'],
    // ...
],
```

**Set file permissions:**
```bash
# Directories: 755
find public_html -type d -exec chmod 755 {} \;

# Files: 644
find public_html -type f -exec chmod 644 {} \;

# Config file: 600 (more restrictive)
chmod 600 public_html/api/config.php
```

### Step 8: Configure Cron Jobs

In cPanel → **Cron Jobs**, add:

| Schedule | Command |
|----------|---------|
| `*/2 * * * *` | `/usr/bin/php /home/USERNAME/public_html/api/cron/imap-poll.php` |
| `0 * * * *` | `/usr/bin/php /home/USERNAME/public_html/api/cron/maintenance.php` |
| `0 */6 * * *` | `/usr/bin/php /home/USERNAME/public_html/api/cron/health-check.php` |

Replace `USERNAME` with your cPanel username.

### Step 9: Email Domain Setup

#### Add Domain in Admin Panel
1. Login to your app at `https://yourdomain.com`
2. Go to **Admin → Domains**
3. Add your domain (e.g., `tempmail.yourdomain.com`)

#### Create Catch-All Email in cPanel
1. Go to **Email Accounts** in cPanel
2. Create: `catchall@yourdomain.com`
3. Go to **Default Address** (Email Routing)
4. Set "all unrouted mail" to forward to `catchall@yourdomain.com`

#### Configure Mailbox in Admin Panel
1. Go to **Admin → Mailboxes**
2. Add new mailbox:
   - **IMAP Host**: `mail.yourdomain.com`
   - **IMAP Port**: `993`
   - **IMAP User**: `catchall@yourdomain.com`
   - **IMAP Password**: Your email password
   - **SMTP Host**: `mail.yourdomain.com`
   - **SMTP Port**: `587`

#### DNS Records
Add these DNS records for your domain:

| Type | Name | Value | Priority |
|------|------|-------|----------|
| MX | @ | `mail.yourdomain.com` | 10 |
| A | mail | `YOUR_SERVER_IP` | - |
| TXT | @ | `v=spf1 mx a ~all` | - |
| TXT | _dmarc | `v=DMARC1; p=none; rua=mailto:admin@yourdomain.com` | - |

### Step 10: Test Everything

1. **Create temp email**: Use the app to create a temporary email
2. **Send test email**: Send an email to the temp address
3. **Check inbox**: Wait 2 minutes (cron interval) for email to appear
4. **Health check**: Visit `/api/health`

---

## Configuration Reference

### config.php

The installer creates this automatically. Key sections:

```php
return [
    // Database
    'db' => [
        'host' => 'localhost',
        'name' => 'database_name',
        'user' => 'database_user',
        'pass' => 'database_password',
        'charset' => 'utf8mb4',
    ],
    
    // JWT (auto-generated during install)
    'jwt' => [
        'secret' => 'auto-generated-64-char-secret',
        'expiry' => 604800, // 7 days
    ],
    
    // CORS - UPDATE THIS!
    'cors' => [
        'origins' => ['https://yourdomain.com'],
        'methods' => ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        'headers' => ['Content-Type', 'Authorization'],
    ],
    
    // Optional: Payment gateways (configure via Admin Panel)
    'stripe' => [...],
    'paypal' => [...],
    
    // Optional: reCAPTCHA
    'recaptcha' => [
        'site_key' => '',
        'secret_key' => '',
    ],
    
    // Diagnostics token (for /api/health/diag)
    'diag_token' => 'your-secret-token',
];
```

---

## Database Schema

The installation creates 35+ tables including:

| Table | Purpose |
|-------|---------|
| `users` | User accounts |
| `profiles` | User profile data |
| `user_roles` | Admin/moderator roles |
| `domains` | Email domains |
| `temp_emails` | Temporary email addresses |
| `received_emails` | Received messages |
| `email_attachments` | Email attachments |
| `mailboxes` | IMAP/SMTP configurations |
| `subscription_tiers` | Pricing plans |
| `user_subscriptions` | User subscriptions |
| `email_stats` | Usage statistics |
| `email_logs` | Email sending logs |
| `blocked_ips` | IP blocklist |
| `blocked_emails` | Email pattern blocklist |
| `blocked_countries` | Country blocklist |
| `user_2fa` | Two-factor auth |
| `admin_audit_logs` | Admin activity logs |

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/session` | Get current session |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |

### Temporary Emails

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rpc/create_temp_email` | Create temporary email |
| GET | `/api/data/temp_emails` | List user's temp emails |
| GET | `/api/data/received_emails` | Get received emails |
| PATCH | `/api/data/received_emails` | Mark as read |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data/domains` | List domains |
| POST | `/api/data/domains` | Add domain |
| GET | `/api/data/mailboxes` | List mailboxes |
| POST | `/api/data/mailboxes` | Add mailbox |
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/suspend` | Suspend user |

### Health & Diagnostics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Basic health check |
| GET | `/api/health/diag?token=xxx` | Detailed diagnostics |

### Pre-Installation Tools

| File | Purpose |
|------|---------|
| `/api/requirements-check.php` | System requirements checker |
| `/api/install.php` | Installation wizard |
| `/api/verify-installation.php` | Post-installation verification |

---

## Directory Structure

```
public_html/
├── index.html              # React app entry
├── .htaccess               # SPA routing
├── assets/                 # Built assets
├── robots.txt
├── sitemap.xml
└── api/
    ├── index.php           # Main API router
    ├── config.php          # Your configuration
    ├── config.example.php  # Example configuration
    ├── schema.sql          # Database schema
    ├── error-logger.php    # Error logging
    ├── sse.php             # Server-sent events
    ├── routes/
    │   ├── auth.php        # Authentication
    │   ├── data.php        # CRUD operations
    │   ├── rpc.php         # RPC functions
    │   ├── functions.php   # Edge function equivalents
    │   ├── admin.php       # Admin operations
    │   ├── seo.php         # SEO & sitemap
    │   ├── storage.php     # File storage
    │   ├── forwarding.php  # Email forwarding
    │   ├── attachments.php # Attachments handling
    │   ├── webhooks.php    # Webhook handlers
    │   ├── logs.php        # Log viewing
    │   └── google-search-console.php
    ├── includes/
    │   ├── db.php          # Database helper
    │   └── helpers.php     # Utility functions
    ├── cron/
    │   ├── imap-poll.php   # Email polling (every 2 min)
    │   ├── maintenance.php # Cleanup (hourly)
    │   └── health-check.php # Health (every 6 hours)
    ├── storage/
    │   ├── avatars/
    │   └── attachments/
    └── logs/
```

---

## Security Checklist

### Post-Installation
- [ ] Delete `install.php`
- [ ] Delete `requirements-check.php`
- [ ] Delete `verify-installation.php`
- [ ] Verify JWT secret is auto-generated (64+ characters)
- [ ] Update CORS origins in config.php

### File Permissions
- [ ] Directories: 755
- [ ] Files: 644
- [ ] config.php: 600

### Server Configuration
- [ ] HTTPS enabled (redirect HTTP to HTTPS)
- [ ] Error display disabled in production
- [ ] `.htaccess` working properly

### Application Settings
- [ ] Rate limiting enabled (Admin Panel)
- [ ] Admin alerts configured (Admin Panel)
- [ ] Regular backups configured
- [ ] Email domains added
- [ ] Mailboxes configured

---

## Cron Jobs Reference

| Job | Schedule | Command | Purpose |
|-----|----------|---------|---------|
| IMAP Poll | `*/2 * * * *` | `php api/cron/imap-poll.php` | Fetch new emails |
| Maintenance | `0 * * * *` | `php api/cron/maintenance.php` | Cleanup expired data |
| Health Check | `0 */6 * * *` | `php api/cron/health-check.php` | Monitor system health |

---

## Troubleshooting

### Common Issues

**500 Internal Server Error**
- Check `api/logs/php-errors.log`
- Verify PHP version ≥ 8.0: `php -v`
- Check file permissions: folders 755, files 644

**Emails Not Being Received**
- Verify IMAP credentials in Admin → Mailboxes
- Check cron jobs are running: `crontab -l`
- Verify MX records point to your server
- Test IMAP connection in Admin → Mailboxes → Test

**Login Not Working**
- Verify JWT secret exists in config.php
- Check database connection
- Clear browser localStorage
- Check for JavaScript errors in browser console

**React App Shows Blank Page**
- Check `.htaccess` exists in public_html
- Verify mod_rewrite is enabled
- Check browser console for errors

**Database Connection Failed**
- Verify MySQL credentials in config.php
- Check MySQL server is running
- Verify database exists

### Debug Commands

```bash
# Health check
curl https://yourdomain.com/api/health

# Detailed diagnostics (requires token from config.php)
curl "https://yourdomain.com/api/health/diag?token=YOUR_DIAG_TOKEN"

# System requirements
curl "https://yourdomain.com/api/requirements-check.php?format=json"

# Installation verification
curl "https://yourdomain.com/api/verify-installation.php"

# Test IMAP manually
php public_html/api/test-imap.php

# Test SMTP manually  
php public_html/api/test-smtp.php
```

---

## Upgrading

1. **Backup first!**
   ```bash
   # Backup config
   cp api/config.php api/config.php.backup
   
   # Backup database
   mysqldump -u user -p database_name > backup.sql
   ```

2. Download latest release

3. Upload new files (except `config.php`)

4. Check release notes for schema changes

5. Run any required migrations

---

## Environment Variables

For custom builds:

```env
# Required for self-hosted
VITE_SELF_HOSTED=true

# Optional: Custom API URL (defaults to /api)
VITE_PHP_API_URL=https://yourdomain.com/api
```

---

## License

MIT License - See LICENSE file for details.

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

- [Documentation](./docs/)
- [Issue Tracker](https://github.com/your-repo/tempmail/issues)
- [Changelog](./CHANGELOG.md)
