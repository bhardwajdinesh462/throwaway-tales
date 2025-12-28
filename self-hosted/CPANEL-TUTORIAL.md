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

## PART 8: TEST YOUR SETUP

### Basic Tests
1. Visit `https://yourdomain.com` - homepage should load
2. Click **Generate Email** - a temp address should appear
3. Copy the email address

### Test Email Delivery

**If using webhooks:**
```bash
# Test webhook endpoint
curl -X POST https://yourdomain.com/api/emails/webhook.php \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{
    "recipient": "test@yourdomain.com",
    "from": "sender@example.com",
    "subject": "Test Email",
    "body_plain": "This is a test"
  }'
```

**If using IMAP:**
1. Send an email to the generated address
2. Wait 2-3 minutes for cron to run
3. Refresh inbox

### Check Webhook Logs (Admin Panel)
Navigate to **Admin → Webhooks** to see incoming webhook activity.

### Real-Time Updates
The inbox should update automatically without refreshing when new emails arrive (via SSE).

---

## PART 9: ADMIN SETUP

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

## CONGRATULATIONS!

Your self-hosted temp email system is now running with:
- ✅ Instant webhook email delivery
- ✅ Real-time browser updates
- ✅ Optimized database
- ✅ Automatic cleanup

### Next Steps
- Add more domains in Admin → Domains
- Configure appearance in Admin → Appearance
- Set up Stripe payments in Admin → Payments (optional)
- Review webhook logs in Admin → Webhooks

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
- Falls back to polling automatically

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
- [ ] Regular backups scheduled
