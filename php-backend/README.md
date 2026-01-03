# TempMail Self-Hosted PHP Backend

Complete self-hosted solution for the TempMail application using PHP/MySQL on cPanel hosting.

## 🚀 Quick Start (5 Minutes)

```bash
# 1. Build the deployment package
npm install
node scripts/cpanel-package.mjs --out cpanel-package

# 2. Upload cpanel-package/public_html/* to your cPanel public_html/

# 3. Run the setup wizard
# Visit: https://yourdomain.com/api/install.php

# 4. Add cron jobs (in cPanel → Cron Jobs)
*/2 * * * * /usr/bin/php /home/username/public_html/api/cron/imap-poll.php
0 * * * * /usr/bin/php /home/username/public_html/api/cron/maintenance.php

# 5. Delete install.php after setup!
rm public_html/api/install.php
```

That's it! Your temp email service is now running.

---

## Requirements

- PHP 8.0+ with extensions: `pdo_mysql`, `openssl`, `mbstring`, `imap`, `json`, `curl`
- MySQL 8.0+
- cPanel hosting or any Apache server with mod_rewrite
- SSL certificate (required for secure authentication)

## File Structure

After deploying, your cPanel `public_html/` should look like this:

```
public_html/
├── index.html              # React app entry point
├── .htaccess               # SPA routing rules
├── assets/                 # Vite-built JS/CSS assets
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── ...
├── robots.txt
├── sitemap.xml
├── sw.js                   # Service worker
│
└── api/                    # PHP Backend (this folder)
    ├── index.php           # Main API router
    ├── .htaccess           # API rewrite rules + security
    ├── install.php         # Interactive setup wizard
    ├── config.php          # Your DB/SMTP/JWT settings (auto-generated)
    ├── config.example.php  # Template config file
    ├── schema.sql          # Database schema
    ├── sse.php             # Server-Sent Events for realtime
    ├── test-smtp.php       # SMTP connection tester
    ├── test-imap.php       # IMAP connection tester
    ├── health-dashboard.php # System health monitor
    ├── analytics.php       # Analytics dashboard
    ├── cron-manager.php    # Cron job manager
    ├── settings.php        # Admin settings API
    ├── error-logger.php    # Comprehensive error logging system
    ├── routes/
    │   ├── auth.php        # Authentication endpoints
    │   ├── data.php        # Database CRUD operations
    │   ├── rpc.php         # RPC function calls
    │   ├── storage.php     # File upload/download
    │   ├── functions.php   # Edge function equivalents
    │   ├── admin.php       # Admin panel endpoints (includes DNS verification)
    │   ├── webhooks.php    # Stripe/PayPal payment webhooks
    │   ├── logs.php        # Admin error logs API
    │   ├── forwarding.php  # Email forwarding API
    │   └── attachments.php # Email attachments API
    ├── logs/               # Error and application logs (auto-created)
    └── cron/
        ├── imap-poll.php   # Fetch emails via IMAP (runs every 1-2 minutes)
        └── maintenance.php # Cleanup expired emails
```

## Quick Start Installation

### Step 1: Upload Files

1. Download the deployment package or build locally:
   ```bash
   npm install
   node scripts/cpanel-package.mjs --out cpanel-package
   ```

2. Upload contents of `cpanel-package/public_html/` to your cPanel `public_html/` folder

### Step 2: Run Setup Wizard

1. Visit `https://yourdomain.com/api/install.php`
2. The wizard will guide you through:
   - **Database Configuration**: Enter your MySQL credentials
   - **Admin Account**: Create your first admin user
   - **Email Settings**: Configure SMTP and IMAP

3. **IMPORTANT**: Delete `install.php` after setup for security!

### Step 3: Configure Cron Jobs

In cPanel → Cron Jobs, add these entries:

```bash
# Poll IMAP for new emails every 1-2 minutes (fast polling for quick email delivery)
*/2 * * * * /usr/bin/php /home/username/public_html/api/cron/imap-poll.php >> /home/username/logs/imap-poll.log 2>&1

# For even faster polling (every minute):
# * * * * * /usr/bin/php /home/username/public_html/api/cron/imap-poll.php >> /home/username/logs/imap-poll.log 2>&1

# Cleanup expired emails every hour
0 * * * * /usr/bin/php /home/username/public_html/api/cron/maintenance.php >> /home/username/logs/maintenance.log 2>&1
```

Replace `/home/username/` with your actual cPanel home directory path.

### Step 4: Add Email Domain

1. Log in as admin at `https://yourdomain.com/auth`
2. Go to Admin Panel → Domains
3. Add your email domain (e.g., `yourdomain.com`)

