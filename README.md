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

## Quick Start

### Requirements

| Requirement | Version | Notes |
|-------------|---------|-------|
| PHP | 8.0+ | Extensions: pdo_mysql, openssl, mbstring, imap, json, curl |
| MySQL | 8.0+ | Or MariaDB 10.4+ |
| Apache | 2.4+ | With mod_rewrite enabled |
| SSL | Required | Let's Encrypt or commercial certificate |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-repo/tempmail.git
cd tempmail

# 2. Install dependencies
npm install

# 3. Build for self-hosting
npm run build:cpanel

# 4. Upload files to your server
# Upload cpanel-package/public_html/* to your public_html/

# 5. Run setup wizard
# Visit: https://yourdomain.com/api/install.php

# 6. Configure cron jobs
*/2 * * * * /usr/bin/php /home/username/public_html/api/cron/imap-poll.php
0 * * * * /usr/bin/php /home/username/public_html/api/cron/maintenance.php
0 */6 * * * /usr/bin/php /home/username/public_html/api/cron/health-check.php

# 7. IMPORTANT: Delete install.php after setup!
rm public_html/api/install.php
```

---

## Configuration

### config.php

Copy `api/config.example.php` to `api/config.php` and configure:

```php
<?php
// Database
define('DB_HOST', 'localhost');
define('DB_NAME', 'tempmail');
define('DB_USER', 'your_user');
define('DB_PASS', 'your_password');

// Security
define('JWT_SECRET', 'generate-64-char-random-string');
define('JWT_EXPIRY', 604800); // 7 days

// SMTP (for sending emails)
define('SMTP_HOST', 'smtp.yourdomain.com');
define('SMTP_PORT', 587);
define('SMTP_USER', 'noreply@yourdomain.com');
define('SMTP_PASS', 'your-smtp-password');

// IMAP (for receiving emails)
define('IMAP_HOST', 'imap.yourdomain.com');
define('IMAP_PORT', 993);
define('IMAP_USER', 'catchall@yourdomain.com');
define('IMAP_PASS', 'your-imap-password');

// Optional: Google Search Console integration
define('GOOGLE_CLIENT_ID', '');
define('GOOGLE_CLIENT_SECRET', '');

// Optional: Payment gateways
define('STRIPE_SECRET_KEY', '');
define('STRIPE_WEBHOOK_SECRET', '');
define('PAYPAL_CLIENT_ID', '');
define('PAYPAL_CLIENT_SECRET', '');
```

### Environment Variables

For the frontend build:

```env
# Required
VITE_SELF_HOSTED=true

# Optional: Custom API URL (defaults to /api)
VITE_PHP_API_URL=https://yourdomain.com/api
```

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

### Functions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/functions/fetch-imap-emails` | Fetch emails from IMAP |
| POST | `/api/functions/send-test-email` | Send test email |
| GET | `/api/functions/get-public-stats` | Get public statistics |
| POST | `/api/functions/verify-recaptcha` | Verify reCAPTCHA |

### SEO & Sitemap

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/seo/sitemap` | Generate sitemap XML |
| POST | `/api/seo/ping` | Ping search engines |
| POST | `/api/gsc/authorize` | Start GSC OAuth |
| POST | `/api/gsc/submit-sitemap` | Submit sitemap to GSC |
| GET | `/api/gsc/performance` | Get GSC performance data |

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Basic health check |
| GET | `/api/health/diag?token=xxx` | Detailed diagnostics |

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
    ├── schema.sql          # Database schema
    ├── routes/
    │   ├── auth.php        # Authentication
    │   ├── data.php        # CRUD operations
    │   ├── rpc.php         # RPC functions
    │   ├── functions.php   # Edge function equivalents
    │   ├── admin.php       # Admin operations
    │   ├── seo.php         # SEO & sitemap
    │   └── google-search-console.php
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

## Email Domain Setup

### DNS Records

| Type | Name | Value | Priority |
|------|------|-------|----------|
| MX | @ | mail.yourdomain.com | 10 |
| A | mail | YOUR_SERVER_IP | - |
| TXT | @ | v=spf1 mx ~all | - |
| TXT | _dmarc | v=DMARC1; p=none | - |

### Catch-All Configuration

1. Create email account: `catchall@yourdomain.com`
2. Set as default/catch-all in your email server
3. Configure in Admin → Mailboxes

---

## Security Checklist

- [ ] Delete `install.php` after setup
- [ ] Set file permissions: files 644, folders 755, config.php 600
- [ ] Generate strong JWT secret (64+ characters)
- [ ] Enable HTTPS only
- [ ] Configure CORS origins in config.php
- [ ] Enable rate limiting
- [ ] Set up admin alerts
- [ ] Regular backups configured
- [ ] Error display disabled in production

---

## Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| IMAP Poll | `*/2 * * * *` | Fetch new emails |
| Maintenance | `0 * * * *` | Cleanup expired data |
| Health Check | `0 */6 * * *` | Monitor system health |

---

## Troubleshooting

### Common Issues

**500 Internal Server Error**
- Check `api/logs/php-errors.log`
- Verify PHP version ≥ 8.0
- Check file permissions

**Emails Not Received**
- Verify IMAP credentials in Admin → Mailboxes
- Check cron jobs are running
- Verify MX records point to your server

**Login Not Working**
- Verify JWT secret in config.php
- Check database connection
- Clear browser localStorage

### Debug Endpoints

```bash
# Health check
curl https://yourdomain.com/api/health

# Detailed diagnostics (requires token)
curl "https://yourdomain.com/api/health/diag?token=YOUR_DIAG_TOKEN"
```

---

## Upgrading

1. Backup `api/config.php` and database
2. Download latest release
3. Upload new files (except config.php)
4. Check release notes for schema changes
5. Run any required migrations

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
