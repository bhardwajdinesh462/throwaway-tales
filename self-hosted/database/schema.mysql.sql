-- =====================================================
-- SELF-HOSTED TEMP EMAIL - MySQL 8.0 Database Schema
-- =====================================================
-- This schema converts the Supabase PostgreSQL schema to MySQL 8.0
-- Run this file in phpMyAdmin or MySQL CLI to create all tables
-- =====================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';

-- Create database (if running manually)
-- CREATE DATABASE IF NOT EXISTS temp_email CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE temp_email;

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

-- Users table (replaces auth.users)
CREATE TABLE IF NOT EXISTS `users` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `email_verified` TINYINT(1) DEFAULT 0,
  `email_verified_at` DATETIME NULL,
  `phone` VARCHAR(20) NULL,
  `phone_verified` TINYINT(1) DEFAULT 0,
  `two_factor_enabled` TINYINT(1) DEFAULT 0,
  `two_factor_secret` VARCHAR(255) NULL,
  `backup_codes` JSON NULL,
  `last_sign_in_at` DATETIME NULL,
  `raw_user_meta_data` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_email_idx` (`email`),
  KEY `users_created_at_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User sessions (JWT tokens)
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_idx` (`user_id`),
  KEY `sessions_token_hash_idx` (`token_hash`),
  KEY `sessions_expires_at_idx` (`expires_at`),
  CONSTRAINT `sessions_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User profiles
CREATE TABLE IF NOT EXISTS `profiles` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `display_name` VARCHAR(100) NULL,
  `full_name` VARCHAR(255) NULL,
  `avatar_url` VARCHAR(500) NULL,
  `bio` TEXT NULL,
  `timezone` VARCHAR(50) DEFAULT 'UTC',
  `locale` VARCHAR(10) DEFAULT 'en',
  `notification_preferences` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `profiles_user_id_unique` (`user_id`),
  CONSTRAINT `profiles_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User roles (admin system)
CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `role` ENUM('user', 'moderator', 'admin', 'super_admin') NOT NULL DEFAULT 'user',
  `granted_by` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_roles_user_id_unique` (`user_id`),
  KEY `user_roles_role_idx` (`role`),
  CONSTRAINT `user_roles_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_roles_granted_by_fk` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admin role requests
CREATE TABLE IF NOT EXISTS `admin_role_requests` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `requested_role` ENUM('moderator', 'admin') NOT NULL,
  `reason` TEXT NULL,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by` CHAR(36) NULL,
  `reviewed_at` DATETIME NULL,
  `review_notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `admin_role_requests_user_id_idx` (`user_id`),
  KEY `admin_role_requests_status_idx` (`status`),
  CONSTRAINT `admin_role_requests_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `admin_role_requests_reviewed_by_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email verifications
CREATE TABLE IF NOT EXISTS `email_verifications` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `verified_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `email_verifications_user_id_idx` (`user_id`),
  KEY `email_verifications_token_idx` (`token`),
  CONSTRAINT `email_verifications_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- DOMAINS & MAILBOXES
-- =====================================================

