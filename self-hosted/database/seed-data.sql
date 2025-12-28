-- =====================================================
-- SELF-HOSTED TEMP EMAIL - Seed Data
-- =====================================================
-- Run this file AFTER schema.mysql.sql to populate initial data
-- =====================================================

SET NAMES utf8mb4;

-- =====================================================
-- DEFAULT DOMAINS
-- =====================================================

INSERT INTO `domains` (`id`, `domain`, `display_name`, `description`, `is_active`, `is_premium`, `mx_verified`, `created_at`, `updated_at`) VALUES
(UUID(), 'tempmail.local', 'TempMail Local', 'Default temporary email domain', 1, 0, 1, NOW(), NOW()),
(UUID(), 'quickmail.local', 'QuickMail', 'Quick disposable emails', 1, 0, 1, NOW(), NOW()),
(UUID(), 'dropmail.local', 'DropMail', 'Drop and forget emails', 1, 0, 1, NOW(), NOW());

-- =====================================================
-- DEFAULT SUBSCRIPTION TIERS
-- =====================================================

INSERT INTO `subscription_tiers` (`id`, `name`, `slug`, `description`, `features`, `price_monthly`, `price_yearly`, `max_emails`, `max_attachments_mb`, `max_domains`, `email_retention_days`, `has_custom_domains`, `has_api_access`, `has_forwarding`, `has_webhooks`, `is_active`, `sort_order`, `created_at`, `updated_at`) VALUES
(UUID(), 'Free', 'free', 'Basic temporary email service', '["Up to 10 emails", "7 day retention", "3 domains", "5MB attachments"]', 0, 0, 10, 5, 3, 7, 0, 0, 0, 0, 1, 1, NOW(), NOW()),
(UUID(), 'Pro', 'pro', 'Enhanced features for power users', '["Unlimited emails", "30 day retention", "All domains", "25MB attachments", "Email forwarding", "API access"]', 4.99, 49.99, 1000, 25, 10, 30, 0, 1, 1, 0, 1, 2, NOW(), NOW()),
(UUID(), 'Business', 'business', 'Full-featured business solution', '["Everything in Pro", "Custom domains", "90 day retention", "50MB attachments", "Webhooks", "Priority support"]', 14.99, 149.99, 10000, 50, 100, 90, 1, 1, 1, 1, 1, 3, NOW(), NOW());

-- =====================================================
-- DEFAULT APP SETTINGS
-- =====================================================

INSERT INTO `app_settings` (`id`, `key`, `value`, `value_type`, `category`, `description`, `is_public`, `created_at`, `updated_at`) VALUES
-- General Settings
(UUID(), 'site_name', '"Temp Email"', 'string', 'general', 'Website name displayed in header and title', 1, NOW(), NOW()),
(UUID(), 'site_description', '"Free temporary email service"', 'string', 'general', 'Website meta description', 1, NOW(), NOW()),
(UUID(), 'site_url', '"https://yourdomain.com"', 'string', 'general', 'Base URL of the website', 1, NOW(), NOW()),
(UUID(), 'contact_email', '"support@yourdomain.com"', 'string', 'general', 'Support contact email', 1, NOW(), NOW()),
(UUID(), 'default_language', '"en"', 'string', 'general', 'Default interface language', 1, NOW(), NOW()),
(UUID(), 'maintenance_mode', 'false', 'boolean', 'general', 'Enable maintenance mode', 0, NOW(), NOW()),

-- Email Settings
(UUID(), 'default_email_expiry_hours', '24', 'number', 'email', 'Default email expiration time in hours', 0, NOW(), NOW()),
(UUID(), 'max_emails_per_user', '10', 'number', 'email', 'Maximum emails per user (free tier)', 0, NOW(), NOW()),
(UUID(), 'max_attachment_size_mb', '10', 'number', 'email', 'Maximum attachment size in MB', 0, NOW(), NOW()),
(UUID(), 'auto_delete_read_emails_days', '7', 'number', 'email', 'Auto-delete read emails after days', 0, NOW(), NOW()),
(UUID(), 'encryption_enabled', 'true', 'boolean', 'email', 'Enable email encryption at rest', 0, NOW(), NOW()),

