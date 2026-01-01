# PHP Backend Template for Trash Mails

This is a template for the PHP/MySQL backend that works with the refactored frontend.

## Requirements
- PHP 8.0+
- MySQL 8.0+
- Composer

## Installation

1. Upload files to your cPanel hosting
2. Create MySQL database and import `schema.sql`
3. Copy `config.example.php` to `config.php` and update settings
4. Set `VITE_PHP_API_URL` in your frontend to point to this API

## API Endpoints

### Auth
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/session` - Get current session
- `POST /api/auth/reset-password` - Request password reset
- `POST /api/auth/update-password` - Update password
- `PATCH /api/auth/profile` - Update profile
- `GET /api/auth/google` - OAuth redirect
- `GET /api/auth/facebook` - OAuth redirect

### Database
- `GET /api/data/{table}` - Query table
- `POST /api/data/{table}` - Insert data
- `PATCH /api/data/{table}` - Update data
- `DELETE /api/data/{table}` - Delete data
- `POST /api/data/{table}/upsert` - Upsert data

### RPC Functions
- `POST /api/rpc/{function}` - Call stored procedure

### Storage
- `POST /api/storage/upload` - Upload file
- `GET /api/storage/download` - Download file
- `DELETE /api/storage/delete` - Delete files
- `GET /api/storage/public/{bucket}/{path}` - Public file URL

### Functions (Edge Function equivalents)
- `POST /api/functions/{name}` - Invoke function

## JWT Authentication

The backend uses JWT tokens stored in localStorage. Tokens expire after 7 days.
Set `JWT_SECRET` in config.php to a secure random string.
