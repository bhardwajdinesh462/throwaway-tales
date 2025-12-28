# Self-Hosted Troubleshooting Guide

This guide helps you diagnose and fix common issues with your self-hosted temp email installation.

## Table of Contents

1. [Email Not Generating](#email-not-generating)
2. [Admin Login Not Working](#admin-login-not-working)
3. [Pages Not Loading](#pages-not-loading)
4. [Users Not Showing in Admin](#users-not-showing-in-admin)
5. [Webhook Configuration](#webhook-configuration)
6. [Database Issues](#database-issues)
7. [CORS Errors](#cors-errors)
8. [Debugging Tips](#debugging-tips)

---

## Email Not Generating

### Symptoms
- Clicking "Generate Email" shows loading but never completes
- Error messages about domains or database

### Fixes

#### 1. Check if domains exist in database
```sql
SELECT * FROM domains WHERE is_active = 1;
```

If empty, you need to add domains:
```sql
-- Add your actual domain (replace yourdomain.com)
INSERT INTO domains (id, domain, display_name, is_active, mx_verified) VALUES
(UUID(), 'yourdomain.com', 'Your Domain', 1, 1);
```

#### 2. Check API connection
Open browser console (F12) and look for errors when generating email.

Common errors:
- `Failed to fetch` - API URL is wrong or CORS issue
- `No active domains available` - Add domains to database
- `503 error` - Database connection issue

#### 3. Verify config.php
Ensure your `config.php` has correct database settings:
```php
'database' => [
    'host' => 'localhost',
    'name' => 'your_database_name',
    'username' => 'your_db_user',
    'password' => 'your_password',
]
```

---

## Admin Login Not Working

### Symptoms
- Login form submits but nothing happens
- "Invalid credentials" error despite correct password
- Gets stuck on login page

### Fixes

#### 1. Check if admin user exists
```sql
SELECT u.*, ur.role FROM users u 
LEFT JOIN user_roles ur ON ur.user_id = u.id 
WHERE u.email = 'admin@yourdomain.com';
```

#### 2. Create admin user manually
If no admin exists:
```sql
-- Password: Admin123! (change immediately after first login!)
INSERT INTO users (id, email, password_hash, email_verified, email_verified_at, created_at, updated_at) VALUES
(UUID(), 'admin@yourdomain.com', '$2y$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4FJziNwLc5DnHKim', 1, NOW(), NOW(), NOW());

-- Get the user ID
SET @admin_id = (SELECT id FROM users WHERE email = 'admin@yourdomain.com');

-- Add profile
INSERT INTO profiles (id, user_id, display_name, created_at, updated_at) VALUES (UUID(), @admin_id, 'Administrator', NOW(), NOW());

-- Grant admin role
INSERT INTO user_roles (id, user_id, role, created_at, updated_at) VALUES (UUID(), @admin_id, 'admin', NOW(), NOW());
```

#### 3. Check sessions table exists
```sql
SHOW TABLES LIKE 'sessions';
```

If not, run the complete schema again.

#### 4. Check rate limiting
Too many login attempts can lock you out:
```sql
DELETE FROM rate_limits WHERE identifier LIKE 'login:%';
```

---

## Pages Not Loading

### Symptoms
- Pricing page shows blank
- Admin pages don't load
- Homepage sections missing

### Fixes

#### 1. Check if frontend API URL is set
In your frontend `.env` file (or environment):
```env
VITE_API_URL=https://yourdomain.com/api
```

#### 2. Check app_settings table
```sql
SELECT * FROM app_settings WHERE is_public = 1;
```

If empty, run the seed data:
```bash
mysql -u username -p database_name < database/seed-data.sql
```

#### 3. Check subscription_tiers table (for Pricing)
```sql
SELECT * FROM subscription_tiers WHERE is_active = 1;
```

---

## Users Not Showing in Admin

### Symptoms
- Admin panel says 0 users
- User list is empty but database has users

### Fixes

#### 1. Verify users exist
```sql
SELECT COUNT(*) as user_count FROM users;
SELECT * FROM users LIMIT 10;
```

#### 2. Check your admin role
```sql
-- Replace with your admin user ID
SELECT * FROM user_roles WHERE user_id = 'your-user-id';
```

Must have role = 'admin' or 'super_admin'.

#### 3. Check API response
Open browser console, go to admin users page, and check network tab for errors.

---

## Webhook Configuration

### What are Webhooks?
Webhooks provide **instant** email delivery. When someone sends an email to your temp address, your email provider immediately notifies your server via webhook.

### Step-by-Step Webhook Setup

#### Step 1: Choose Your Email Provider
You need an email service that supports webhooks. Options:

| Provider | Difficulty | Cost |
|----------|------------|------|
| ForwardEmail.net | Easy | Free/Paid |
| Mailgun | Medium | Pay as you go |
| SendGrid | Medium | Free tier available |
| Amazon SES | Hard | Very cheap |

#### Step 2: Configure DNS Records

For your domain (e.g., `yourdomain.com`), add these DNS records:

**MX Record** (Required):
```
Type: MX
Host: @ (or blank)
Value: [Your provider's mail server]
Priority: 10
```

**Example for ForwardEmail.net:**
```
MX @ mx1.forwardemail.net (Priority: 10)
MX @ mx2.forwardemail.net (Priority: 20)
```

**TXT Record (SPF)** (Recommended):
```
Type: TXT
Host: @
Value: v=spf1 include:[provider] ~all
```

#### Step 3: Set Up Webhook in Your Provider

**Your webhook URL is:**
```
https://yourdomain.com/api/emails/webhook.php
```

**ForwardEmail.net:**
1. Log in at https://forwardemail.net
2. Add your domain
3. Verify DNS records
4. Go to Webhooks section
5. Add webhook URL: `https://yourdomain.com/api/emails/webhook.php`
6. Copy the webhook secret
7. Add to `config.php`:
   ```php
   'webhooks' => [
       'enabled' => true,
       'secrets' => [
           'forwardemail' => 'your-webhook-secret-here'
       ]
   ]
   ```

**Mailgun:**
1. Log in to Mailgun dashboard
2. Go to Receiving → Create Route
3. Match recipient: `.*@yourdomain.com`
4. Forward to: `https://yourdomain.com/api/emails/webhook.php`
5. Add your API key to `config.php`:
   ```php
   'webhooks' => [
       'secrets' => [
           'mailgun' => 'your-mailgun-api-key'
       ]
   ]
   ```

#### Step 4: Test the Webhook

```bash
# Test with curl
curl -X POST https://yourdomain.com/api/emails/webhook.php \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{
    "recipient": "test@yourdomain.com",
    "from": "sender@example.com",
    "subject": "Test Email",
    "body_plain": "This is a test email"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {"accepted": true}
}
```

### Debugging Webhooks

Check webhook logs:
```sql
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 20;
```

---

## Database Issues

### "Table doesn't exist" errors

Run the schema:
```bash
mysql -u username -p database_name < database/schema.mysql.sql
mysql -u username -p database_name < database/seed-data.sql
```

### "Access denied" errors

1. Check database credentials in `config.php`
2. Verify the user has all privileges:
   ```sql
   GRANT ALL PRIVILEGES ON database_name.* TO 'username'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Column mismatch errors

If you see errors about missing columns, your schema might be outdated. Check the latest schema.mysql.sql and compare with your database.

---

## CORS Errors

### Symptoms
- "Access-Control-Allow-Origin" errors in console
- API calls fail from frontend

### Fixes

#### 1. Update config.php
```php
'security' => [
    'allowed_origins' => [
        'https://yourdomain.com',
        'https://www.yourdomain.com',
        'http://localhost:5173', // For development
    ]
]
```

#### 2. Check .htaccess in /api folder
Should contain:
```apache
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    Header set Access-Control-Allow-Headers "Content-Type, Authorization"
</IfModule>
```

---

## Debugging Tips

### Enable debug mode temporarily
In `config.php`:
```php
'app' => [
    'debug' => true,  // Shows detailed errors
]
```

**⚠️ DISABLE IN PRODUCTION!**

### Check PHP error logs
```bash
# cPanel location
tail -f ~/logs/error.log

# Common locations
tail -f /var/log/apache2/error.log
tail -f /var/log/httpd/error_log
```

### Test API endpoints directly

```bash
# Test domains endpoint
curl https://yourdomain.com/api/emails/domains.php

# Test email creation
curl -X POST https://yourdomain.com/api/emails/create.php \
  -H "Content-Type: application/json" \
  -d '{}'

# Test login
curl -X POST https://yourdomain.com/api/auth/login.php \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@yourdomain.com", "password": "Admin123!"}'
```

### Browser Console
1. Open Developer Tools (F12)
2. Go to Console tab for errors
3. Go to Network tab for API responses
4. Filter by "XHR" to see API calls

---

## Quick Reference: Required Tables

Make sure all these tables exist:
```sql
SHOW TABLES;
```

Essential tables:
- `users` - User accounts
- `profiles` - User profiles
- `user_roles` - Admin roles
- `sessions` - Login sessions
- `domains` - Email domains
- `temp_emails` - Generated temp emails
- `received_emails` - Received emails inbox
- `app_settings` - Application settings
- `rate_limits` - Rate limiting

---

## Still Having Issues?

1. Check the latest documentation in the `self-hosted/` folder
2. Review the config.example.php comments
3. Ensure PHP version is 8.0 or higher
4. Verify all PHP extensions are installed (pdo_mysql, json, mbstring)
