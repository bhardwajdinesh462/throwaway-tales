# Upgrade Guide

This guide explains how to safely upgrade your self-hosted temp email installation to a newer version.

## Before You Begin

### Pre-Upgrade Checklist

- [ ] **Backup your database** (see BACKUP.md)
- [ ] **Backup your files** (api/, uploads/, config.php)
- [ ] **Note your current version** (check the admin dashboard or CHANGELOG)
- [ ] **Read the release notes** for breaking changes
- [ ] **Schedule maintenance window** during low-traffic period
- [ ] **Test in staging first** if possible

### Check Your Current Version

```sql
-- In phpMyAdmin, check app_settings
SELECT * FROM app_settings WHERE `key` = 'version';
```

Or check the version in your admin dashboard under Settings → About.

---

## Standard Upgrade Process

### Step 1: Enable Maintenance Mode

Create a maintenance page to show visitors:

```php
// maintenance.php (upload to public_html)
<?php
header('HTTP/1.1 503 Service Temporarily Unavailable');
header('Retry-After: 3600');
?>
<!DOCTYPE html>
<html>
<head>
    <title>Maintenance</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 50px; }
        h1 { color: #333; }
    </style>
</head>
<body>
    <h1>🔧 Maintenance in Progress</h1>
    <p>We're upgrading our systems. Please check back in a few minutes.</p>
</body>
</html>
```

Add to `.htaccess` (temporarily):
```apache
RewriteEngine On
RewriteCond %{REQUEST_URI} !^/maintenance\.php$
RewriteCond %{REMOTE_ADDR} !^YOUR\.IP\.ADDRESS$
RewriteRule ^(.*)$ /maintenance.php [R=503,L]
```

### Step 2: Backup Current Installation

```bash
# Create backup directory
mkdir -p ~/backups/$(date +%Y%m%d)

# Backup database
mysqldump -u USERNAME -p DATABASE_NAME > ~/backups/$(date +%Y%m%d)/database.sql

# Backup files
cp -r public_html/api ~/backups/$(date +%Y%m%d)/api
cp -r public_html/uploads ~/backups/$(date +%Y%m%d)/uploads
cp public_html/api/config.php ~/backups/$(date +%Y%m%d)/config.php
```

### Step 3: Download New Version

Download the latest release from the repository or releases page.

### Step 4: Upload Updated Files

**Important:** Keep these files from your current installation:
- `api/config.php` (your configuration)
- `uploads/` folder (user data)

Upload new files:
1. Upload new `api/` contents (except config.php)
2. Upload new frontend `dist/` files
3. Upload new `.htaccess` if changed

### Step 5: Run Database Migrations

Check the `database/` folder for any new migration files:

```bash
# Example: If upgrading from v1.0 to v1.1
mysql -u USERNAME -p DATABASE_NAME < database/migrations/v1.1.sql
```

Or in phpMyAdmin:
1. Go to **Import** tab
2. Select the migration file
3. Click **Go**

### Step 6: Update Configuration

Compare your `config.php` with `config.example.php` for new settings:

```php
// Check for new settings like:
'webhooks' => [
    'enabled' => true,
    'secrets' => [],
],

'realtime' => [
    'enabled' => true,
    'poll_interval_ms' => 3000,
],
```

### Step 7: Clear Caches

```bash
# If using OPcache
php -r "opcache_reset();"

# Or restart PHP-FPM (if available)
sudo service php-fpm restart
```

In cPanel with LiteSpeed:
1. Go to **LiteSpeed Web Cache Manager**
2. Click **Flush All**

### Step 8: Verify Upgrade

1. Test the homepage loads
2. Generate a new temp email
3. Send a test email
4. Check admin panel access
5. Verify webhook logs (if using webhooks)

### Step 9: Disable Maintenance Mode

Remove the maintenance rewrite rules from `.htaccess`.

---

## Version-Specific Upgrades

### Upgrading to v2.0 (Webhooks + Real-time)

This version adds webhook support and real-time updates.

**Database changes:**
```sql
-- Run optimize.sql for new tables and indexes
SOURCE database/optimize.sql;
```

