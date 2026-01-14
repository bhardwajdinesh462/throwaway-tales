# TempMail PHP Backend

Self-hosted PHP backend for TempMail - a complete temporary email service.

## Features

- **Email Management**: Create temporary emails, receive via IMAP, forward emails
- **User Authentication**: JWT-based auth with 2FA support
- **Admin Panel API**: Complete admin functionality
- **Payment Integration**: Stripe and PayPal support
- **SEO Tools**: Sitemap generation, search engine pinging, Google Search Console integration
- **Real-time**: Server-Sent Events (SSE) for live updates
- **Security**: Rate limiting, IP blocking, CORS, input validation

## Requirements

- PHP 8.0+ with extensions: `pdo_mysql`, `mbstring`, `json`, `openssl`, `curl`
- Optional extensions: `imap` (email receiving), `gd` (images), `zip` (backups)
- MySQL 8.0+ or MariaDB 10.4+
- Apache with mod_rewrite OR Nginx
- SSL certificate (required for production)

## Quick Start

### 1. Build the deployment package

```bash
npm install
npm run build && node scripts/cpanel-package.mjs
```

### 2. Upload files

Upload `cpanel-package/public_html/*` to your cPanel `public_html/`

### 3. Check system requirements

Visit: `https://yourdomain.com/api/requirements-check.php`

This verifies:
- ✅ PHP version and configuration
- ✅ Required and optional extensions
- ✅ Filesystem permissions
- ✅ Server configuration

### 4. Run the setup wizard

Visit: `https://yourdomain.com/api/install.php`

Features:
- Database connection testing before setup
- Password strength indicator
- Automatic table creation
- Admin account creation

### 5. Verify installation

Visit: `https://yourdomain.com/api/verify-installation.php?format=html`

This checks:
- ✅ All database tables created
- ✅ Admin account exists
- ✅ Security configuration

### 6. Post-installation security

```bash
# Delete installation files!
rm public_html/api/install.php
rm public_html/api/requirements-check.php
rm public_html/api/verify-installation.php
```

### 7. Add cron jobs (in cPanel → Cron Jobs)

```bash
*/2 * * * * /usr/bin/php /home/username/public_html/api/cron/imap-poll.php
0 * * * * /usr/bin/php /home/username/public_html/api/cron/maintenance.php
0 */6 * * * /usr/bin/php /home/username/public_html/api/cron/health-check.php
```

See main [README.md](../README.md) for detailed deployment instructions.

## File Structure

```
php-backend/
├── index.php               # Main API router
├── config.example.php      # Config template
├── schema.sql              # Database schema (35+ tables)
├── .htaccess               # Apache rewrite rules
├── install.php             # Installation wizard
├── requirements-check.php  # System requirements checker
├── verify-installation.php # Post-install verification
├── error-logger.php        # Error logging system
├── sse.php                 # Server-sent events
├── routes/
│   ├── auth.php            # Authentication
│   ├── data.php            # CRUD operations
│   ├── rpc.php             # RPC functions
│   ├── functions.php       # Edge function equivalents
│   ├── admin.php           # Admin operations
│   ├── seo.php             # SEO (sitemap, ping)
│   ├── google-search-console.php  # GSC API integration
│   ├── storage.php         # File uploads
│   ├── webhooks.php        # Payment webhooks
│   ├── forwarding.php      # Email forwarding
│   ├── attachments.php     # Email attachments
│   └── logs.php            # Error logs
├── includes/
│   ├── db.php              # Database helper
│   └── helpers.php         # Utility functions
├── cron/
│   ├── imap-poll.php       # Fetch IMAP emails
│   ├── maintenance.php     # Cleanup tasks
│   └── health-check.php    # System monitoring
├── storage/                # Uploaded files
└── logs/                   # Error logs
```

## Database Tables

The schema creates 35+ tables:

| Category | Tables |
|----------|--------|
| Users | `users`, `profiles`, `user_roles`, `user_2fa`, `user_suspensions` |
| Email | `domains`, `temp_emails`, `received_emails`, `email_attachments`, `email_forwarding` |
| Subscriptions | `subscription_tiers`, `user_subscriptions`, `user_invoices`, `user_usage` |
| Security | `blocked_ips`, `blocked_emails`, `blocked_countries`, `rate_limits` |
| Admin | `admin_audit_logs`, `admin_role_requests`, `app_settings` |
| Content | `blogs`, `blog_subscribers`, `banners`, `homepage_sections`, `friendly_websites` |
| Email System | `mailboxes`, `email_logs`, `email_stats`, `email_templates`, `email_restrictions` |
| Status | `uptime_records`, `status_incidents`, `scheduled_maintenance`, `cron_logs`, `alert_logs` |
| Storage | `backup_history`, `email_verifications`, `saved_emails`, `push_subscriptions` |

## API Endpoints

### Pre-Installation Tools

| Endpoint | Purpose |
|----------|---------|
| `/api/requirements-check.php` | Check system requirements |
| `/api/install.php` | Installation wizard |
| `/api/verify-installation.php` | Verify installation |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/session` | Get current session |
| POST | `/api/auth/reset-password` | Request password reset |

### Database Operations (CRUD)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data/{table}` | Query table |
| POST | `/api/data/{table}` | Insert data |
| PATCH | `/api/data/{table}` | Update data |
| DELETE | `/api/data/{table}` | Delete data |

