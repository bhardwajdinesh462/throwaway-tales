# Server Requirements

## Minimum Requirements

### PHP
- **Version:** PHP 8.0 or higher (PHP 8.1+ recommended)
- **Required Extensions:**
  - `pdo_mysql` - MySQL database connection
  - `openssl` - Encryption and JWT
  - `json` - JSON encoding/decoding
  - `mbstring` - Multibyte string handling
  - `imap` - IMAP email fetching (for polling)
  - `curl` - External API calls (Stripe, etc.)
  - `fileinfo` - File upload validation

### MySQL
- **Version:** MySQL 8.0 or higher
- **Charset:** utf8mb4_unicode_ci
- **Storage Engine:** InnoDB

### Web Server
- **Apache 2.4+** with `mod_rewrite` enabled
- OR **Nginx** with proper configuration

### Hosting
- Shared hosting with cPanel/Plesk works fine
- VPS/Dedicated server for higher traffic
- Minimum 512MB RAM (1GB+ recommended)
- 1GB+ disk space for application and attachments

## Checking Your Server

### Via SSH
```bash
# Check PHP version
php -v

# Check PHP modules
php -m | grep -E "(pdo_mysql|openssl|json|mbstring|imap|curl|fileinfo)"

# Check MySQL version
mysql --version
```

### Via PHP Script
Create a file `check.php`:
```php
<?php
echo "PHP Version: " . phpversion() . "\n";
echo "Required Extensions:\n";

$required = ['pdo_mysql', 'openssl', 'json', 'mbstring', 'imap', 'curl', 'fileinfo'];

foreach ($required as $ext) {
    $status = extension_loaded($ext) ? "✓ Installed" : "✗ Missing";
    echo "  - {$ext}: {$status}\n";
}
```

## Installing Missing Extensions

### cPanel
1. Go to "Select PHP Version"
2. Check the required extensions
3. Click "Save"

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install php8.1-mysql php8.1-mbstring php8.1-imap php8.1-curl
sudo systemctl restart apache2
```

### CentOS/RHEL
```bash
sudo yum install php-mysql php-mbstring php-imap php-curl
sudo systemctl restart httpd
```

## IMAP Extension

The IMAP extension is critical for email polling. If not available:

1. **Option 1:** Use webhook-based email reception instead
2. **Option 2:** Ask hosting provider to enable it
3. **Option 3:** Compile PHP with IMAP support

## SSL/TLS Certificate

**Strongly Recommended:**
- HTTPS for all traffic
- Free via Let's Encrypt
- Most shared hosting provides free SSL

## Email Server Requirements

For receiving emails, you need:
- A domain with MX records pointing to your mail server
- IMAP access to a catch-all mailbox
- OR Webhook integration with an email service (Mailgun, SendGrid)

### Recommended Setup
1. Use a catch-all email address (e.g., `*@yourdomain.com`)
2. Configure IMAP settings in `config.php`
3. Set up cron job for polling

## Performance Recommendations

### PHP Settings
```ini
memory_limit = 256M
max_execution_time = 300
post_max_size = 30M
upload_max_filesize = 25M
```

### MySQL Optimization
```sql
-- For high-traffic deployments
SET GLOBAL innodb_buffer_pool_size = 256M;
SET GLOBAL max_connections = 200;
```

### Caching (Optional)
- Redis or Memcached for session storage
- OPcache for PHP bytecode caching (usually enabled by default)

## Troubleshooting

### "Class 'PDO' not found"
Install php-pdo:
```bash
sudo apt install php-pdo php-mysql
```

### "imap_open(): Unable to connect"
- Check IMAP credentials
- Verify port is not blocked by firewall
- Try with `novalidate-cert` flag for self-signed certs

### "500 Internal Server Error"
- Check PHP error logs: `/var/log/apache2/error.log` or `/var/log/php-fpm.log`
- Enable debug mode in `config.php`
- Check file permissions

### "Cannot write to uploads directory"
```bash
chmod 755 uploads
chmod -R 644 uploads/*
chown -R www-data:www-data uploads  # Apache
chown -R nginx:nginx uploads        # Nginx
```
