# Backup & Restore Guide

This guide explains how to backup and restore your self-hosted temp email installation.

## Backup Overview

A complete backup includes:
1. **Database** - All user data, emails, settings
2. **Configuration** - Your config.php file
3. **Uploads** - Attachments, avatars, backups
4. **Encryption Keys** - Critical for encrypted emails

---

## Quick Backup (Manual)

### Database Backup

**Using phpMyAdmin:**
1. Open phpMyAdmin in cPanel
2. Select your database
3. Click **Export**
4. Format: **SQL**
5. Method: **Quick** (or Custom for large databases)
6. Click **Go**
7. Save the `.sql` file

**Using Command Line (SSH):**
```bash
# Full backup
mysqldump -u USERNAME -p DATABASE_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup (recommended for large databases)
mysqldump -u USERNAME -p DATABASE_NAME | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# With specific options for better restoration
mysqldump -u USERNAME -p \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  DATABASE_NAME > backup_full.sql
```

### File Backup

```bash
# Backup config (CRITICAL - contains encryption keys!)
cp public_html/api/config.php ~/backups/config.php.$(date +%Y%m%d)

# Backup uploads
tar -czf ~/backups/uploads_$(date +%Y%m%d).tar.gz public_html/uploads/

# Backup entire installation
tar -czf ~/backups/full_backup_$(date +%Y%m%d).tar.gz \
  public_html/api/config.php \
  public_html/uploads/ \
  --exclude='public_html/uploads/backups/*'
```

---

## Automated Backup Setup

### Option 1: Cron Job (Recommended)

Create a backup script:

```bash
#!/bin/bash
# /home/USERNAME/backup.sh

# Configuration
DB_USER="your_db_user"
DB_PASS="your_db_password"
DB_NAME="your_database"
BACKUP_DIR="/home/USERNAME/backups"
WEB_DIR="/home/USERNAME/public_html"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Database backup
echo "Backing up database..."
mysqldump -u $DB_USER -p$DB_PASS \
  --single-transaction \
  --routines \
  --triggers \
  $DB_NAME | gzip > $BACKUP_DIR/db_$TIMESTAMP.sql.gz

# Files backup
echo "Backing up files..."
tar -czf $BACKUP_DIR/files_$TIMESTAMP.tar.gz \
  -C $WEB_DIR \
  api/config.php \
  uploads/attachments \
  uploads/avatars

# Config backup (extra copy)
cp $WEB_DIR/api/config.php $BACKUP_DIR/config_$TIMESTAMP.php

# Cleanup old backups
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "files_*.tar.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "config_*.php" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $TIMESTAMP"
```

Make it executable and add to cron:
```bash
chmod +x ~/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add this line:
0 2 * * * /home/USERNAME/backup.sh >> /home/USERNAME/logs/backup.log 2>&1
```

### Option 2: cPanel Backup (GUI)

1. Go to **Backup** in cPanel
2. Under **Partial Backups**:
   - Download **Home Directory** backup
   - Download **MySQL Database** backup
3. Store backups in a secure location

### Option 3: Remote Backup (SSH/SFTP)

```bash
#!/bin/bash
# Sync backups to remote server

REMOTE_USER="backup_user"
REMOTE_HOST="backup.server.com"
REMOTE_DIR="/backups/tempemail"

# Sync backups
rsync -avz --delete \
  ~/backups/ \
  $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/
```

### Option 4: Cloud Backup (S3/Backblaze)

```bash
#!/bin/bash
# Upload to S3-compatible storage

BUCKET="your-bucket-name"
ENDPOINT="https://s3.amazonaws.com"

# Requires AWS CLI or rclone
aws s3 cp ~/backups/db_latest.sql.gz s3://$BUCKET/backups/ --endpoint-url=$ENDPOINT
aws s3 cp ~/backups/files_latest.tar.gz s3://$BUCKET/backups/ --endpoint-url=$ENDPOINT
```

---

## Restore Procedures

### Restore Database

**Using phpMyAdmin:**
1. Open phpMyAdmin
2. Select your database (or create new one)
3. Click **Import**
4. Choose your backup `.sql` file
5. Click **Go**

**Using Command Line:**
```bash
# From uncompressed SQL
mysql -u USERNAME -p DATABASE_NAME < backup.sql

# From compressed backup
gunzip < backup.sql.gz | mysql -u USERNAME -p DATABASE_NAME

# With progress (for large databases)
pv backup.sql.gz | gunzip | mysql -u USERNAME -p DATABASE_NAME
```

### Restore Files

```bash
# Restore config
cp ~/backups/config_TIMESTAMP.php public_html/api/config.php
chmod 644 public_html/api/config.php

# Restore uploads
tar -xzf ~/backups/files_TIMESTAMP.tar.gz -C public_html/

# Fix permissions
chmod -R 755 public_html/uploads/
```

### Full Disaster Recovery

If you need to restore everything to a new server:

1. **Set up new server** with PHP 8.0+, MySQL 8.0+
2. **Create database:**
   ```sql
   CREATE DATABASE temp_email CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'tempemail'@'localhost' IDENTIFIED BY 'password';
   GRANT ALL PRIVILEGES ON temp_email.* TO 'tempemail'@'localhost';
   ```
3. **Import database backup:**
   ```bash
   mysql -u tempemail -p temp_email < backup.sql
   ```