-- Registration Settings
(UUID(), 'registration_enabled', 'true', 'boolean', 'registration', 'Allow new user registrations', 0, NOW(), NOW()),
(UUID(), 'email_verification_required', 'true', 'boolean', 'registration', 'Require email verification', 0, NOW(), NOW()),
(UUID(), 'captcha_enabled', 'false', 'boolean', 'registration', 'Enable CAPTCHA on forms', 0, NOW(), NOW()),
(UUID(), 'captcha_site_key', '""', 'string', 'registration', 'reCAPTCHA site key', 0, NOW(), NOW()),

-- Appearance Settings
(UUID(), 'primary_color', '"#6366f1"', 'string', 'appearance', 'Primary theme color', 1, NOW(), NOW()),
(UUID(), 'logo_url', '""', 'string', 'appearance', 'Custom logo URL', 1, NOW(), NOW()),
(UUID(), 'favicon_url', '""', 'string', 'appearance', 'Custom favicon URL', 1, NOW(), NOW()),
(UUID(), 'dark_mode_default', 'false', 'boolean', 'appearance', 'Enable dark mode by default', 1, NOW(), NOW()),

-- SEO Settings
(UUID(), 'meta_title', '"Free Temporary Email - Protect Your Privacy"', 'string', 'seo', 'Default meta title', 1, NOW(), NOW()),
(UUID(), 'meta_description', '"Get instant disposable email addresses. Protect your privacy from spam and unwanted emails."', 'string', 'seo', 'Default meta description', 1, NOW(), NOW()),
(UUID(), 'meta_keywords', '"temporary email, disposable email, temp mail, fake email"', 'string', 'seo', 'Meta keywords', 1, NOW(), NOW()),
(UUID(), 'google_analytics_id', '""', 'string', 'seo', 'Google Analytics tracking ID', 0, NOW(), NOW()),

-- Rate Limiting
(UUID(), 'rate_limit_emails_per_hour', '20', 'number', 'security', 'Max emails created per hour per IP', 0, NOW(), NOW()),
(UUID(), 'rate_limit_api_per_minute', '60', 'number', 'security', 'Max API requests per minute', 0, NOW(), NOW()),
(UUID(), 'rate_limit_login_attempts', '5', 'number', 'security', 'Max login attempts before lockout', 0, NOW(), NOW()),
(UUID(), 'lockout_duration_minutes', '15', 'number', 'security', 'Account lockout duration', 0, NOW(), NOW()),

-- IMAP Settings
(UUID(), 'imap_poll_enabled', 'true', 'boolean', 'imap', 'Enable IMAP email polling', 0, NOW(), NOW()),
(UUID(), 'imap_poll_interval_seconds', '120', 'number', 'imap', 'IMAP poll interval in seconds', 0, NOW(), NOW()),
(UUID(), 'imap_max_emails_per_poll', '50', 'number', 'imap', 'Max emails to fetch per poll', 0, NOW(), NOW()),

-- Stripe Settings
(UUID(), 'stripe_enabled', 'false', 'boolean', 'payments', 'Enable Stripe payments', 0, NOW(), NOW()),
(UUID(), 'stripe_webhook_secret', '""', 'string', 'payments', 'Stripe webhook signing secret', 0, NOW(), NOW());

-- =====================================================
-- DEFAULT HOMEPAGE SECTIONS
-- =====================================================

INSERT INTO `homepage_sections` (`id`, `section_key`, `title`, `subtitle`, `content`, `settings`, `is_visible`, `sort_order`, `created_at`, `updated_at`) VALUES
(UUID(), 'hero', 'Free Temporary Email', 'Protect your privacy with instant disposable email addresses', NULL, '{"showEmailGenerator": true}', 1, 1, NOW(), NOW()),
(UUID(), 'features', 'Why Choose Us?', 'Powerful features to keep your inbox clean', NULL, '{"columns": 3}', 1, 2, NOW(), NOW()),
(UUID(), 'how_it_works', 'How It Works', 'Get started in 3 simple steps', NULL, '{"showSteps": true}', 1, 3, NOW(), NOW()),
(UUID(), 'faq', 'Frequently Asked Questions', 'Everything you need to know', NULL, '{"expandFirst": true}', 1, 4, NOW(), NOW()),
(UUID(), 'cta', 'Ready to Get Started?', 'Create your first temporary email in seconds', NULL, '{"buttonText": "Generate Email", "buttonLink": "/"}', 1, 5, NOW(), NOW());

-- =====================================================
-- DEFAULT EMAIL TEMPLATES
-- =====================================================