### Step 5: Configure Mailbox

1. Go to Admin Panel → IMAP Settings
2. Add your cPanel email account credentials
3. Click "Test Connection" to verify

## Authentication & Login

### Admin Login URL

Access the admin panel at: `https://yourdomain.com/auth`

### First Admin Setup

The setup wizard automatically creates your first admin account. If you need to manually create an admin:

```sql
-- First, check if user exists
SELECT id, email FROM users WHERE email = 'your@email.com';

-- Add admin role
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM users WHERE email = 'your@email.com';
```

### Login Troubleshooting

**Issue: /auth page not loading or showing errors**

1. **Check .htaccess routing**:
   ```
   public_html/.htaccess must contain SPA routing rules
   ```

2. **Verify config.php exists**:
   ```bash
   ls -la public_html/api/config.php
   ```

3. **Check PHP error logs**:
   ```bash
   tail -f /home/username/logs/error.log
   ```

4. **Test API health**:
   ```bash
   curl https://yourdomain.com/api/health
   ```

5. **Clear browser cache** and try incognito mode

**Issue: Invalid credentials when logging in**

1. Verify the user exists in database:
   ```sql
   SELECT id, email, password_hash FROM users WHERE email = 'your@email.com';
   ```

2. Reset password via setup wizard or manually:
   ```sql
   UPDATE users SET password_hash = '$2y$10$...' WHERE email = 'your@email.com';
   ```
   (Generate hash with PHP: `password_hash('newpassword', PASSWORD_DEFAULT)`)

## DNS Verification for Custom Domains

The admin panel includes automated DNS verification that checks:

- **MX Records** - Required for receiving emails
- **SPF Records** - Improves email deliverability
- **DKIM Records** - Email authentication
- **DMARC Records** - Email policy
- **NS Records** - Domain ownership

### How to Use

1. Go to Admin Panel → Domains
2. Add your custom domain
3. Click "Verify DNS" to check all records
4. Green checkmarks indicate properly configured records
5. Domain is automatically enabled once MX records are verified

### Required DNS Records for Email

| Type | Name | Value | Priority |
|------|------|-------|----------|
| MX | @ | mail.yourdomain.com | 10 |
| A | mail | Your server IP | - |
| TXT | @ | v=spf1 +a +mx ~all | - |
| TXT | _dmarc | v=DMARC1; p=none | - |

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/session` | Get current session |
| POST | `/api/auth/reset-password` | Request password reset |
| POST | `/api/auth/update-password` | Update password |
| PATCH | `/api/auth/profile` | Update profile |

### Database Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data/{table}` | Query table |
| POST | `/api/data/{table}` | Insert data |
| PATCH | `/api/data/{table}` | Update data |
| DELETE | `/api/data/{table}` | Delete data |
| POST | `/api/data/{table}/upsert` | Upsert data |

### Admin Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/health` | Mailbox health dashboard |
| GET | `/api/admin/cron-logs` | Cron job execution logs |
| POST | `/api/admin/dns-verify` | Verify domain DNS |
| POST | `/api/admin/settings` | Save admin settings |

### Functions (Edge Function Equivalents)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/functions/send-test-email` | Send test email |
| POST | `/api/functions/send-verification-email` | Send verification |
| POST | `/api/functions/fetch-imap-emails` | Fetch emails manually |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Check API status |

## Performance Optimization

### Fast Email Polling

The IMAP polling is optimized for speed:
- Runs every minute via cron
- Uses `SINCE` filter to only fetch new emails
- Batch processes emails efficiently
- Automatically reconnects on failures

### Database Optimization

```sql
-- Add indexes for faster queries
CREATE INDEX idx_temp_emails_address ON temp_emails(address);
CREATE INDEX idx_temp_emails_expires ON temp_emails(expires_at);
CREATE INDEX idx_received_emails_temp ON received_emails(temp_email_id);
CREATE INDEX idx_received_emails_date ON received_emails(received_at);
```

## Security Checklist

- [x] `.htaccess` blocks access to sensitive files
- [x] Rate limiting on all endpoints
- [x] IP blocking for repeated failures
- [x] Input sanitization on all inputs
- [x] SQL injection prevention (PDO prepared statements)
- [x] XSS prevention (output encoding)
- [x] CSRF token validation
- [x] Secure password hashing (bcrypt)
- [x] JWT token authentication
- [x] HTTPS enforced

### Post-Installation Security

1. **Delete install.php**:
   ```bash
   rm public_html/api/install.php
   ```

2. **Set proper file permissions**:
   ```bash
   find public_html -type f -exec chmod 644 {} \;
   find public_html -type d -exec chmod 755 {} \;
   chmod 600 public_html/api/config.php
   ```

