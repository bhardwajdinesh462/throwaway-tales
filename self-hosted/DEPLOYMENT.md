# Self-Hosted Temp Email - Deployment Guide

## Quick Start

### 1. Server Requirements
- PHP 8.0+ with extensions: `pdo_mysql`, `openssl`, `json`, `mbstring`, `curl`, `imap` (optional)
- MySQL 8.0+
- Apache with `mod_rewrite` enabled
- SSL certificate (required for production)

### 2. Database Setup

1. Create MySQL database:
```sql
CREATE DATABASE temp_email CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tempemail'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON temp_email.* TO 'tempemail'@'localhost';
FLUSH PRIVILEGES;
```

2. Import schema files (in order):
```bash
mysql -u tempemail -p temp_email < database/schema.mysql.sql
mysql -u tempemail -p temp_email < database/seed-data.sql
mysql -u tempemail -p temp_email < database/optimize.sql
```

### 3. Configure API

1. Copy config file:
```bash
cp api/config.example.php api/config.php
```

2. Edit `api/config.php` with your settings:
- Database credentials
- JWT secret (generate: `openssl rand -hex 32`)
- Encryption key (generate: `openssl rand -hex 32`)
- Webhook secrets (for instant email delivery)
- IMAP settings (fallback if webhooks unavailable)
- SMTP settings (for verification emails)
- Stripe keys (if using payments)

### 4. Build Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env: VITE_API_URL=/api
npm run build
```

### 5. Upload Files

Upload to your hosting:
```
public_html/
├── api/              (from self-hosted/api/)
├── uploads/          (from self-hosted/uploads/)
├── .htaccess         (from self-hosted/.htaccess)
└── [frontend files]  (from frontend/dist/)
```

### 6. Set Permissions

```bash
chmod 755 api/
chmod 755 uploads/
chmod 755 uploads/attachments/
chmod 755 uploads/backups/
chmod 644 api/config.php
```

### 7. Setup Email Delivery

#### Option A: Webhooks (Recommended - Instant Delivery)
Configure your email provider to POST to:
```
https://yourdomain.com/api/emails/webhook.php
```

See `WEBHOOK-SETUP.md` for detailed provider instructions.

#### Option B: IMAP Polling (Fallback - 2 min delay)
Add cron job for IMAP polling (every 2 minutes):
```
*/2 * * * * /usr/bin/php /path/to/api/imap/poll.php >> /path/to/logs/imap.log 2>&1
```

Add cron job for cleanup (daily at 3 AM):
```
0 3 * * * /usr/bin/php /path/to/api/cron/cleanup.php >> /path/to/logs/cleanup.log 2>&1
```

### 8. First Login

- URL: `https://yourdomain.com/auth`
- Register a new account
- Assign admin role in database:
```sql
INSERT INTO user_roles (id, user_id, role, created_at, updated_at) 
SELECT UUID(), id, 'admin', NOW(), NOW() FROM users WHERE email = 'your@email.com';
```

---

## Troubleshooting

### Common Issues

**500 Internal Server Error**
- Check PHP error logs
- Verify `.htaccess` is enabled
- Check file permissions
- Validate `config.php` syntax

**Database Connection Failed**
- Verify credentials in `config.php`
- Check MySQL is running
- Test connection: `mysql -u user -p database`

**Emails Not Receiving**
- Check webhook logs: `SELECT * FROM webhook_logs ORDER BY created_at DESC`
- Check IMAP credentials (if using polling)
- Verify cron job is running
- Check `cron_runs` table for errors

**CORS Errors**
- Update `allowed_origins` in `config.php`

**Real-Time Updates Not Working**
- SSE requires persistent connections
- Some shared hosts timeout long connections
- System falls back to polling automatically

---

## Security Checklist

- [ ] Changed default admin password
- [ ] Set strong JWT secret (64 characters)
- [ ] Set strong encryption key (64 characters)
- [ ] Enabled SSL/HTTPS
- [ ] Disabled directory listing
- [ ] Set proper file permissions
- [ ] Configured webhook signature verification
- [ ] Configured rate limiting
- [ ] Set up regular backups
