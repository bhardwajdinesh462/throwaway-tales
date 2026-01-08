# Self-Hosted Installation Guide

This guide explains how to deploy the TempMail application on your own server with PHP and MySQL (cPanel compatible).

## Requirements

- PHP 8.0+ with extensions: `pdo_mysql`, `openssl`, `mbstring`, `json`, `imap` (optional)
- MySQL 5.7+ or MariaDB 10.3+
- cPanel hosting OR any Apache/Nginx server
- SMTP server for sending emails
- IMAP server for receiving emails (optional)

## Quick Installation Steps

### Step 1: Build for Self-Hosted

```bash
# Clone or download the project
git clone <your-repo-url>
cd tempmail

# Install dependencies
npm install

# Build for cPanel/self-hosted (creates cpanel-package.zip)
npm run build:cpanel
```

This creates a `cpanel-package.zip` with the optimized frontend and PHP backend.

### Step 2: Upload to cPanel

1. **Login to cPanel** → File Manager
2. **Navigate to** `public_html` (or your domain folder)
3. **Upload** `cpanel-package.zip`
4. **Extract** the zip file
5. **Move files**:
   - Move all files from `dist/` to `public_html/`
   - Move `php-backend/` contents to `public_html/api/`

Your file structure should look like:
```
public_html/
├── index.html
├── assets/
├── api/
│   ├── index.php
│   ├── install.php
│   ├── config.example.php
│   ├── schema.sql
│   ├── routes/
│   └── ...
```

### Step 3: Run Setup Wizard

1. **Visit** `https://yourdomain.com/api/install.php`
2. **Fill in** your database credentials:
   - Database Host (usually `localhost`)
   - Database Name
   - Database Username
   - Database Password
3. **Configure** JWT secret (auto-generated)
4. **Set up** SMTP settings (for sending emails)
5. **Click** "Install" to create tables and config

### Step 4: Configure Cron Jobs

In cPanel → Cron Jobs, add these:

```bash
# Poll IMAP for new emails (every 2 minutes)
*/2 * * * * /usr/bin/php /home/YOUR_USERNAME/public_html/api/cron/imap-poll.php >> /dev/null 2>&1

# Cleanup expired emails (hourly)
0 * * * * /usr/bin/php /home/YOUR_USERNAME/public_html/api/cron/maintenance.php >> /dev/null 2>&1

# Health check (every 5 minutes)
*/5 * * * * /usr/bin/php /home/YOUR_USERNAME/public_html/api/cron/health-check.php >> /dev/null 2>&1
```

Replace `YOUR_USERNAME` with your actual cPanel username.

### Step 5: First Admin Setup

1. **Visit** your site `https://yourdomain.com`
2. **Register** the first account
3. **Visit** `https://yourdomain.com/admin`
4. **Claim** admin role (first user only)

---

## Manual Configuration

If the setup wizard doesn't work, manually configure:

### Create config.php

Copy `api/config.example.php` to `api/config.php` and edit:

```php
<?php
return [
    'db' => [
        'host' => 'localhost',
        'name' => 'your_database',
        'user' => 'your_username',
        'pass' => 'your_password',
        'charset' => 'utf8mb4',
    ],
    
    'jwt' => [
        'secret' => 'generate-a-64-char-random-string',
        'expiry' => 86400, // 24 hours
    ],
    
    'cors' => [
        'origins' => ['https://yourdomain.com'],
    ],
    
    'smtp' => [
        'host' => 'mail.yourdomain.com',
        'port' => 587,
        'user' => 'noreply@yourdomain.com',
        'pass' => 'your-smtp-password',
        'from' => 'noreply@yourdomain.com',
        'from_name' => 'TempMail',
        'encryption' => 'tls',
    ],
    
    'imap' => [
        'host' => 'mail.yourdomain.com',
        'port' => 993,
        'user' => 'inbox@yourdomain.com',
        'pass' => 'your-imap-password',
        'encryption' => 'ssl',
        'folder' => 'INBOX',
    ],
    
    'app' => [
        'name' => 'TempMail',
        'url' => 'https://yourdomain.com',
    ],
    
    'diag_token' => 'your-secret-diagnostic-token',
];
```

### Import Database Schema

```bash
mysql -u username -p database_name < api/schema.sql
```

Or use phpMyAdmin to import `schema.sql`.

---

## Environment Variables

For the frontend build, create `.env` with:

```bash
# Enable self-hosted mode
VITE_SELF_HOSTED=true

# Optional: Custom API URL
# VITE_PHP_API_URL=https://yourdomain.com/api
```

---

## Verify Installation

### Check API Health

```
https://yourdomain.com/api/health
```

Should return:
```json
{
  "status": "ok",
  "db_connected": true,
  "config_present": true
}
```

### Check Full Diagnostics

```
https://yourdomain.com/api/health/diag?token=YOUR_DIAG_TOKEN
```

---

## Setting Up Email Domains

1. **Login** as admin
2. **Go to** Admin → Domains
3. **Add** your email domain(s) like `@yourdomain.com`
4. **Configure** MX records to point to your mail server

### DNS Records Example

```
Type    Name    Value                   Priority
MX      @       mail.yourdomain.com     10
A       mail    YOUR_SERVER_IP          -
TXT     @       v=spf1 mx ~all          -
```

---

## Troubleshooting

### Common Issues

1. **500 Error**: Check `api/logs/error-*.log` or PHP error logs
2. **CORS Error**: Verify `cors.origins` in config.php includes your domain
3. **Login Fails**: Ensure JWT secret is set and consistent
4. **No Emails**: Check IMAP credentials and cron job execution
5. **Permission Denied**: Make `api/logs/` and `api/storage/` writable (755 or 775)

### View Error Logs

Visit `https://yourdomain.com/api/logs/errors` (requires admin auth)

Or check files:
- `api/logs/error-YYYY-MM-DD.log`
- `api/logs/php-errors.log`

---

## Security Recommendations

1. **SSL/HTTPS**: Always use HTTPS in production
2. **JWT Secret**: Use a strong 64+ character random string
3. **File Permissions**: 
   - PHP files: 644
   - Directories: 755
   - Config.php: 600 (owner read/write only)
4. **Backup**: Regularly backup your database and config
5. **Updates**: Keep PHP and dependencies updated

---

## Upgrading

1. Download new version
2. Run `npm run build:cpanel`
3. Backup existing `api/config.php`
4. Upload new files (overwrite, except config.php)
5. Run any new migrations via `/api/install.php?upgrade=1`

---

## Support

- Check `/api/health/diag` for system diagnostics
- Review error logs in `/api/logs/`
- Open an issue on GitHub for bugs
