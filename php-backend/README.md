# TempMail Self-Hosted PHP Backend

Complete self-hosted solution for the TempMail application using PHP/MySQL on cPanel hosting.

## Requirements
- PHP 8.0+ with extensions: `pdo_mysql`, `openssl`, `mbstring`, `imap`, `json`
- MySQL 8.0+
- cPanel hosting or any Apache server with mod_rewrite

## File Structure

After deploying, your cPanel `public_html/` should look like this:

```
public_html/
├── index.html              # React app entry point
├── .htaccess               # SPA routing rules
├── assets/                 # Vite-built JS/CSS assets
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── ...
├── robots.txt
├── sitemap.xml
├── sw.js                   # Service worker
│
└── api/                    # PHP Backend (this folder)
    ├── index.php           # Main API router
    ├── .htaccess           # API rewrite rules
    ├── config.php          # Your DB/SMTP/JWT settings (create from example)
    ├── config.example.php  # Template config file
    ├── schema.sql          # Database schema
    ├── sse.php             # Server-Sent Events for realtime
    ├── routes/
    │   ├── auth.php        # Authentication endpoints
    │   ├── data.php        # Database CRUD operations
    │   ├── rpc.php         # RPC function calls
    │   ├── storage.php     # File upload/download
    │   ├── functions.php   # Edge function equivalents
    │   └── admin.php       # Admin panel endpoints
    └── cron/
        ├── imap-poll.php   # Fetch emails via IMAP
        └── maintenance.php # Cleanup expired emails
```

## Quick Start (One-Command Deploy)

### Option 1: Download ZIP from Lovable
1. In Lovable, run the cPanel export command
2. Download the generated ZIP file
3. Extract and upload contents to cPanel `public_html/`
4. Visit `https://yourdomain.com/api/install.php`
5. Delete `install.php` after setup

### Option 2: Build Locally
```bash
# Clone/download the project
git clone <your-repo>
cd <project-folder>

# Install dependencies
npm install

# Build and package for cPanel
node scripts/cpanel-package.mjs --out cpanel-package

# Upload cpanel-package/public_html/* to your cPanel public_html/
```

## Installation Steps

### 1. Upload Files
Upload the entire `public_html/` contents to your cPanel `public_html/` folder.

### 2. Create MySQL Database
- In cPanel → MySQL Databases, create a new database
- Create a database user with full privileges
- Note down: database name, username, password

### 3. Run Install Script
Visit: `https://yourdomain.com/api/install.php`
- This creates all database tables
- **DELETE THIS FILE AFTER SETUP** (security!)

### 4. Configure Backend
Copy `config.example.php` to `config.php` and edit:

```php
<?php
return [
    'db' => [
        'host' => 'localhost',
        'name' => 'your_database_name',
        'user' => 'your_db_user',
        'pass' => 'your_db_password',
    ],
    'jwt_secret' => 'generate-a-random-64-char-string-here',
    'smtp' => [
        'host' => 'mail.yourdomain.com',
        'port' => 587,
        'user' => 'noreply@yourdomain.com',
        'pass' => 'your_smtp_password',
        'from' => 'noreply@yourdomain.com',
    ],
    'imap' => [
        'host' => 'mail.yourdomain.com',
        'port' => 993,
        'user' => 'inbox@yourdomain.com',
        'pass' => 'your_imap_password',
    ],
    'storage_path' => __DIR__ . '/storage',
    'cors_origins' => ['https://yourdomain.com'],
];
```

### 5. Create First Admin User
1. Visit `https://yourdomain.com/auth` and sign up
2. In cPanel → phpMyAdmin, run:
```sql
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM users WHERE email = 'your@email.com';
```

### 6. Configure Cron Jobs
In cPanel → Cron Jobs, add:

```bash
# Poll IMAP for new emails every minute
* * * * * /usr/bin/php /home/username/public_html/api/cron/imap-poll.php

# Cleanup expired emails every hour
0 * * * * /usr/bin/php /home/username/public_html/api/cron/maintenance.php
```

### 7. Add Email Domains
1. Log in as admin
2. Go to Admin → Domains
3. Add your email domain (e.g., `yourdomain.com`)

### 8. Configure Mailboxes
1. Go to Admin → IMAP Settings
2. Add your cPanel email account credentials
3. Test connection

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/session` | Get current session |
| POST | `/api/auth/reset-password` | Request password reset |
| POST | `/api/auth/update-password` | Update password |
| PATCH | `/api/auth/profile` | Update profile |

### Database Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data/{table}` | Query table |
| POST | `/api/data/{table}` | Insert data |
| PATCH | `/api/data/{table}` | Update data |
| DELETE | `/api/data/{table}` | Delete data |
| POST | `/api/data/{table}/upsert` | Upsert data |

### RPC Functions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rpc/{function}` | Call stored procedure |

### Storage
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/storage/upload` | Upload file |
| GET | `/api/storage/download` | Download file |
| DELETE | `/api/storage/delete` | Delete files |
| GET | `/api/storage/public/{bucket}/{path}` | Public file URL |

### Functions (Edge Function Equivalents)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/functions/{name}` | Invoke function |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Check API status |

## Troubleshooting

### Homepage Not Loading
1. Verify `.htaccess` exists in `public_html/` (not just in `/api`)
2. Check that `mod_rewrite` is enabled
3. Verify `index.html` exists in `public_html/`

### API Returns 404
1. Check `/api/.htaccess` exists
2. Verify `config.php` exists (not just `config.example.php`)
3. Test: `https://yourdomain.com/api/health`

### Database Connection Failed
1. Verify database credentials in `config.php`
2. Ensure database user has full privileges
3. Check if MySQL server is running

### Emails Not Arriving
1. Verify IMAP credentials in admin panel
2. Check cron job is running: look for recent entries in cron logs
3. Test IMAP connection manually in Admin → IMAP Settings

### CORS Errors
1. Add your domain to `cors_origins` in `config.php`
2. Clear browser cache

## Security Checklist

- [ ] Delete `install.php` after setup
- [ ] Set strong `jwt_secret` (64+ random characters)
- [ ] Use HTTPS only
- [ ] Keep `config.php` outside public access (already protected by `.htaccess`)
- [ ] Set proper file permissions (644 for files, 755 for directories)
- [ ] Regular database backups

## JWT Authentication

The backend uses JWT tokens stored in localStorage. Tokens expire after 7 days.
Generate a secure `jwt_secret`:
```bash
openssl rand -base64 48
```