INSERT INTO `email_templates` (`id`, `name`, `slug`, `subject`, `body_html`, `body_text`, `variables`, `category`, `is_active`, `created_at`, `updated_at`) VALUES
(UUID(), 'Welcome Email', 'welcome', 'Welcome to {{site_name}}!', 
'<h1>Welcome to {{site_name}}!</h1><p>Hi {{user_name}},</p><p>Thank you for signing up. We''re excited to have you on board!</p><p>Get started by creating your first temporary email address.</p><p>Best regards,<br>The {{site_name}} Team</p>',
'Welcome to {{site_name}}!\n\nHi {{user_name}},\n\nThank you for signing up. We''re excited to have you on board!\n\nGet started by creating your first temporary email address.\n\nBest regards,\nThe {{site_name}} Team',
'["site_name", "user_name", "user_email"]', 'system', 1, NOW(), NOW()),

(UUID(), 'Email Verification', 'verify-email', 'Verify your email address', 
'<h1>Verify Your Email</h1><p>Hi {{user_name}},</p><p>Please click the link below to verify your email address:</p><p><a href="{{verification_link}}">Verify Email</a></p><p>This link will expire in 24 hours.</p><p>If you didn''t create an account, you can safely ignore this email.</p>',
'Verify Your Email\n\nHi {{user_name}},\n\nPlease click the link below to verify your email address:\n\n{{verification_link}}\n\nThis link will expire in 24 hours.\n\nIf you didn''t create an account, you can safely ignore this email.',
'["site_name", "user_name", "verification_link"]', 'system', 1, NOW(), NOW()),

(UUID(), 'Password Reset', 'password-reset', 'Reset your password', 
'<h1>Reset Your Password</h1><p>Hi {{user_name}},</p><p>We received a request to reset your password. Click the link below to set a new password:</p><p><a href="{{reset_link}}">Reset Password</a></p><p>This link will expire in 1 hour.</p><p>If you didn''t request this, you can safely ignore this email.</p>',
'Reset Your Password\n\nHi {{user_name}},\n\nWe received a request to reset your password. Click the link below to set a new password:\n\n{{reset_link}}\n\nThis link will expire in 1 hour.\n\nIf you didn''t request this, you can safely ignore this email.',
'["site_name", "user_name", "reset_link"]', 'system', 1, NOW(), NOW()),

(UUID(), 'New Email Notification', 'new-email', 'New email received at {{email_address}}', 
'<h1>New Email Received</h1><p>You have a new email at <strong>{{email_address}}</strong></p><p><strong>From:</strong> {{from_address}}<br><strong>Subject:</strong> {{subject}}</p><p><a href="{{inbox_link}}">View in Inbox</a></p>',
'New Email Received\n\nYou have a new email at {{email_address}}\n\nFrom: {{from_address}}\nSubject: {{subject}}\n\nView in Inbox: {{inbox_link}}',
'["email_address", "from_address", "subject", "inbox_link"]', 'notification', 1, NOW(), NOW());

-- =====================================================
-- CREATE FIRST ADMIN USER (CHANGE PASSWORD!)
-- =====================================================

-- Password is: Admin123! (bcrypt hash)
-- IMPORTANT: Change this password immediately after first login!
INSERT INTO `users` (`id`, `email`, `password_hash`, `email_verified`, `email_verified_at`, `created_at`, `updated_at`) VALUES
(UUID(), 'admin@yourdomain.com', '$2y$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4FJziNwLc5DnHKim', 1, NOW(), NOW(), NOW());

-- Get the admin user ID and create profile + role
SET @admin_id = (SELECT `id` FROM `users` WHERE `email` = 'admin@yourdomain.com' LIMIT 1);

INSERT INTO `profiles` (`id`, `user_id`, `display_name`, `full_name`, `created_at`, `updated_at`) VALUES
(UUID(), @admin_id, 'Admin', 'System Administrator', NOW(), NOW());

INSERT INTO `user_roles` (`id`, `user_id`, `role`, `created_at`, `updated_at`) VALUES
(UUID(), @admin_id, 'super_admin', NOW(), NOW());

-- =====================================================
-- SEED COMPLETE
-- =====================================================
-- 
-- Default Admin Credentials:
-- Email: admin@yourdomain.com
-- Password: Admin123!
-- 
-- IMPORTANT: Change the admin password immediately!
-- 
-- =====================================================
