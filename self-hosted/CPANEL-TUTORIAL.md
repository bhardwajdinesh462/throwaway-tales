# cPanel Deployment Tutorial

## Deploy Self-Hosted Temp Email on cPanel

**Duration:** ~20 minutes  
**Difficulty:** Beginner-friendly

---

## INTRO

This guide walks you through deploying your self-hosted temporary email system on any shared hosting with cPanel. By the end, you'll have a fully working temp email service with:
- **Instant email delivery** via webhooks (recommended)
- **Real-time updates** via Server-Sent Events
- **Fallback polling** via IMAP

---

## PART 1: REQUIREMENTS CHECK

**Navigate to cPanel and verify:**

### PHP Version
1. Go to **Select PHP Version**
2. Select **PHP 8.1** or higher (8.2 recommended)
3. Enable these extensions:
   - `pdo_mysql` (required)
   - `openssl` (required)
   - `json` (required)
   - `mbstring` (required)
   - `curl` (required)
   - `imap` (optional - for IMAP polling fallback)
4. Click **Save**

### MySQL Version
- Verify MySQL 8.0+ in phpMyAdmin (most modern hosts have this)

---

## PART 2: DATABASE SETUP

### Step 1: Create Database
1. Open **MySQL Databases** in cPanel
2. Create a new database (e.g., `yourusername_tempemail`)
3. Create a new user with a strong password
4. Add the user to the database with **ALL PRIVILEGES**

### Step 2: Import Schema
1. Open **phpMyAdmin**
2. Select your new database
3. Go to **Import** tab
4. Import these files in order:

**First:** `database/schema.mysql.sql` (main schema)
```
This creates all tables, triggers, and events
```

**Second:** `database/seed-data.sql` (default data)
```
This adds default domains and settings
```

**Third:** `database/optimize.sql` (performance + webhooks)
```
This adds webhook tables, indexes, and stored procedures
```

### Step 3: Enable Event Scheduler
In phpMyAdmin SQL tab, run:
```sql
SET GLOBAL event_scheduler = ON;
```
> Note: Some shared hosts may not allow this. The system will still work, but automatic cleanup won't run.

---

## PART 3: UPLOAD FILES

### Step 1: Upload API Files
1. Open **File Manager** in cPanel
2. Navigate to `public_html`
3. Create folder: `api`
4. Upload all contents from `self-hosted/api/` to `public_html/api/`
5. Preserve folder structure (auth/, core/, emails/, cron/, etc.)

### Step 2: Create Uploads Directory
```
public_html/
├── api/
└── uploads/
    ├── attachments/
    ├── avatars/
    └── backups/
```

### Step 3: Upload .htaccess
Upload `self-hosted/.htaccess` to `public_html/`

---

## PART 4: CONFIGURE API

### Step 1: Create Config File
1. In `public_html/api/`, copy `config.example.php` to `config.php`
2. Edit `config.php` with your settings:

```php
return [
    // DATABASE
    'database' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'yourusername_tempemail',
        'username' => 'your_db_user',
        'password' => 'your_db_password',
        'charset' => 'utf8mb4',
    ],

    // APPLICATION
    'app' => [
        'name' => 'Temp Email',
        'url' => 'https://yourdomain.com',
        'debug' => false,  // Set true temporarily if debugging
        'timezone' => 'UTC',
    ],

    // SECURITY (Generate these: openssl rand -hex 32)
    'security' => [
        'jwt_secret' => 'GENERATE_RANDOM_64_CHAR_STRING',
        'jwt_expiry_hours' => 24,
        'encryption_key' => 'GENERATE_ANOTHER_RANDOM_STRING',
        'allowed_origins' => [
            'https://yourdomain.com',
        ],
    ],

    // WEBHOOKS (for instant email delivery - RECOMMENDED)
    'webhooks' => [
        'enabled' => true,
        'secrets' => [
            // Add your provider's secret here
            // 'mailgun' => 'your-mailgun-api-key',
            // 'sendgrid' => 'your-sendgrid-webhook-secret',
            // 'postmark' => 'your-postmark-server-token',
            // 'custom' => 'your-custom-secret',
        ],
    ],

    // IMAP (fallback if webhooks not available)
    'imap' => [
        'enabled' => true,
        'host' => 'mail.yourdomain.com',
        'port' => 993,
        'username' => 'catchall@yourdomain.com',
        'password' => 'your_imap_password',
        'encryption' => 'ssl',
        'folder' => 'INBOX',
        'poll_interval' => 120,
        'max_emails_per_poll' => 50,
    ],

    // SMTP (for sending verification emails)
    'smtp' => [
        'enabled' => true,
        'host' => 'mail.yourdomain.com',
        'port' => 587,
        'username' => 'noreply@yourdomain.com',
        'password' => 'your_smtp_password',
        'encryption' => 'tls',
        'from_email' => 'noreply@yourdomain.com',
        'from_name' => 'Temp Email',
    ],

    // RATE LIMITING
    'rate_limits' => [
        'emails_per_hour' => 20,
        'api_per_minute' => 60,
        'webhook_per_minute' => 100,
        'login_attempts' => 5,
        'lockout_minutes' => 15,
    ],
];
```