**New config settings:**
```php
// Add to config.php
'webhooks' => [
    'enabled' => true,
    'secrets' => [
        // Add your provider secrets
    ],
    'rate_limit_per_minute' => 100,
],

'realtime' => [
    'enabled' => true,
    'poll_interval_ms' => 3000,
    'connection_timeout' => 30,
],
```

**New cron job (optional - for cleanup):**
```
0 * * * * /usr/bin/php /home/USER/public_html/api/cron/sessions.php >> /home/USER/logs/sessions.log 2>&1
```

### Upgrading to v1.5 (Encryption)

This version adds email encryption.

**Generate encryption key:**
```bash
openssl rand -hex 32
```

**Add to config.php:**
```php
'security' => [
    // ... existing settings
    'encryption_key' => 'YOUR_64_CHAR_KEY_HERE',
],
```

**Migrate existing emails (optional):**
```sql
-- This will encrypt existing unencrypted emails
-- Run the encryption migration script
CALL encrypt_existing_emails();
```

---

## Rollback Procedure

If something goes wrong, restore from backup:

### Step 1: Restore Database

```bash
mysql -u USERNAME -p DATABASE_NAME < ~/backups/YYYYMMDD/database.sql
```

### Step 2: Restore Files

```bash
# Restore API files
rm -rf public_html/api
cp -r ~/backups/YYYYMMDD/api public_html/

# Restore config
cp ~/backups/YYYYMMDD/config.php public_html/api/config.php
```

### Step 3: Test

Verify the site is working with the previous version.

---

## Zero-Downtime Upgrade (Advanced)

For high-traffic sites, consider a blue-green deployment:

### Step 1: Create Staging Environment

```bash
# Create staging directory
mkdir public_html_staging

# Deploy new version to staging
cp -r new_version/* public_html_staging/
cp public_html/api/config.php public_html_staging/api/config.php
```

### Step 2: Run Migrations

Apply database migrations that are backward-compatible.

### Step 3: Switch Traffic

```bash
# Atomic swap
mv public_html public_html_old
mv public_html_staging public_html
```

### Step 4: Cleanup

After verifying the upgrade:
```bash
rm -rf public_html_old
```

---

## Troubleshooting Upgrades

### "Class not found" Errors

- Verify all PHP files were uploaded
- Check file permissions (644 for files, 755 for directories)
- Clear OPcache

### Database Migration Fails

- Check MySQL version compatibility
- Verify user has sufficient privileges
- Look for syntax errors in migration file
- Check character set (utf8mb4)

### 500 Internal Server Error

1. Enable debug mode:
   ```php
   'app' => [
       'debug' => true,
   ],
   ```
2. Check PHP error logs in cPanel
3. Verify config.php syntax

### Config Changes Not Applying

- Clear browser cache
- Clear PHP OPcache
- Restart PHP-FPM (if applicable)

### Real-time Updates Not Working

- Check SSE endpoint is accessible
- Verify mod_proxy is not buffering
- Check for PHP execution time limits
- Some shared hosts don't support long connections

---

## Automated Upgrade Script (Advanced)

For advanced users, create an upgrade script:

```bash
#!/bin/bash
# upgrade.sh

set -e

BACKUP_DIR=~/backups/$(date +%Y%m%d_%H%M%S)
WEB_DIR=~/public_html

echo "Creating backup..."
mkdir -p $BACKUP_DIR
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/database.sql
cp -r $WEB_DIR/api $BACKUP_DIR/
cp -r $WEB_DIR/uploads $BACKUP_DIR/

echo "Downloading new version..."
# wget or curl the new version

echo "Applying updates..."
# Copy new files, keeping config.php

echo "Running migrations..."
mysql -u $DB_USER -p$DB_PASS $DB_NAME < database/migrations/latest.sql

echo "Clearing caches..."
php -r "opcache_reset();" 2>/dev/null || true

echo "Upgrade complete!"
```

---

## Getting Help

If you encounter issues:

1. Check the **Troubleshooting** section in CPANEL-TUTORIAL.md
2. Review PHP error logs
3. Check database for failed migrations
4. Open an issue on GitHub with:
   - Current version
   - Target version
   - Error messages
   - Server environment details
