# Nullsto TempMail - Comprehensive Deployment Guide

Complete deployment guide for all hosting options with step-by-step instructions.

---

## 📋 Table of Contents

1. [Quick Start (5 Minutes)](#-quick-start-5-minutes)
2. [Requirements](#-requirements)
3. [Deployment Options](#-deployment-options)
4. [cPanel/Shared Hosting (PHP Backend)](#option-a-cpanelshared-hosting-php-backend)
5. [Lovable Cloud (Supabase)](#option-b-lovable-cloud-automatic)
6. [VPS/Dedicated Server](#option-c-vpsdedicated-server)
7. [Docker Deployment](#option-d-docker-deployment)
8. [DNS Configuration](#-dns-configuration)
9. [Email Server Setup](#-email-server-setup)
10. [Cron Jobs Configuration](#-cron-jobs-configuration)
11. [Post-Installation Security](#-post-installation-security)
12. [Verification & Testing](#-verification--testing)
13. [Troubleshooting](#-troubleshooting)
14. [Feature Checklist](#-feature-checklist)

---

## 🚀 Quick Start (5 Minutes)

### For cPanel Hosting (PHP Backend)

```bash
# 1. Build deployment package
npm install
node scripts/cpanel-package.mjs --out cpanel-package

# 2. Upload to cPanel
# Upload cpanel-package/public_html/* to your public_html/

# 3. Run setup wizard
# Visit: https://yourdomain.com/api/install.php

# 4. Add cron jobs (in cPanel → Cron Jobs)
*/2 * * * * /usr/bin/php /home/username/public_html/api/cron/imap-poll.php
0 * * * * /usr/bin/php /home/username/public_html/api/cron/maintenance.php
0 */6 * * * /usr/bin/php /home/username/public_html/api/cron/health-check.php

# 5. Delete install.php after setup!
rm public_html/api/install.php
```

### For Lovable Cloud

1. Click "Publish" in Lovable editor
2. Configure email secrets in Cloud settings
3. Connect custom domain (optional)
4. Done! Automatic scaling and SSL included.

---

## 📦 Requirements

### PHP Backend (cPanel)

| Requirement | Version | Notes |
|-------------|---------|-------|
| PHP | 8.0+ | With extensions: pdo_mysql, openssl, mbstring, imap, json, curl |
| MySQL | 8.0+ | Or MariaDB 10.4+ |
| Apache | 2.4+ | With mod_rewrite enabled |
| SSL | Required | Let's Encrypt or commercial |

### Lovable Cloud

- Lovable account (Free tier available)
- Custom domain (optional)
- Email domain with IMAP access

---

## 🎯 Deployment Options

| Option | Best For | Backend | Difficulty |
|--------|----------|---------|------------|
| **cPanel (PHP)** | Shared hosting, budget-friendly | PHP + MySQL | Easy |
| **Lovable Cloud** | Zero-config, auto-scaling | Supabase | Easiest |
| **VPS** | Full control, custom setup | PHP or Supabase | Medium |
| **Docker** | Containerized, portable | Either | Medium |

---

## Option A: cPanel/Shared Hosting (PHP Backend)

### Step 1: Build Deployment Package

```bash
# Install dependencies
npm install

# Validate PHP files (optional, requires PHP installed locally)
node scripts/validate-php.mjs

# Build deployment package
node scripts/cpanel-package.mjs --out cpanel-package

# Or build with tar.gz archive
node scripts/cpanel-package.mjs --out cpanel-package --tar
```

### Step 2: Upload to cPanel

1. **Login to cPanel** at `yourdomain.com/cpanel`
2. **Open File Manager** → Navigate to `public_html/`
3. **Upload files**:
   - Upload all contents from `cpanel-package/public_html/` to `public_html/`
   - Ensure `api/` folder is included

### Step 3: Run Setup Wizard

1. Visit `https://yourdomain.com/api/install.php`
2. Complete the wizard:
   - **Database**: Enter MySQL credentials
   - **Admin**: Create admin account
   - **Email**: Configure SMTP/IMAP
3. **Delete install.php** after completion!

### Step 4: Configure Cron Jobs

In cPanel → Cron Jobs, add:

```bash
# IMAP Polling - every 2 minutes
*/2 * * * * /usr/bin/php /home/username/public_html/api/cron/imap-poll.php >> /home/username/logs/imap.log 2>&1

# Maintenance - every hour
0 * * * * /usr/bin/php /home/username/public_html/api/cron/maintenance.php >> /home/username/logs/maintenance.log 2>&1

# Health Check - every 6 hours
0 */6 * * * /usr/bin/php /home/username/public_html/api/cron/health-check.php >> /home/username/logs/health.log 2>&1
```

### Step 5: File Structure After Deployment

```
public_html/
├── index.html              # React app entry
├── .htaccess               # SPA routing
├── assets/                 # Vite-built assets
├── robots.txt
├── sitemap.xml
├── sw.js                   # Service worker
│
└── api/                    # PHP Backend
    ├── index.php           # Main API router
    ├── .htaccess           # API security
    ├── config.php          # Generated config
    ├── schema.sql          # Database schema
    ├── error-logger.php    # Error logging
    ├── health-dashboard.php
    ├── test-smtp.php
    ├── test-imap.php
    ├── routes/
    │   ├── auth.php
    │   ├── data.php
    │   ├── admin.php
    │   ├── functions.php
    │   ├── webhooks.php
    │   └── ...
    ├── cron/
    │   ├── imap-poll.php
    │   ├── maintenance.php
    │   └── health-check.php
    └── logs/               # Auto-created
```

---

## Option B: Lovable Cloud (Automatic)

### Step 1: Enable Cloud

Cloud is automatically enabled when you use Supabase features in Lovable.

### Step 2: Configure Secrets

Add these secrets in Lovable Cloud settings:

| Secret | Description | Example |
|--------|-------------|---------|
| `IMAP_HOST` | IMAP server | `imap.yourdomain.com` |
| `IMAP_PORT` | IMAP port | `993` |
| `IMAP_USER` | Catch-all email | `catchall@yourdomain.com` |
| `IMAP_PASSWORD` | Email password | `your-password` |
| `SMTP_HOST` | SMTP server | `smtp.yourdomain.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP user | `noreply@yourdomain.com` |
| `SMTP_PASSWORD` | SMTP password | `your-password` |

### Step 3: Publish

1. Click **Publish** in Lovable editor
2. Wait for deployment to complete
3. Access your app at the provided URL

### Step 4: Connect Custom Domain (Optional)

1. Go to **Project Settings → Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. Wait for SSL certificate provisioning

---

## Option C: VPS/Dedicated Server

### Prerequisites

```bash
# Ubuntu 22.04 LTS
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx php8.1-fpm php8.1-mysql php8.1-imap php8.1-curl php8.1-mbstring mysql-server certbot python3-certbot-nginx
```

### Deploy with PHP Backend

```bash
# Clone repository
git clone https://github.com/yourusername/nullsto.git
cd nullsto

# Build frontend
npm install
npm run build

# Create deployment directory
sudo mkdir -p /var/www/nullsto
sudo cp -r dist/* /var/www/nullsto/
sudo mkdir -p /var/www/nullsto/api
sudo cp -r php-backend/* /var/www/nullsto/api/

# Set permissions
sudo chown -R www-data:www-data /var/www/nullsto
sudo chmod 600 /var/www/nullsto/api/config.php
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/nullsto;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # PHP API
    location /api {
        alias /var/www/nullsto/api;
        try_files $uri $uri/ /api/index.php?$query_string;
        
        location ~ \.php$ {
            fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
            fastcgi_param SCRIPT_FILENAME $request_filename;
            include fastcgi_params;
        }
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Enable SSL

```bash
sudo certbot --nginx -d yourdomain.com
```

### Setup Cron Jobs

```bash
sudo crontab -e

# Add these lines:
*/2 * * * * /usr/bin/php /var/www/nullsto/api/cron/imap-poll.php
0 * * * * /usr/bin/php /var/www/nullsto/api/cron/maintenance.php
0 */6 * * * /usr/bin/php /var/www/nullsto/api/cron/health-check.php
```

---

## Option D: Docker Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM php:8.2-apache
RUN docker-php-ext-install pdo_mysql && \
    a2enmod rewrite

COPY --from=builder /app/dist /var/www/html
COPY php-backend /var/www/html/api
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf

RUN chown -R www-data:www-data /var/www/html
EXPOSE 80
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "80:80"
    environment:
      - DB_HOST=db
      - DB_NAME=nullsto
      - DB_USER=nullsto
      - DB_PASS=secure_password
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      - MYSQL_DATABASE=nullsto
      - MYSQL_USER=nullsto
      - MYSQL_PASSWORD=secure_password
      - MYSQL_ROOT_PASSWORD=root_password
    volumes:
      - mysql_data:/var/lib/mysql
      - ./php-backend/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    restart: unless-stopped

volumes:
  mysql_data:
```

### Run

```bash
docker-compose up -d
```

---

## 🌐 DNS Configuration

### Required DNS Records for Email

| Type | Name | Value | TTL |
|------|------|-------|-----|
| **MX** | @ | `mail.yourdomain.com` | 3600 |
| **A** | mail | `Your Server IP` | 3600 |
| **TXT** | @ | `v=spf1 +a +mx ~all` | 3600 |
| **TXT** | _dmarc | `v=DMARC1; p=none; rua=mailto:admin@yourdomain.com` | 3600 |
| **TXT** | default._domainkey | `v=DKIM1; k=rsa; p=YOUR_DKIM_KEY` | 3600 |

### For Custom App Domain

| Type | Name | Value |
|------|------|-------|
| **CNAME** | www | `yourdomain.com` |
| **A** | @ | `Your Server IP` |

---

## 📧 Email Server Setup

### cPanel Email Account

1. **Create Email Account**:
   - Go to cPanel → Email Accounts
   - Create `catchall@yourdomain.com`

2. **Enable Catch-All**:
   - Go to Default Address
   - Set to forward to `catchall@yourdomain.com`

3. **Get IMAP Settings**:
   - Host: `mail.yourdomain.com`
   - Port: 993 (SSL)
   - Username: `catchall@yourdomain.com`

### External Email Provider

Configure your email provider (Gmail, Zoho, etc.) to forward all emails to your IMAP inbox.

---

## ⏰ Cron Jobs Configuration

### All Cron Jobs

| Job | Schedule | Command | Purpose |
|-----|----------|---------|---------|
| **IMAP Poll** | `*/2 * * * *` | `php cron/imap-poll.php` | Fetch new emails |
| **Maintenance** | `0 * * * *` | `php cron/maintenance.php` | Cleanup expired data |
| **Health Check** | `0 */6 * * *` | `php cron/health-check.php` | System health + alerts |

### cPanel Cron Setup

```bash
# Navigate to cPanel → Cron Jobs → Add New Cron Job

# Job 1: IMAP Polling
Minute: */2, Hour: *, Day: *, Month: *, Weekday: *
Command: /usr/bin/php /home/username/public_html/api/cron/imap-poll.php >> /home/username/logs/imap.log 2>&1

# Job 2: Maintenance
Minute: 0, Hour: *, Day: *, Month: *, Weekday: *
Command: /usr/bin/php /home/username/public_html/api/cron/maintenance.php >> /home/username/logs/maintenance.log 2>&1

# Job 3: Health Check
Minute: 0, Hour: */6, Day: *, Month: *, Weekday: *
Command: /usr/bin/php /home/username/public_html/api/cron/health-check.php >> /home/username/logs/health.log 2>&1
```

---

## 🔒 Post-Installation Security

### Security Checklist

- [ ] Delete `install.php` after setup
- [ ] Set file permissions: Files 644, Folders 755, config.php 600
- [ ] Generate strong JWT secret (64+ characters)
- [ ] Enable HTTPS only in config
- [ ] Configure CORS origins
- [ ] Enable rate limiting
- [ ] Set up admin alerts
- [ ] Test 2FA functionality
- [ ] Review RLS/Row-Level Security policies
- [ ] Enable IP blocking for abuse prevention

### File Permissions

```bash
# Set proper permissions
find public_html -type f -exec chmod 644 {} \;
find public_html -type d -exec chmod 755 {} \;
chmod 600 public_html/api/config.php
```

### Generate JWT Secret

```bash
openssl rand -base64 48
```

---

## ✅ Verification & Testing

### API Endpoints to Test

```bash
# 1. Health Check
curl https://yourdomain.com/api/health
# Expected: {"status":"ok","db_connected":true}

# 2. Full Diagnostics (requires diag_token)
curl "https://yourdomain.com/api/health/diag?token=YOUR_TOKEN"
# Expected: Complete system status

# 3. Public Stats
curl https://yourdomain.com/api/functions/get-public-stats
# Expected: Email statistics

# 4. Domains List
curl https://yourdomain.com/api/data/domains
# Expected: List of domains
```

### Admin Panel Verification

1. Login at `/auth`
2. Access admin at `/admin`
3. Verify dashboard loads with stats
4. Test user management
5. Test domain management
6. Verify cron jobs are running (Admin → Cron Logs)
7. Test email sending (Admin → SMTP Settings → Test)
8. Test IMAP connection (Admin → IMAP Settings → Test)

### Cron Job Verification

Check cron logs:
```bash
tail -f /home/username/logs/imap.log
tail -f /home/username/logs/maintenance.log
tail -f /home/username/logs/health.log
```

---

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **Homepage blank** | Check `.htaccess` exists, `mod_rewrite` enabled |
| **API 404/500** | Verify `config.php` exists, check PHP logs |
| **DB connection failed** | Verify credentials, check MySQL is running |
| **Emails not arriving** | Check IMAP cron, verify credentials, check firewall |
| **CSS not loading** | Clear browser cache, verify assets uploaded |
| **CORS errors** | Add domain to `cors_origins` in config |
| **Login not working** | Check JWT secret, verify cookies enabled |
| **Cron not running** | Check cPanel logs, verify PHP path |

### Debug Commands

```bash
# Check PHP errors
tail -f /home/username/logs/error.log

# Test IMAP manually
curl -X POST https://yourdomain.com/api/test-imap.php

# Test SMTP manually
curl -X POST https://yourdomain.com/api/test-smtp.php

# Full diagnostics
curl "https://yourdomain.com/api/health/diag?token=YOUR_TOKEN"
```

---

## 📊 Feature Checklist

### Core Features

- [x] Temporary email generation
- [x] Real-time email reception
- [x] Email forwarding
- [x] Email attachments
- [x] QR code sharing
- [x] Email search
- [x] Email templates

### Admin Features

- [x] User management
- [x] Domain management
- [x] Mailbox management
- [x] Analytics dashboard
- [x] SEO settings
- [x] Banner/ads management
- [x] Blog management
- [x] Subscription tiers
- [x] Payment integration (Stripe/PayPal)
- [x] Rate limiting
- [x] IP/Email/Country blocking
- [x] Maintenance scheduling
- [x] Alert system
- [x] Error logs
- [x] Cron job management
- [x] Backup system

### Security Features

- [x] JWT authentication
- [x] 2FA support
- [x] Rate limiting
- [x] IP blocking
- [x] Email verification
- [x] CSRF protection
- [x] XSS prevention
- [x] SQL injection prevention
- [x] Password hashing (bcrypt)
- [x] HTTPS enforcement

---

## 📞 Support

- **Documentation**: See `php-backend/README.md` for detailed API docs
- **Issues**: Submit via GitHub Issues
- **Admin Guide**: `/admin-guide` page in admin panel

---

## 📌 Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2025 | PHP backend, cPanel support, health check cron |
| 1.5 | 2024 | Subscription system, payment integration |
| 1.0 | 2024 | Initial release |