3. **Generate strong JWT secret** (64+ characters):
   ```bash
   openssl rand -base64 48
   ```

4. **Enable HTTPS only** in config.php:
   ```php
   'force_https' => true,
   ```

5. **Configure CORS origins**:
   ```php
   'cors_origins' => ['https://yourdomain.com'],
   ```

## Troubleshooting

### Quick Diagnostics

Use the built-in diagnostics endpoint to quickly identify issues:

```bash
# Basic health check (works without config)
curl https://yourdomain.com/api/health

# Comprehensive diagnostics (requires diag_token in config.php)
curl "https://yourdomain.com/api/health/diag?token=YOUR_DIAG_TOKEN"
```

**Diagnostics endpoint checks:**
- ✅ PHP version and extensions (pdo_mysql, openssl, mbstring, json, imap, curl)
- ✅ Directory permissions (logs/, storage/)
- ✅ Database connectivity and all 32 required tables
- ✅ SMTP/IMAP server reachability
- ✅ Configuration completeness

**Enable diagnostics token:**
```php
// In config.php, add:
'diag_token' => 'your-secret-token-here',
```

### Homepage Not Loading

1. Verify `.htaccess` exists in `public_html/`
2. Check that `mod_rewrite` is enabled
3. Verify `index.html` exists in `public_html/`
4. Run diagnostics: `curl https://yourdomain.com/api/health`

### API Returns 404 or 500

1. Check `/api/.htaccess` exists
2. Verify `config.php` exists (not just `config.example.php`)
3. Test health endpoint: `curl https://yourdomain.com/api/health`
4. Check PHP error logs: `tail -f /home/username/logs/error.log`
5. Run full diagnostics to identify missing tables or extensions

### Database Connection Failed

1. Verify database credentials in `config.php`
2. Ensure database user has full privileges
3. Check if MySQL server is running
4. Run diagnostics to see which tables are missing

### Design/CSS Not Loading

1. Verify `assets/` folder was uploaded to `public_html/`
2. Check browser DevTools Network tab for 404 errors
3. Ensure `.htaccess` in `public_html/` exists (for SPA routing)
4. Clear browser cache (Ctrl+Shift+R) and CDN cache if applicable
5. Verify asset files have correct MIME types

### Emails Not Arriving

1. Verify IMAP credentials in admin panel
2. Check cron job is running: `tail -f ~/logs/imap-poll.log`
3. Test IMAP: `curl -X POST https://yourdomain.com/api/test-imap.php`
4. Check firewall allows IMAP port 993
5. Run diagnostics to verify IMAP connectivity

### CORS Errors

1. Add your domain to `cors_origins` in `config.php`
2. Clear browser cache

### Login Not Working (Auth Errors)

1. Check `/api/auth/session` returns valid response
2. Verify JWT secret is set in config.php
3. Check browser console for errors
4. Ensure cookies are not blocked
5. Run diagnostics to verify all auth-related tables exist

## Manual Configuration

If you prefer manual setup over the wizard:

### config.php

```php
<?php
return [
    'db' => [
        'host' => 'localhost',
        'name' => 'your_database_name',
        'user' => 'your_db_user',
        'pass' => 'your_db_password',
    ],
    'jwt_secret' => 'generate-a-random-64-char-string-here',
    'smtp' => [
        'host' => 'mail.yourdomain.com',  // Your cPanel mail server
        'port' => 465,                     // 465 for SSL, 587 for TLS
        'user' => 'noreply@yourdomain.com',
        'pass' => 'your_email_password',
        'from' => 'noreply@yourdomain.com',
    ],
    'imap' => [
        'host' => 'mail.yourdomain.com',  // Same as SMTP usually
        'port' => 993,                     // 993 for SSL
        'user' => 'catchall@yourdomain.com', // Email that receives all temp emails
        'pass' => 'your_email_password',
    ],
    'storage_path' => __DIR__ . '/storage',
    'cors_origins' => ['https://yourdomain.com'],
    'force_https' => true,
];
```

## Payment Gateway Setup

### Stripe Integration

1. Go to Admin Panel → Payments
2. Enable Stripe and enter your API keys:
   - **Publishable Key**: `pk_test_...` or `pk_live_...`
   - **Secret Key**: `sk_test_...` or `sk_live_...`
   - **Webhook Secret**: `whsec_...`
3. Set up a webhook in Stripe Dashboard pointing to:
   ```
   https://yourdomain.com/api/webhook/stripe
   ```
