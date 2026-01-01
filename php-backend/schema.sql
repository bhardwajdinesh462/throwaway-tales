-- MySQL Schema for Trash Mails PHP Backend
-- Compatible with MySQL 8.0+

SET FOREIGN_KEY_CHECKS = 0;

-- Users table (replaces auth.users)
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(100),
    avatar_url TEXT,
    refresh_token VARCHAR(64),
    refresh_token_expires DATETIME,
    reset_token VARCHAR(64),
    reset_token_expires DATETIME,
    last_login DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_refresh_token (refresh_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    email VARCHAR(255),
    display_name VARCHAR(100),
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    role ENUM('admin', 'moderator', 'user') NOT NULL DEFAULT 'user',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_role (user_id, role),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Domains
CREATE TABLE IF NOT EXISTS domains (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    is_premium BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Temp Emails
CREATE TABLE IF NOT EXISTS temp_emails (
    id CHAR(36) PRIMARY KEY,
    address VARCHAR(255) NOT NULL,
    domain_id CHAR(36) NOT NULL,
    user_id CHAR(36),
    secret_token VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_address (address),
    INDEX idx_user_id (user_id),
    INDEX idx_expires (expires_at),
    INDEX idx_token (secret_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Received Emails
CREATE TABLE IF NOT EXISTS received_emails (
    id CHAR(36) PRIMARY KEY,
    temp_email_id CHAR(36) NOT NULL,
    from_address VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    body LONGTEXT,
    html_body LONGTEXT,
    is_read BOOLEAN DEFAULT FALSE,
    is_encrypted BOOLEAN DEFAULT FALSE,
    encryption_key_id VARCHAR(100),
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_temp_email (temp_email_id),
    INDEX idx_received (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email Attachments
CREATE TABLE IF NOT EXISTS email_attachments (
    id CHAR(36) PRIMARY KEY,
    received_email_id CHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size INT NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (received_email_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- App Settings
CREATE TABLE IF NOT EXISTS app_settings (
    id CHAR(36) PRIMARY KEY,
    `key` VARCHAR(100) NOT NULL UNIQUE,
    value JSON NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Blogs
CREATE TABLE IF NOT EXISTS blogs (
    id CHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    content LONGTEXT NOT NULL,
    excerpt TEXT,
    author VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'General',
    tags JSON,
    featured_image_url TEXT,
    meta_title VARCHAR(255),
    meta_description VARCHAR(500),
    reading_time INT DEFAULT 5,
    published BOOLEAN DEFAULT FALSE,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_slug (slug),
    INDEX idx_published (published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Subscription Tiers
CREATE TABLE IF NOT EXISTS subscription_tiers (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    price_monthly DECIMAL(10,2) DEFAULT 0,
    price_yearly DECIMAL(10,2) DEFAULT 0,
    max_temp_emails INT DEFAULT 3,
    email_expiry_hours INT DEFAULT 1,
    can_forward_emails BOOLEAN DEFAULT FALSE,
    can_use_custom_domains BOOLEAN DEFAULT FALSE,
    can_use_api BOOLEAN DEFAULT FALSE,
    ai_summaries_per_day INT DEFAULT 5,
    priority_support BOOLEAN DEFAULT FALSE,
    features JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    tier_id CHAR(36) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    current_period_start DATETIME NOT NULL,
    current_period_end DATETIME NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email Stats
CREATE TABLE IF NOT EXISTS email_stats (
    id CHAR(36) PRIMARY KEY,
    stat_key VARCHAR(50) NOT NULL UNIQUE,
    stat_value BIGINT DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email Logs
CREATE TABLE IF NOT EXISTS email_logs (
    id CHAR(36) PRIMARY KEY,
    mailbox_id CHAR(36),
    mailbox_name VARCHAR(100),
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending',
    smtp_host VARCHAR(255),
    smtp_response TEXT,
    error_code VARCHAR(50),
    error_message TEXT,
    message_id VARCHAR(255),
    config_source VARCHAR(50),
    attempt_count INT DEFAULT 1,
    sent_at DATETIME,
    failed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mailboxes
CREATE TABLE IF NOT EXISTS mailboxes (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    receiving_email VARCHAR(255),
    smtp_host VARCHAR(255),
    smtp_port INT DEFAULT 587,
    smtp_user VARCHAR(255),
    smtp_password VARCHAR(255),
    smtp_from VARCHAR(255),
    imap_host VARCHAR(255),
    imap_port INT DEFAULT 993,
    imap_user VARCHAR(255),
    imap_password VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 1,
    hourly_limit INT DEFAULT 100,
    daily_limit INT DEFAULT 1000,
    emails_sent_this_hour INT DEFAULT 0,
    emails_sent_today INT DEFAULT 0,
    last_hour_reset DATETIME,
    last_day_reset DATETIME,
    last_polled_at DATETIME,
    last_sent_at DATETIME,
    last_error TEXT,
    last_error_at DATETIME,
    storage_limit_bytes BIGINT DEFAULT 10737418240,
    storage_used_bytes BIGINT DEFAULT 0,
    auto_delete_after_store BOOLEAN DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Suspensions
CREATE TABLE IF NOT EXISTS user_suspensions (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    suspended_by CHAR(36) NOT NULL,
    reason TEXT,
    suspended_until DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    suspended_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lifted_at DATETIME,
    lifted_by CHAR(36),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admin Audit Logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id CHAR(36) PRIMARY KEY,
    admin_user_id CHAR(36) NOT NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id CHAR(36),
    details JSON,
    ip_address VARCHAR(45),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin (admin_user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Friendly Websites
CREATE TABLE IF NOT EXISTS friendly_websites (
    id CHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    description TEXT,
    icon_url TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    open_in_new_tab BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Homepage Sections
CREATE TABLE IF NOT EXISTS homepage_sections (
    id CHAR(36) PRIMARY KEY,
    section_key VARCHAR(50) NOT NULL UNIQUE,
    content JSON NOT NULL,
    display_order INT DEFAULT 0,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email Verifications
CREATE TABLE IF NOT EXISTS email_verifications (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL,
    expires_at DATETIME,
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backup History
CREATE TABLE IF NOT EXISTS backup_history (
    id CHAR(36) PRIMARY KEY,
    backup_type VARCHAR(20) DEFAULT 'manual',
    tables_included JSON,
    row_counts JSON,
    file_size_bytes BIGINT,
    created_by CHAR(36),
    status VARCHAR(20) DEFAULT 'completed',
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate Limits
CREATE TABLE IF NOT EXISTS rate_limits (
    id CHAR(36) PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    request_count INT DEFAULT 1,
    window_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_rate (identifier, action_type),
    INDEX idx_window (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Two-Factor Authentication
CREATE TABLE IF NOT EXISTS user_2fa (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL UNIQUE,
    totp_secret VARCHAR(64),
    backup_codes JSON,
    is_enabled BOOLEAN DEFAULT FALSE,
    enabled_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default data
INSERT INTO email_stats (id, stat_key, stat_value) VALUES 
(UUID(), 'total_emails_created', 0),
(UUID(), 'total_emails_received', 0)
ON DUPLICATE KEY UPDATE stat_key = stat_key;

INSERT INTO subscription_tiers (id, name, price_monthly, price_yearly, max_temp_emails, email_expiry_hours, features, is_active) VALUES
(UUID(), 'Free', 0, 0, 3, 1, '["3 temp emails", "1 hour expiry"]', TRUE),
(UUID(), 'Pro', 9.99, 99.99, 10, 24, '["10 temp emails", "24 hour expiry", "Email forwarding"]', TRUE)
ON DUPLICATE KEY UPDATE name = name;

SET FOREIGN_KEY_CHECKS = 1;