---

## PART 5: BUILD & UPLOAD FRONTEND

### On Your Local Machine
```bash
cd self-hosted/frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env
VITE_API_URL=/api

# Build for production
npm run build
```

### Upload to cPanel
1. Upload contents of `dist/` folder to `public_html/`:
   - `index.html`
   - `assets/` folder
   - Any other generated files

2. Your final structure should be:
```
public_html/
├── index.html
├── assets/
├── api/
│   ├── config.php
│   ├── auth/
│   ├── core/
│   ├── emails/
│   ├── cron/
│   └── ...
├── uploads/
└── .htaccess
```

---

## PART 6: SET PERMISSIONS

### File Manager Permissions
| Path | Permission |
|------|------------|
| `uploads/` | 755 |
| `uploads/attachments/` | 755 |
| `uploads/avatars/` | 755 |
| `uploads/backups/` | 755 |
| `api/config.php` | 644 |

### Verify .htaccess Protection
The `.htaccess` in `api/` folder blocks direct access to `config.php`:
```apache
<Files "config.php">
    Order Allow,Deny
    Deny from all
</Files>
```

---

## PART 7: EMAIL DELIVERY SETUP

You have two options for receiving emails:

### Option A: Webhooks (RECOMMENDED - Instant Delivery)

Configure your email provider to send webhooks to:
```
https://yourdomain.com/api/emails/webhook.php
```

**Supported Providers:**
- **Mailgun**: Settings → Webhooks → Add inbound webhook
- **SendGrid**: Settings → Inbound Parse → Add Host & URL
- **Postmark**: Servers → Inbound → Set webhook URL
- **ForwardEmail.net**: Domain settings → Add webhook
- **Custom**: Any service that POSTs email data

See `WEBHOOK-SETUP.md` for detailed provider instructions.

### Option B: IMAP Polling (Fallback - 2 min delay)

If webhooks aren't available, set up IMAP polling:

1. Create catch-all email in cPanel (**Email** → **Default Address**)
2. Set up cron job in cPanel (**Cron Jobs**):

**IMAP Poll (every 2 minutes):**
```
*/2 * * * * /usr/bin/php /home/YOURUSERNAME/public_html/api/imap/poll.php >> /home/YOURUSERNAME/logs/imap.log 2>&1
```

**Daily Cleanup (3 AM):**
```
0 3 * * * /usr/bin/php /home/YOURUSERNAME/public_html/api/cron/cleanup.php >> /home/YOURUSERNAME/logs/cleanup.log 2>&1
```

**Session Cleanup (every hour):**
```
0 * * * * /usr/bin/php /home/YOURUSERNAME/public_html/api/cron/sessions.php >> /home/YOURUSERNAME/logs/sessions.log 2>&1
```

> Replace `YOURUSERNAME` with your cPanel username

---

## PART 8: SSL CERTIFICATE SETUP

SSL is **required** for production. Most cPanel hosts offer free SSL.

### Option A: AutoSSL (Recommended)
1. Go to **SSL/TLS Status** in cPanel
2. Click **Run AutoSSL**
3. Wait for certificate to be issued (usually instant)
4. Verify: Visit `https://yourdomain.com`

### Option B: Let's Encrypt
1. Go to **SSL/TLS** → **Manage SSL Sites**
2. Or look for **Let's Encrypt SSL** in cPanel
3. Select your domain and click **Issue**

### Option C: Cloudflare (Free CDN + SSL)
1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Add your domain
3. Update nameservers at your registrar
4. Enable **Full (Strict)** SSL mode
5. Benefits: Free SSL, CDN, DDoS protection