4. **Upload files:**
   - Upload API files
   - Upload frontend files
   - Restore config.php from backup
   - Restore uploads folder
5. **Update config.php** with new database credentials if needed
6. **Test everything**

---

## Encryption Key Backup

⚠️ **CRITICAL**: If you lose your encryption key, encrypted emails cannot be recovered!

### Backup Encryption Key

```bash
# Extract just the encryption key
grep -A1 'encryption_key' public_html/api/config.php > ~/secure_backup/encryption_key.txt

# Or manually copy these values from config.php:
# - security.encryption_key
# - security.jwt_secret
```

### Store Securely

1. **Password manager** (1Password, LastPass, Bitwarden)
2. **Encrypted file** on separate storage
3. **Printed copy** in secure location (for disasters)
4. **Never** in the same location as backups

---

## Backup Verification

Always verify your backups can be restored!

### Monthly Backup Test

```bash
# Create test database
mysql -u root -p -e "CREATE DATABASE temp_email_test;"

# Restore to test database
mysql -u root -p temp_email_test < latest_backup.sql

# Verify data
mysql -u root -p temp_email_test -e "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM temp_emails; SELECT COUNT(*) FROM received_emails;"

# Cleanup
mysql -u root -p -e "DROP DATABASE temp_email_test;"
```

### Verify File Integrity

```bash
# Check tar archive integrity
tar -tzf files_backup.tar.gz > /dev/null && echo "Archive OK" || echo "Archive CORRUPTED"

# Check gzip integrity
gzip -t db_backup.sql.gz && echo "OK" || echo "CORRUPTED"
```

---

## Backup Best Practices

### 3-2-1 Rule

- **3** copies of data
- **2** different storage types
- **1** offsite location

### Retention Policy

| Backup Type | Frequency | Retention |
|-------------|-----------|-----------|
| Full | Weekly | 4 weeks |
| Database | Daily | 30 days |
| Config | On change | 90 days |
| Encryption keys | Once | Forever |

### Security

- [ ] Encrypt backup files before offsite transfer
- [ ] Use strong passwords for backup archives
- [ ] Restrict access to backup directories
- [ ] Never commit config.php to git

```bash
# Encrypt backup before transfer
gpg -c --cipher-algo AES256 backup.sql.gz

# Decrypt
gpg -d backup.sql.gz.gpg > backup.sql.gz
```

---

## What to Backup

### Critical (Required for Recovery)

| Item | Location | Priority |
|------|----------|----------|
| Database | MySQL | ⭐⭐⭐ |
| config.php | api/config.php | ⭐⭐⭐ |
| Encryption Key | In config.php | ⭐⭐⭐ |
| Email Attachments | uploads/attachments/ | ⭐⭐ |
| User Avatars | uploads/avatars/ | ⭐ |

### Optional

| Item | Location | Notes |
|------|----------|-------|
| Frontend build | dist/ | Can be rebuilt |
| API code | api/ | Can be re-downloaded |
| Logs | logs/ | For debugging only |

---

## Automated Backup Monitoring

### Email Notification

Add to your backup script:

```bash
#!/bin/bash
# At the end of backup.sh

ADMIN_EMAIL="admin@yourdomain.com"

# Check if backup succeeded
if [ -f "$BACKUP_DIR/db_$TIMESTAMP.sql.gz" ]; then
    SIZE=$(ls -lh $BACKUP_DIR/db_$TIMESTAMP.sql.gz | awk '{print $5}')
    echo "Backup completed successfully. Size: $SIZE" | \
      mail -s "✅ Backup Success: $TIMESTAMP" $ADMIN_EMAIL
else
    echo "Backup FAILED at $TIMESTAMP" | \
      mail -s "❌ Backup FAILED" $ADMIN_EMAIL
fi
```

### Backup Size Tracking

```sql
-- Track backup history in database
CREATE TABLE IF NOT EXISTS backup_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  backup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  db_size_bytes BIGINT,
  files_size_bytes BIGINT,
  status ENUM('success', 'failed') DEFAULT 'success',
  notes TEXT
);
```

---

## Emergency Procedures

### Lost Encryption Key

If you've lost your encryption key:
1. **Unencrypted emails** - Still accessible
2. **Encrypted emails** - Cannot be recovered
3. **Generate new key** for future emails
4. **Inform users** about data loss

### Corrupted Database

```sql
-- Check tables
CHECK TABLE users, temp_emails, received_emails;

-- Repair if needed
REPAIR TABLE received_emails;

-- Optimize after repair
OPTIMIZE TABLE received_emails;
```

### Ransomware Recovery

1. **Do NOT pay** the ransom
2. **Isolate** affected systems
3. **Restore from clean backup** (verify it's not infected)
4. **Change all passwords** and keys
5. **Investigate** how the breach occurred

---

## Quick Reference

### Daily Backup Command
```bash
mysqldump -u USER -pPASS DB | gzip > ~/backups/daily_$(date +%Y%m%d).sql.gz
```

### Quick Restore Command
```bash
gunzip < ~/backups/daily_YYYYMMDD.sql.gz | mysql -u USER -pPASS DB
```

### Verify Backup
```bash
gzip -t backup.sql.gz && tar -tzf files.tar.gz > /dev/null && echo "Backups OK"
```
