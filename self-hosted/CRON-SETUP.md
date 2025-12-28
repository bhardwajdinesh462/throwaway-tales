# Cron Job Setup Guide

This guide explains how to set up cron jobs for the self-hosted temp email system.

## Required Cron Jobs

### 1. IMAP Email Polling (Most Important)

This cron job fetches new emails from your IMAP server and stores them in the database.

```bash
# Run every 2 minutes
*/2 * * * * /usr/bin/php /path/to/your/api/imap/poll.php >> /var/log/temp-email/imap-poll.log 2>&1
```

**Adjust the interval based on your needs:**
- `*/2 * * * *` - Every 2 minutes (recommended)
- `* * * * *` - Every minute (more responsive, higher load)
- `*/5 * * * *` - Every 5 minutes (lower load)

### 2. Expired Email Cleanup

Clean up expired temporary emails and their received messages.

```bash
# Run daily at 3 AM
0 3 * * * /usr/bin/php /path/to/your/api/cron/cleanup.php >> /var/log/temp-email/cleanup.log 2>&1
```

### 3. Session Cleanup

Remove expired user sessions.

```bash
# Run hourly
0 * * * * /usr/bin/php /path/to/your/api/cron/sessions.php >> /var/log/temp-email/sessions.log 2>&1
```

## Setting Up Cron Jobs

### Via cPanel

1. Log in to cPanel
2. Navigate to **Cron Jobs** under "Advanced"
3. Set the timing (e.g., every 2 minutes: `*/2` in minute field, `*` in all others)
4. Enter the command:
   ```
   /usr/bin/php /home/yourusername/public_html/api/imap/poll.php >> /home/yourusername/logs/imap-poll.log 2>&1
   ```
5. Click "Add New Cron Job"

### Via SSH

1. Connect to your server via SSH
2. Edit your crontab:
   ```bash
   crontab -e
   ```
3. Add the cron job lines
4. Save and exit

### Via Plesk

1. Log in to Plesk
2. Go to **Scheduled Tasks**
3. Click "Add Task"
4. Configure the schedule and command
5. Save

## Log Files

Create a log directory:
```bash
mkdir -p /var/log/temp-email
chmod 755 /var/log/temp-email
```

Or use a directory in your home folder:
```bash
mkdir -p ~/logs
chmod 755 ~/logs
```

## Troubleshooting

### Cron Not Running

1. Check if cron service is running:
   ```bash
   service cron status
   ```

2. Check cron logs:
   ```bash
   tail -f /var/log/cron
   # or
   tail -f /var/log/syslog | grep CRON
   ```

### PHP Path Issues

Find your PHP path:
```bash
which php
# Usually: /usr/bin/php or /usr/local/bin/php
```

### Permission Issues

Ensure the script is executable:
```bash
chmod +x /path/to/api/imap/poll.php
```

### Memory/Time Limits

For large inboxes, you may need to increase PHP limits. Create a php.ini in the api directory:

```ini
; api/php.ini
max_execution_time = 300
memory_limit = 256M
```

Or set directly in cron:
```bash
*/2 * * * * /usr/bin/php -d max_execution_time=300 -d memory_limit=256M /path/to/api/imap/poll.php
```

## Testing Cron Jobs

Test manually first:
```bash
/usr/bin/php /path/to/your/api/imap/poll.php
```

Expected output:
```
[2024-01-15 10:30:00] Starting IMAP poll...
Connecting to: mail.yourdomain.com:993
Connected successfully
Found 3 new email(s)
Processed email for: user@yourdomain.com (from: sender@example.com)
[2024-01-15 10:30:02] Completed: 3 processed, 0 errors, 2.15s
```

## Alternative: Webhook-Based Email Reception

If your hosting doesn't support cron jobs well, you can use webhook-based email reception:

1. Configure your mail server (Mailgun, SendGrid, etc.) to forward incoming emails to:
   ```
   https://yourdomain.com/api/emails/webhook.php
   ```

2. This provides instant email delivery without polling.

See your mail service's documentation for webhook setup.

## Monitoring

### Simple Monitoring Script

Create a monitoring cron that alerts if IMAP polling fails:

```bash
# Run every 15 minutes
*/15 * * * * /usr/bin/php /path/to/your/api/cron/monitor.php
```

```php
<?php
// api/cron/monitor.php
require_once __DIR__ . '/../core/database.php';

$lastEmail = Database::fetchOne(
    "SELECT MAX(created_at) as last FROM received_emails"
);

$lastPoll = strtotime($lastEmail['last'] ?? '1970-01-01');
$threshold = time() - 3600; // 1 hour

if ($lastPoll < $threshold) {
    // Alert: No emails received in over an hour
    error_log("WARNING: No emails received since " . date('Y-m-d H:i:s', $lastPoll));
    // Optionally send alert email
}
```