### Force HTTPS
The `.htaccess` file already includes HTTPS redirect:
```apache
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### Verify SSL
```bash
# Check certificate
curl -vI https://yourdomain.com 2>&1 | grep -i "SSL certificate"

# Test from browser
# Look for 🔒 padlock in address bar
```

---

## PART 9: TEST YOUR SETUP

### Step 1: Basic Tests
1. Visit `https://yourdomain.com` - homepage should load with 🔒
2. Click **Generate Email** - a temp address should appear
3. Copy the email address

### Step 2: Test Webhook Endpoint

**Quick test with curl:**
```bash
# First, generate a temp email on your site and note the address
# Then test the webhook:

curl -X POST https://yourdomain.com/api/emails/webhook.php \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-custom-secret" \
  -d '{
    "recipient": "GENERATED_ADDRESS@yourdomain.com",
    "from": "test@example.com",
    "from_name": "Test Sender",
    "subject": "Webhook Test",
    "body_plain": "This email was delivered via webhook!",
    "body_html": "<p>This email was delivered via <strong>webhook</strong>!</p>"
  }'
```

**Expected responses:**

✅ Success:
```json
{
  "success": true,
  "data": { "accepted": true, "email_id": "uuid-here" },
  "message": "Email received successfully"
}
```

⚠️ Address not found:
```json
{
  "success": true,
  "data": { "accepted": false, "reason": "Address not found" }
}
```

❌ Error:
```json
{
  "success": false,
  "error": "Error message here"
}
```

### Step 3: Verify Email Arrived
1. Refresh the inbox on your site
2. The test email should appear instantly
3. Check **Admin → Webhooks** for delivery logs

### Step 4: Test Real-Time Updates
1. Open inbox in browser
2. In another terminal, send another webhook test
3. Email should appear WITHOUT refreshing the page

### Step 5: Test IMAP Fallback (if configured)
1. Send a real email to your generated address
2. Wait 2-3 minutes for cron
3. Check inbox

### Step 6: Check Webhook Logs
```sql
-- In phpMyAdmin, run:
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 10;
```

---

## PART 10: ADMIN SETUP

### Create Admin Account
1. Register a new account on your site
2. Open **phpMyAdmin**
3. Navigate to the `user_roles` table
4. Find your user in the `users` table, copy the `id`
5. Insert a new row:
   - `id`: (auto-generated)
   - `user_id`: your user ID
   - `role`: `admin`
   - `granted_at`: (current timestamp)

### Access Admin Panel
Navigate to `https://yourdomain.com/admin`

---

## CONGRATULATIONS! 🎉

Your self-hosted temp email system is now running with:
- ✅ SSL/HTTPS encryption
- ✅ Instant webhook email delivery
- ✅ Real-time browser updates (SSE)
- ✅ Optimized database
- ✅ Automatic cleanup

### Next Steps
- Add more domains in Admin → Domains
- Configure appearance in Admin → Appearance
- Set up Stripe payments in Admin → Payments (optional)
- Review webhook logs in Admin → Webhooks
- **Set up automated backups** - See `BACKUP.md`

---

## PART 11: AUTOMATED BACKUPS

Set up daily automatic backups to protect your data.

### Step 1: Create Backup Script

In cPanel File Manager, create `~/backup.sh`:

```bash
#!/bin/bash
DB_USER="your_db_user"
DB_PASS="your_db_password"
DB_NAME="your_database"
BACKUP_DIR="/home/YOURUSERNAME/backups"
WEB_DIR="/home/YOURUSERNAME/public_html"

mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +%Y%m%d)

# Backup database
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/db_$TIMESTAMP.sql.gz

# Backup config and uploads
tar -czf $BACKUP_DIR/files_$TIMESTAMP.tar.gz -C $WEB_DIR api/config.php uploads/

# Keep only last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $TIMESTAMP"
```

### Step 2: Make Executable

```bash
chmod +x ~/backup.sh
```

### Step 3: Add Cron Job

In cPanel **Cron Jobs**, add:
```
0 2 * * * /home/YOURUSERNAME/backup.sh >> /home/YOURUSERNAME/logs/backup.log 2>&1
```

This runs daily at 2 AM.

> 📖 See `BACKUP.md` for complete backup and restore procedures.

---

## PART 12: REAL-TIME VERIFICATION