-- Email domains
CREATE TABLE IF NOT EXISTS `domains` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `domain` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(100) NULL,
  `description` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_premium` TINYINT(1) NOT NULL DEFAULT 0,
  `is_custom` TINYINT(1) NOT NULL DEFAULT 0,
  `mx_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `spf_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `dkim_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `owner_id` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `domains_domain_unique` (`domain`),
  KEY `domains_is_active_idx` (`is_active`),
  KEY `domains_is_premium_idx` (`is_premium`),
  CONSTRAINT `domains_owner_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mailboxes (IMAP/SMTP configuration)
CREATE TABLE IF NOT EXISTS `mailboxes` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `domain_id` CHAR(36) NULL,
  `imap_host` VARCHAR(255) NULL,
  `imap_port` INT DEFAULT 993,
  `imap_username` VARCHAR(255) NULL,
  `imap_password_encrypted` TEXT NULL,
  `imap_encryption` ENUM('ssl', 'tls', 'none') DEFAULT 'ssl',
  `smtp_host` VARCHAR(255) NULL,
  `smtp_port` INT DEFAULT 587,
  `smtp_username` VARCHAR(255) NULL,
  `smtp_password_encrypted` TEXT NULL,
  `smtp_encryption` ENUM('ssl', 'tls', 'none') DEFAULT 'tls',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_catch_all` TINYINT(1) NOT NULL DEFAULT 0,
  `last_polled_at` DATETIME NULL,
  `last_poll_status` VARCHAR(50) NULL,
  `last_poll_error` TEXT NULL,
  `poll_interval_seconds` INT DEFAULT 120,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `mailboxes_domain_id_idx` (`domain_id`),
  KEY `mailboxes_is_active_idx` (`is_active`),
  CONSTRAINT `mailboxes_domain_id_fk` FOREIGN KEY (`domain_id`) REFERENCES `domains` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TEMPORARY EMAILS & INBOX
-- =====================================================

-- Temporary email addresses
CREATE TABLE IF NOT EXISTS `temp_emails` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `email_address` VARCHAR(255) NOT NULL,
  `domain_id` CHAR(36) NULL,
  `user_id` CHAR(36) NULL,
  `token` VARCHAR(255) NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(100) NULL,
  `is_premium` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `expires_at` DATETIME NULL,
  `auto_delete_emails` TINYINT(1) DEFAULT 1,
  `forward_to` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_accessed_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `temp_emails_email_address_unique` (`email_address`),
  UNIQUE KEY `temp_emails_token_hash_unique` (`token_hash`),
  KEY `temp_emails_domain_id_idx` (`domain_id`),
  KEY `temp_emails_user_id_idx` (`user_id`),
  KEY `temp_emails_is_active_idx` (`is_active`),
  KEY `temp_emails_expires_at_idx` (`expires_at`),
  CONSTRAINT `temp_emails_domain_id_fk` FOREIGN KEY (`domain_id`) REFERENCES `domains` (`id`) ON DELETE SET NULL,
  CONSTRAINT `temp_emails_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Received emails (inbox)
CREATE TABLE IF NOT EXISTS `received_emails` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `temp_email_id` CHAR(36) NOT NULL,
  `message_id` VARCHAR(255) NULL,
  `from_address` VARCHAR(255) NOT NULL,
  `from_name` VARCHAR(255) NULL,
  `to_address` VARCHAR(255) NOT NULL,
  `subject` TEXT NULL,
  `subject_encrypted` TEXT NULL,
  `body_text` LONGTEXT NULL,
  `body_text_encrypted` LONGTEXT NULL,
  `body_html` LONGTEXT NULL,
  `body_html_encrypted` LONGTEXT NULL,
  `is_encrypted` TINYINT(1) NOT NULL DEFAULT 0,
  `encryption_key_id` VARCHAR(100) NULL,
  `has_attachments` TINYINT(1) NOT NULL DEFAULT 0,
  `attachment_count` INT DEFAULT 0,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `is_starred` TINYINT(1) NOT NULL DEFAULT 0,
  `is_spam` TINYINT(1) NOT NULL DEFAULT 0,
  `spam_score` DECIMAL(5,2) NULL,
  `headers` JSON NULL,
  `raw_email` LONGTEXT NULL,
  `received_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` DATETIME NULL,
  `expires_at` DATETIME NULL,
  `deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `received_emails_temp_email_id_idx` (`temp_email_id`),
  KEY `received_emails_message_id_idx` (`message_id`),
  KEY `received_emails_received_at_idx` (`received_at`),
  KEY `received_emails_is_read_idx` (`is_read`),
  KEY `received_emails_expires_at_idx` (`expires_at`),
  FULLTEXT KEY `received_emails_search_idx` (`subject`, `body_text`),
  CONSTRAINT `received_emails_temp_email_id_fk` FOREIGN KEY (`temp_email_id`) REFERENCES `temp_emails` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email attachments
