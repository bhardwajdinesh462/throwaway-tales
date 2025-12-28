# Self-Hosted Temp Email - Deployment Guide

## Quick Start

### 1. Server Requirements
- PHP 8.0+ with extensions: `pdo_mysql`, `openssl`, `imap`, `json`, `mbstring`, `curl`
- MySQL 8.0+
- Apache with `mod_rewrite` enabled
- SSL certificate (strongly recommended)

### 2. Database Setup

1. Create MySQL database:
```sql
CREATE DATABASE temp_email CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tempemail'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON temp_email.* TO 'tempemail'@'localhost';
FLUSH PRIVILEGES;
```

2. Import schema:
```bash
mysql -u tempemail -p temp_email < database/schema.mysql.sql
mysql -u tempemail -p temp_email < database/seed-data.sql
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
- SMTP/IMAP settings
- Stripe keys (if using payments)

### 4. Build Frontend

```bash
cd frontend
npm install
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
chmod 777 uploads/
chmod 777 uploads/attachments/
chmod 777 uploads/backups/
```

### 7. Setup Cron Job (cPanel)

Add cron job for IMAP polling (every 2 minutes):
```
*/2 * * * * /usr/bin/php /home/username/public_html/api/imap/poll.php >> /home/username/logs/imap.log 2>&1
```

### 8. First Login

- URL: `https://yourdomain.com/auth`
- Email: `admin@yourdomain.com`
- Password: `Admin123!`

**⚠️ CHANGE THE ADMIN PASSWORD IMMEDIATELY!**

---

## Troubleshooting

### Common Issues

**500 Internal Server Error**
- Check PHP error logs
- Verify `.htaccess` is enabled
- Check file permissions

**Database Connection Failed**
- Verify credentials in `config.php`
- Check MySQL is running
- Test connection: `mysql -u user -p database`

**Emails Not Receiving**
- Check IMAP credentials
- Verify cron job is running
- Check `cron_runs` table for errors

**CORS Errors**
- Update `ALLOWED_ORIGINS` in `config.php`

---

## Security Checklist

- [ ] Changed default admin password
- [ ] Set strong JWT secret
- [ ] Set strong encryption key
- [ ] Enabled SSL/HTTPS
- [ ] Disabled directory listing
- [ ] Set proper file permissions
- [ ] Configured rate limiting
- [ ] Set up regular backups