Verify real-time updates are working correctly.

### Test 1: Browser Console Check

1. Open browser Developer Tools (F12)
2. Go to **Console** tab
3. Look for SSE connection messages:
   ```
   [SSE] Connecting to: /api/emails/websocket.php?token=xxx
   [SSE] Connected
   ```

### Test 2: Network Tab Check

1. Open Developer Tools → **Network** tab
2. Filter by "websocket" or "eventsource"
3. You should see an open SSE connection

### Test 3: Send Test Email

With the inbox open:
1. Send an email to your generated address
2. Watch for:
   - Toast notification appearing
   - Email appearing in inbox WITHOUT refreshing
   - Sound playing (if enabled)

### Fallback Behavior

If SSE fails, the system automatically falls back to polling:
- Console shows: `[SSE] Connection error, falling back to polling`
- Inbox updates every 5 seconds instead of instantly

### Common SSE Issues

| Issue | Solution |
|-------|----------|
| Connection times out | Normal - reconnects automatically |
| Falls back to polling | Check PHP execution limits |
| No connection at all | Check API URL in .env |

---

## TROUBLESHOOTING

### 500 Error on API Calls
- Check PHP error logs in cPanel → Errors
- Verify `config.php` syntax: `php -l api/config.php`
- Ensure all required PHP extensions are enabled
- Check file permissions

### Emails Not Appearing

**Webhook issues:**
```sql
-- Check webhook logs
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 20;
```

**IMAP issues:**
- Check cron log: `tail -f ~/logs/imap.log`
- Verify IMAP credentials
- Test IMAP connection manually

### Real-Time Updates Not Working
- SSE requires `keep-alive` connections
- Some shared hosts may timeout long connections
- Check browser console for SSE errors
- Falls back to polling automatically (5s interval)

**Fix for LiteSpeed servers:**
Add to `.htaccess`:
```apache
<IfModule LiteSpeed>
  RewriteRule ^api/emails/websocket\.php - [E=noabort:1]
</IfModule>
```

### "Class not found" Errors
- Verify file structure matches expected paths
- Check PHP version (8.0+ required)
- Ensure all files were uploaded

### CORS Errors
- Verify `allowed_origins` in `config.php`
- Check `.htaccess` is uploaded
- Ensure `https://` matches your actual URL

### Can't Login
- Clear browser cache
- Check `sessions` table in database
- Verify `jwt_secret` is set

### Database Errors
```sql
-- Check for missing tables
SHOW TABLES;

-- Repair if needed
REPAIR TABLE received_emails;
ANALYZE TABLE received_emails;
```

### Performance Issues
```sql
-- Run optimization
SOURCE database/optimize.sql;

-- Check slow queries
SHOW PROCESSLIST;
```

---

## SECURITY CHECKLIST

- [ ] Changed default admin password
- [ ] Generated unique `jwt_secret` (64 chars)
- [ ] Generated unique `encryption_key` (64 chars)
- [ ] SSL/HTTPS enabled
- [ ] `config.php` is not web-accessible
- [ ] Webhook secrets configured
- [ ] Rate limiting enabled
- [ ] Automated backups configured

---

## ADDITIONAL RESOURCES

| Guide | Description |
|-------|-------------|
| `BACKUP.md` | Complete backup and restore procedures |
| `UPGRADE.md` | Version migration instructions |
| `WEBHOOK-SETUP.md` | Email provider webhook configuration |
| `DEPLOYMENT.md` | Quick deployment reference |

---

## FEATURE COMPARISON

Your self-hosted installation includes all features of the cloud version:

| Feature | Cloud | Self-Hosted |
|---------|-------|-------------|
| Instant email (webhooks) | ✅ | ✅ |
| Real-time updates (SSE) | ✅ Supabase | ✅ SSE |
| Push notifications | ✅ | ✅ |
| Email encryption | ✅ | ✅ |
| 2FA authentication | ✅ | ✅ |
| Webhook testing UI | ✅ | ✅ |
| Admin dashboard | ✅ | ✅ |
| Stripe payments | ✅ | ✅ |
| Custom domains | ✅ | ✅ |
| Email forwarding | ✅ | ✅ |
| File attachments | ✅ | ✅ |

---

## SUPPORT

If you encounter issues:
1. Check the troubleshooting section above
2. Review PHP error logs in cPanel
3. Check database for missing tables
4. Open an issue on GitHub with server details