CREATE TABLE IF NOT EXISTS `email_attachments` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `email_id` CHAR(36) NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `size_bytes` BIGINT NOT NULL DEFAULT 0,
  `storage_path` VARCHAR(500) NOT NULL,
  `is_encrypted` TINYINT(1) NOT NULL DEFAULT 0,
  `checksum` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `email_attachments_email_id_idx` (`email_id`),
  CONSTRAINT `email_attachments_email_id_fk` FOREIGN KEY (`email_id`) REFERENCES `received_emails` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Saved emails (favorites)
CREATE TABLE IF NOT EXISTS `saved_emails` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `email_id` CHAR(36) NOT NULL,
  `folder` VARCHAR(50) DEFAULT 'saved',
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `saved_emails_user_email_unique` (`user_id`, `email_id`),
  KEY `saved_emails_user_id_idx` (`user_id`),
  CONSTRAINT `saved_emails_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `saved_emails_email_id_fk` FOREIGN KEY (`email_id`) REFERENCES `received_emails` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email forwarding rules
CREATE TABLE IF NOT EXISTS `email_forwarding` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `temp_email_id` CHAR(36) NOT NULL,
  `forward_to` VARCHAR(255) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `forward_attachments` TINYINT(1) NOT NULL DEFAULT 1,
  `filter_spam` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `email_forwarding_temp_email_id_idx` (`temp_email_id`),
  CONSTRAINT `email_forwarding_temp_email_id_fk` FOREIGN KEY (`temp_email_id`) REFERENCES `temp_emails` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- APP SETTINGS & CONFIGURATION
-- =====================================================

-- App settings (key-value store)
CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `key` VARCHAR(100) NOT NULL,
  `value` JSON NULL,
  `value_type` ENUM('string', 'number', 'boolean', 'json', 'array') DEFAULT 'string',
  `category` VARCHAR(50) DEFAULT 'general',
  `description` TEXT NULL,
  `is_public` TINYINT(1) NOT NULL DEFAULT 0,
  `is_sensitive` TINYINT(1) NOT NULL DEFAULT 0,
  `updated_by` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `app_settings_key_unique` (`key`),
  KEY `app_settings_category_idx` (`category`),
  KEY `app_settings_is_public_idx` (`is_public`),
  CONSTRAINT `app_settings_updated_by_fk` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Homepage sections (CMS)
CREATE TABLE IF NOT EXISTS `homepage_sections` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `section_key` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NULL,
  `subtitle` TEXT NULL,
  `content` LONGTEXT NULL,
  `settings` JSON NULL,
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `homepage_sections_section_key_unique` (`section_key`),
  KEY `homepage_sections_sort_order_idx` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Banners
CREATE TABLE IF NOT EXISTS `banners` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `type` ENUM('info', 'warning', 'error', 'success', 'promotion') DEFAULT 'info',
  `link_url` VARCHAR(500) NULL,
  `link_text` VARCHAR(100) NULL,
  `background_color` VARCHAR(20) NULL,
  `text_color` VARCHAR(20) NULL,
  `icon` VARCHAR(50) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_dismissible` TINYINT(1) NOT NULL DEFAULT 1,
  `show_on_pages` JSON NULL,
  `starts_at` DATETIME NULL,
  `ends_at` DATETIME NULL,
  `priority` INT DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `banners_is_active_idx` (`is_active`),
  KEY `banners_priority_idx` (`priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Friendly websites
CREATE TABLE IF NOT EXISTS `friendly_websites` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(100) NOT NULL,
  `url` VARCHAR(500) NOT NULL,
  `description` TEXT NULL,
  `logo_url` VARCHAR(500) NULL,
  `category` VARCHAR(50) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `friendly_websites_is_active_idx` (`is_active`),
  KEY `friendly_websites_sort_order_idx` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- BLOGS & CONTENT
-- =====================================================

-- Blogs
CREATE TABLE IF NOT EXISTS `blogs` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `slug` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `excerpt` TEXT NULL,
  `content` LONGTEXT NULL,
  `featured_image` VARCHAR(500) NULL,
  `author_id` CHAR(36) NULL,
  `category` VARCHAR(50) NULL,
  `tags` JSON NULL,
  `status` ENUM('draft', 'published', 'archived') DEFAULT 'draft',
  `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `views_count` INT DEFAULT 0,
  `meta_title` VARCHAR(255) NULL,
  `meta_description` TEXT NULL,
  `published_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `blogs_slug_unique` (`slug`),
  KEY `blogs_author_id_idx` (`author_id`),
  KEY `blogs_status_idx` (`status`),
  KEY `blogs_published_at_idx` (`published_at`),
  FULLTEXT KEY `blogs_search_idx` (`title`, `content`),
  CONSTRAINT `blogs_author_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email templates
CREATE TABLE IF NOT EXISTS `email_templates` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `body_html` LONGTEXT NULL,
  `body_text` LONGTEXT NULL,
  `variables` JSON NULL,
  `category` VARCHAR(50) DEFAULT 'system',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_templates_slug_unique` (`slug`),
  KEY `email_templates_category_idx` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SUBSCRIPTIONS & PAYMENTS
-- =====================================================

-- Subscription tiers
CREATE TABLE IF NOT EXISTS `subscription_tiers` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` VARCHAR(50) NOT NULL,
  `slug` VARCHAR(50) NOT NULL,
  `description` TEXT NULL,
  `features` JSON NULL,
  `price_monthly` DECIMAL(10,2) DEFAULT 0,
  `price_yearly` DECIMAL(10,2) DEFAULT 0,
  `currency` VARCHAR(3) DEFAULT 'USD',
  `stripe_price_id_monthly` VARCHAR(100) NULL,
  `stripe_price_id_yearly` VARCHAR(100) NULL,
  `max_emails` INT DEFAULT 100,
  `max_attachments_mb` INT DEFAULT 10,
  `max_domains` INT DEFAULT 1,
  `email_retention_days` INT DEFAULT 7,
  `has_custom_domains` TINYINT(1) DEFAULT 0,
  `has_api_access` TINYINT(1) DEFAULT 0,
  `has_forwarding` TINYINT(1) DEFAULT 0,
  `has_webhooks` TINYINT(1) DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subscription_tiers_slug_unique` (`slug`),
  KEY `subscription_tiers_is_active_idx` (`is_active`),
  KEY `subscription_tiers_sort_order_idx` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User subscriptions
CREATE TABLE IF NOT EXISTS `user_subscriptions` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `tier_id` CHAR(36) NOT NULL,
  `stripe_customer_id` VARCHAR(100) NULL,
  `stripe_subscription_id` VARCHAR(100) NULL,
  `status` ENUM('active', 'canceled', 'past_due', 'trialing', 'paused') DEFAULT 'active',
  `billing_period` ENUM('monthly', 'yearly') DEFAULT 'monthly',
  `current_period_start` DATETIME NULL,
  `current_period_end` DATETIME NULL,
  `cancel_at_period_end` TINYINT(1) DEFAULT 0,
  `canceled_at` DATETIME NULL,
  `trial_ends_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_subscriptions_user_id_idx` (`user_id`),
  KEY `user_subscriptions_tier_id_idx` (`tier_id`),
  KEY `user_subscriptions_status_idx` (`status`),
  KEY `user_subscriptions_stripe_customer_id_idx` (`stripe_customer_id`),
  CONSTRAINT `user_subscriptions_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_subscriptions_tier_id_fk` FOREIGN KEY (`tier_id`) REFERENCES `subscription_tiers` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User invoices
CREATE TABLE IF NOT EXISTS `user_invoices` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `subscription_id` CHAR(36) NULL,
  `stripe_invoice_id` VARCHAR(100) NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(3) DEFAULT 'USD',
  `status` ENUM('draft', 'open', 'paid', 'void', 'uncollectible') DEFAULT 'open',
  `invoice_pdf_url` VARCHAR(500) NULL,
  `period_start` DATETIME NULL,
  `period_end` DATETIME NULL,
  `paid_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_invoices_user_id_idx` (`user_id`),
  KEY `user_invoices_subscription_id_idx` (`subscription_id`),
  KEY `user_invoices_status_idx` (`status`),
  CONSTRAINT `user_invoices_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_invoices_subscription_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `user_subscriptions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SECURITY & RATE LIMITING
-- =====================================================

-- Blocked IPs
CREATE TABLE IF NOT EXISTS `blocked_ips` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `ip_address` VARCHAR(45) NOT NULL,
  `reason` TEXT NULL,
  `blocked_by` CHAR(36) NULL,
  `expires_at` DATETIME NULL,
  `is_permanent` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `blocked_ips_ip_address_unique` (`ip_address`),
  KEY `blocked_ips_expires_at_idx` (`expires_at`),
  CONSTRAINT `blocked_ips_blocked_by_fk` FOREIGN KEY (`blocked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate limits
CREATE TABLE IF NOT EXISTS `rate_limits` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `identifier` VARCHAR(255) NOT NULL,
  `identifier_type` ENUM('ip', 'user', 'api_key', 'email') DEFAULT 'ip',
  `action` VARCHAR(50) NOT NULL,
  `count` INT NOT NULL DEFAULT 0,
  `window_start` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `window_seconds` INT DEFAULT 3600,
  `max_requests` INT DEFAULT 100,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rate_limits_identifier_action_unique` (`identifier`, `action`),
  KEY `rate_limits_window_start_idx` (`window_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email restrictions
CREATE TABLE IF NOT EXISTS `email_restrictions` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `pattern` VARCHAR(255) NOT NULL,
  `pattern_type` ENUM('exact', 'domain', 'regex') DEFAULT 'exact',
  `restriction_type` ENUM('block', 'allow', 'spam') DEFAULT 'block',
  `reason` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `email_restrictions_pattern_idx` (`pattern`),
  KEY `email_restrictions_is_active_idx` (`is_active`),
  CONSTRAINT `email_restrictions_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- LOGS & AUDIT
-- =====================================================

-- Admin audit logs
CREATE TABLE IF NOT EXISTS `admin_audit_logs` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `admin_id` CHAR(36) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `resource_type` VARCHAR(50) NULL,
  `resource_id` CHAR(36) NULL,
  `old_value` JSON NULL,
  `new_value` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `admin_audit_logs_admin_id_idx` (`admin_id`),
  KEY `admin_audit_logs_action_idx` (`action`),
  KEY `admin_audit_logs_created_at_idx` (`created_at`),
  CONSTRAINT `admin_audit_logs_admin_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email logs (SMTP logs)
CREATE TABLE IF NOT EXISTS `email_logs` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `mailbox_id` CHAR(36) NULL,
  `direction` ENUM('inbound', 'outbound') NOT NULL,
  `from_address` VARCHAR(255) NULL,
  `to_address` VARCHAR(255) NULL,
  `subject` VARCHAR(255) NULL,
  `status` ENUM('pending', 'sent', 'delivered', 'failed', 'bounced') DEFAULT 'pending',
  `error_message` TEXT NULL,
  `message_id` VARCHAR(255) NULL,
  `smtp_response` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `email_logs_mailbox_id_idx` (`mailbox_id`),
  KEY `email_logs_status_idx` (`status`),
  KEY `email_logs_created_at_idx` (`created_at`),
  CONSTRAINT `email_logs_mailbox_id_fk` FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email stats
CREATE TABLE IF NOT EXISTS `email_stats` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `date` DATE NOT NULL,
  `domain_id` CHAR(36) NULL,
  `emails_received` INT DEFAULT 0,
  `emails_created` INT DEFAULT 0,
  `unique_users` INT DEFAULT 0,
  `spam_blocked` INT DEFAULT 0,
  `attachments_count` INT DEFAULT 0,
  `attachments_size_bytes` BIGINT DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_stats_date_domain_unique` (`date`, `domain_id`),
  KEY `email_stats_date_idx` (`date`),
  CONSTRAINT `email_stats_domain_id_fk` FOREIGN KEY (`domain_id`) REFERENCES `domains` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- NOTIFICATIONS & PUSH
-- =====================================================

-- Push subscriptions
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NULL,
  `temp_email_id` CHAR(36) NULL,
  `endpoint` TEXT NOT NULL,
  `p256dh_key` VARCHAR(255) NOT NULL,
  `auth_key` VARCHAR(255) NOT NULL,
  `user_agent` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `push_subscriptions_user_id_idx` (`user_id`),
  KEY `push_subscriptions_temp_email_id_idx` (`temp_email_id`),
  CONSTRAINT `push_subscriptions_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `push_subscriptions_temp_email_id_fk` FOREIGN KEY (`temp_email_id`) REFERENCES `temp_emails` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- BACKUPS
-- =====================================================

-- Backup history
CREATE TABLE IF NOT EXISTS `backup_history` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `filename` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `file_size_bytes` BIGINT DEFAULT 0,
  `backup_type` ENUM('full', 'incremental', 'settings') DEFAULT 'full',
  `status` ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
  `error_message` TEXT NULL,
  `tables_included` JSON NULL,
  `created_by` CHAR(36) NULL,
  `started_at` DATETIME NULL,
  `completed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `backup_history_status_idx` (`status`),
  KEY `backup_history_created_at_idx` (`created_at`),
  CONSTRAINT `backup_history_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- API KEYS
-- =====================================================

-- API keys
CREATE TABLE IF NOT EXISTS `api_keys` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `key_hash` VARCHAR(255) NOT NULL,
  `key_prefix` VARCHAR(20) NOT NULL,
  `permissions` JSON NULL,
  `rate_limit` INT DEFAULT 1000,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_used_at` DATETIME NULL,
  `expires_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `api_keys_user_id_idx` (`user_id`),
  KEY `api_keys_key_hash_idx` (`key_hash`),
  KEY `api_keys_is_active_idx` (`is_active`),
  CONSTRAINT `api_keys_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CRON JOBS TRACKING
-- =====================================================

-- Cron job runs
CREATE TABLE IF NOT EXISTS `cron_runs` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `job_name` VARCHAR(100) NOT NULL,
  `status` ENUM('running', 'completed', 'failed') DEFAULT 'running',
  `started_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` DATETIME NULL,
  `duration_ms` INT NULL,
  `records_processed` INT DEFAULT 0,
  `error_message` TEXT NULL,
  `metadata` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `cron_runs_job_name_idx` (`job_name`),
  KEY `cron_runs_started_at_idx` (`started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Additional compound indexes for common queries
CREATE INDEX `temp_emails_user_active_idx` ON `temp_emails` (`user_id`, `is_active`);
CREATE INDEX `received_emails_temp_read_idx` ON `received_emails` (`temp_email_id`, `is_read`, `received_at`);
CREATE INDEX `user_subscriptions_user_status_idx` ON `user_subscriptions` (`user_id`, `status`);

-- =====================================================
-- NOTE: TRIGGERS AND EVENTS (OPTIONAL)
-- =====================================================
-- Most shared hosting providers don't allow triggers/events.
-- The following features are handled by PHP instead:
-- - Email stats updates (handled in webhook.php)
-- - Session cleanup (handled by cron/sessions.php)  
-- - Temp email expiry (handled by cron/cleanup.php)
-- - Rate limit cleanup (handled by cron/cleanup.php)
--
-- If your hosting DOES support triggers, you can run:
-- self-hosted/database/optional-triggers.sql
-- =====================================================

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- SCHEMA COMPLETE
-- =====================================================
-- 
-- Next steps:
-- 1. Import this schema into your MySQL database
-- 2. Run seed-data.sql to add default domains and settings
-- 3. Optionally run optimize.sql for performance indexes
-- 4. Set up cron jobs as described in CRON-SETUP.md
-- =====================================================