### RPC Functions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rpc/create_temp_email` | Create temp email |
| POST | `/api/rpc/check_rate_limit` | Check rate limit |
| GET | `/api/rpc/get_email_stats` | Get email statistics |
| GET | `/api/rpc/get_admin_users` | Get admin users |

### Functions (Edge Function Equivalents)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/functions/fetch-imap-emails` | Fetch emails via IMAP |
| POST | `/api/functions/send-test-email` | Send test email |
| GET | `/api/functions/get-public-stats` | Get public stats |
| POST | `/api/functions/blog-subscribe` | Subscribe to blog |
| POST | `/api/functions/blog-unsubscribe` | Unsubscribe from blog |
| POST | `/api/functions/get-database-metrics` | Get DB metrics (admin) |
| POST | `/api/functions/select-mailbox` | Select mailbox for sending |
| POST | `/api/functions/smtp-failover-test` | Test SMTP failover (admin) |
| POST | `/api/functions/cleanup-old-backups` | Cleanup backups (admin) |
| POST | `/api/functions/delete-duplicate-emails` | Delete duplicates (admin) |
| POST | `/api/functions/send-template-email` | Send template email |
| POST | `/api/functions/reset-daily-stats` | Reset daily stats (admin) |

### SEO

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/seo/sitemap` | Generate XML sitemap |
| POST | `/api/seo/ping` | Ping search engines |

### Google Search Console

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/gsc/authorize` | Start OAuth flow |
| GET | `/api/gsc/callback` | OAuth callback |
| POST | `/api/gsc/sites` | List verified sites |
| POST | `/api/gsc/submit-sitemap` | Submit sitemap |
| POST | `/api/gsc/performance` | Get analytics data |
| POST | `/api/gsc/disconnect` | Disconnect GSC |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/health` | Mailbox health dashboard |
| GET | `/api/admin/cron-logs` | Cron job logs |
| POST | `/api/admin/dns-verify` | Verify domain DNS |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Basic health check |
| GET | `/api/health/diag?token=X` | Detailed diagnostics |

## Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| imap-poll.php | Every 2 min | Fetch new emails via IMAP |
| maintenance.php | Hourly | Cleanup expired data, update stats |
| health-check.php | Every 6 hours | System monitoring, admin alerts |

```bash
# cPanel Cron Jobs
*/2 * * * * /usr/bin/php ~/public_html/api/cron/imap-poll.php >> ~/logs/imap.log 2>&1
0 * * * * /usr/bin/php ~/public_html/api/cron/maintenance.php >> ~/logs/maintenance.log 2>&1
0 */6 * * * /usr/bin/php ~/public_html/api/cron/health-check.php >> ~/logs/health.log 2>&1
```

## Configuration

The installer creates `config.php` automatically. Manual configuration:

```php
<?php
return [
    'db' => [
        'host' => 'localhost',
        'name' => 'your_database',
        'user' => 'your_user',
        'pass' => 'your_password',
        'charset' => 'utf8mb4',
    ],
    'jwt' => [
        'secret' => 'your-64-char-secret',  // Auto-generated by installer
        'expiry' => 604800,  // 7 days
    ],
    'cors' => [
        'origins' => ['https://yourdomain.com'],
        'methods' => ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        'headers' => ['Content-Type', 'Authorization'],
    ],
    'smtp' => [
        'host' => 'mail.yourdomain.com',
        'port' => 587,
        'user' => 'noreply@yourdomain.com',
        'pass' => 'password',
        'from' => 'noreply@yourdomain.com',
    ],
    'imap' => [
        'host' => 'mail.yourdomain.com',
        'port' => 993,
        'user' => 'catchall@yourdomain.com',
        'pass' => 'password',
    ],
    'google' => [
        'client_id' => '',      // For GSC integration
        'client_secret' => '',
    ],
    'stripe' => [
        'publishable_key' => '',
        'secret_key' => '',
        'webhook_secret' => '',
    ],
    'paypal' => [
        'client_id' => '',
        'client_secret' => '',
        'mode' => 'sandbox',  // or 'live'
    ],
    'recaptcha' => [
        'site_key' => '',
        'secret_key' => '',
    ],
    'diag_token' => '',  // Auto-generated by installer
];
```

## Security Checklist

### Post-Installation
- [ ] Delete `install.php`
- [ ] Delete `requirements-check.php`
- [ ] Delete `verify-installation.php`
- [ ] Verify JWT secret is 64+ characters

### File Permissions
- [ ] Directories: 755
- [ ] Files: 644
- [ ] `config.php`: 600

### Configuration
- [ ] HTTPS enabled
- [ ] CORS origins updated
- [ ] Error display disabled
- [ ] Rate limiting enabled

## Troubleshooting

### Health Check
```bash
curl https://yourdomain.com/api/health
```

### Diagnostics (with token)
```bash
curl "https://yourdomain.com/api/health/diag?token=YOUR_TOKEN"
```

### System Requirements
```bash
curl "https://yourdomain.com/api/requirements-check.php?format=json"
```

### Common Issues

| Issue | Solution |
|-------|----------|
| 500 Error | Check `api/logs/` for PHP errors |
| CORS Error | Add domain to `cors.origins` in config |
| Login fails | Verify JWT secret, check browser console |
| No emails | Check IMAP config, verify cron running |
| 404 on API | Verify `.htaccess` exists, mod_rewrite enabled |
| DB connection failed | Check credentials, MySQL running |

## License

MIT License