4. Enable events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`

### PayPal Integration

1. Go to Admin Panel → Payments → PayPal tab
2. Enter your PayPal API credentials:
   - **Client ID**: From PayPal Developer Dashboard
   - **Client Secret**: From PayPal Developer Dashboard
3. Set up a webhook in PayPal pointing to:
   ```
   https://yourdomain.com/api/webhook/paypal
   ```

## Error Logs

The PHP backend includes a comprehensive error logging system:

### Viewing Logs

- **Admin Panel**: Go to Admin → Error Logs to view, filter, and search logs
- **Log Files**: Located in `/api/logs/` directory (protected by .htaccess)

### Log Types

- `error-YYYY-MM-DD.log` - Errors and critical issues
- `app-YYYY-MM-DD.log` - Info, warnings, and debug messages

### Log Management

- Logs automatically rotate when they reach 10MB
- Old logs are automatically cleaned up (keeps last 5 files)
- Admin can clear logs from the Error Logs page

## New Features (v2.0)

### Scheduled Maintenance System

Schedule and manage maintenance windows from the admin panel:

1. Go to **Admin Panel → Maintenance**
2. Click **Schedule Maintenance** to create a new window
3. Set title, description, start/end times, and affected services
4. Actions available:
   - **Start Now**: Begin maintenance immediately
   - **Complete**: Mark as finished (moves to history)
   - **Cancel**: Cancel scheduled maintenance

The public status page (`/status`) automatically shows:
- Yellow banner for upcoming maintenance
- Red alert during active maintenance
- Maintenance history section

### Uptime Badge Generator

Embed live status badges on external sites:

1. Visit your **Status Page** (`/status`)
2. Scroll to **"Embed Status Badge"** section
3. Choose service (Overall, IMAP, SMTP, Database)
4. Select format (SVG, Markdown, HTML, JSON)
5. Copy the embed code

**Badge API Endpoint:**
```
GET /api/badge/uptime?service=overall&format=svg
```

Parameters:
- `service`: `overall`, `imap`, `smtp`, `database`
- `format`: `svg` (image), `json` (API data)

### Comprehensive Rate Limits

Configure rate limits per action type in **Admin → Rate Limits**:

| Tab | Purpose |
|-----|---------|
| Email Creation | Limit temp email generation |
| Login Attempts | Prevent brute force attacks |
| Signup Attempts | Prevent spam registrations |
| Password Reset | Limit reset requests |
| API Requests | Throttle API usage |

Each action type supports separate limits for guests vs. registered users.

### New Database Tables

The following tables are automatically created by the installer:

| Table | Purpose |
|-------|---------|
| `scheduled_maintenance` | Maintenance windows |
| `uptime_records` | Historical uptime data |
| `cron_logs` | Cron job execution logs |
| `email_restrictions` | Blocked words/min characters |
| `blocked_emails` | Blocked email patterns for registration |
| `blocked_ips` | Blocked IP addresses |
| `banners` | Ad/announcement banners |
| `saved_emails` | User-saved emails |
| `user_invoices` | Payment history |

### IP & Email Blocking (v2.2)

Block specific IP addresses and email patterns from registering and creating temp emails:

1. **IP Blocking**: Go to **Admin → IP Blocking** to block suspicious IPs
   - Supports IPv4 and IPv6
   - Set expiration time or permanent blocks
   - Automatically captures registration IP on user signup
   - **Bulk IP Blocking**: Upload CSV/TXT files or paste multiple IPs to block at once
   - Blocked IPs are prevented from creating temp emails

2. **Email Blocking**: Go to **Admin → Email Blocking** to block email patterns
   - Block exact emails: `spam@example.com`
   - Use wildcards: `*@spam.com` blocks entire domain
   - Use regex patterns for complex matching
   - Set temporary or permanent blocks
   - Blocked patterns are checked during temp email creation

3. **Registration IPs**: Go to **Admin → Registration IPs** to view all user registration IPs
   - Filter and search by email, name, or IP
   - Export data to CSV
   - Quick-block suspicious IPs directly from the list
   - Real-time updates when new users register

All blocking features work in **real-time** and are checked during:
- User registration
- Temp email creation
- API requests

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review error logs in Admin → Error Logs
3. Check PHP error logs in cPanel
4. Test individual components (database, SMTP, IMAP) separately
5. Verify all file permissions are correct

## Version History

- **v2.2** - Bulk IP blocking, email blocking in temp email creation, registration IPs viewer with export
- **v2.1** - IP capture on registration, email/IP blocking admin tools
- **v2.0** - Scheduled maintenance, uptime badges, comprehensive rate limits
- **v1.0** - Initial release with full email functionality
