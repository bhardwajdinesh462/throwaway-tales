-- =====================================================
-- DATABASE OPTIMIZATION - Run after initial setup
-- Adds performance indexes, webhook support tables, and optimizations
-- =====================================================

-- =====================================================
-- WEBHOOK SUPPORT TABLES
-- =====================================================

-- Webhook logs for debugging and rate limiting
CREATE TABLE IF NOT EXISTS `webhook_logs` (
  `id` CHAR(36) NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `provider` VARCHAR(50) NOT NULL DEFAULT 'unknown',
  `status` ENUM('success', 'rejected', 'error') NOT NULL,
  `error_message` TEXT NULL,
  `email_id` CHAR(36) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `webhook_logs_ip_created_idx` (`ip_address`, `created_at`),
  KEY `webhook_logs_provider_idx` (`provider`),
  KEY `webhook_logs_status_idx` (`status`),
  KEY `webhook_logs_created_at_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Real-time email notifications
CREATE TABLE IF NOT EXISTS `email_notifications` (
  `id` CHAR(36) NOT NULL,
  `temp_email_id` CHAR(36) NOT NULL,
  `email_id` CHAR(36) NOT NULL,
  `subject` VARCHAR(255) NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `email_notifications_temp_email_idx` (`temp_email_id`, `created_at`),
  KEY `email_notifications_created_at_idx` (`created_at`),
  CONSTRAINT `email_notifications_temp_email_fk` FOREIGN KEY (`temp_email_id`) 
    REFERENCES `temp_emails` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Optimize temp_emails queries
CREATE INDEX IF NOT EXISTS `temp_emails_active_expires_idx` 
ON `temp_emails` (`is_active`, `expires_at`);

CREATE INDEX IF NOT EXISTS `temp_emails_email_active_idx` 
ON `temp_emails` (`email_address`, `is_active`);

CREATE INDEX IF NOT EXISTS `temp_emails_user_active_idx` 
ON `temp_emails` (`user_id`, `is_active`, `expires_at`);

-- Optimize received_emails queries
CREATE INDEX IF NOT EXISTS `received_emails_inbox_idx` 
ON `received_emails` (`temp_email_id`, `deleted_at`, `received_at` DESC);

CREATE INDEX IF NOT EXISTS `received_emails_unread_idx` 
ON `received_emails` (`temp_email_id`, `is_read`, `received_at` DESC);

CREATE INDEX IF NOT EXISTS `received_emails_starred_idx` 
ON `received_emails` (`temp_email_id`, `is_starred`, `received_at` DESC);

-- Composite index for filtered inbox queries
CREATE INDEX IF NOT EXISTS `received_emails_filter_idx` 
ON `received_emails` (`temp_email_id`, `is_read`, `is_starred`, `deleted_at`, `received_at` DESC);

-- Optimize sessions cleanup
CREATE INDEX IF NOT EXISTS `sessions_cleanup_idx` 
ON `sessions` (`expires_at`, `user_id`);

-- Optimize email stats
CREATE INDEX IF NOT EXISTS `email_stats_date_idx` 
ON `email_stats` (`date` DESC);

-- Optimize user lookups
CREATE INDEX IF NOT EXISTS `users_email_verified_idx` 
ON `users` (`email`, `email_verified`);

-- Optimize domains
CREATE INDEX IF NOT EXISTS `domains_active_premium_idx` 
ON `domains` (`is_active`, `is_premium`);

-- =====================================================
-- NOTE: STORED PROCEDURES AND EVENTS (OPTIONAL)
-- =====================================================
-- Most shared hosting providers don't allow stored procedures,
-- triggers, or events. The equivalent functionality is 
-- implemented in PHP code instead:
--
-- - Inbox pagination: Handled by inbox.php
-- - Email counts: Handled by inbox.php  
-- - New email check: Handled by realtime-poll.php
-- - Cleanup: Handled by cron/cleanup.php
-- - Stats: Handled by stats.php
--
-- If your hosting DOES support these features, you can run:
-- self-hosted/database/optional-procedures.sql
-- =====================================================

-- =====================================================
-- VIEWS (These usually work on shared hosting)
-- =====================================================

-- Summary stats view
CREATE OR REPLACE VIEW `v_email_stats_summary` AS
SELECT 
  COALESCE(SUM(emails_received), 0) as total_received,
  COALESCE(SUM(emails_sent), 0) as total_sent,
  COALESCE(SUM(emails_forwarded), 0) as total_forwarded,
  COALESCE(SUM(CASE WHEN date >= CURDATE() THEN emails_received ELSE 0 END), 0) as today_received,
  COALESCE(SUM(CASE WHEN date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN emails_received ELSE 0 END), 0) as week_received,
  COALESCE(SUM(CASE WHEN date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN emails_received ELSE 0 END), 0) as month_received
FROM email_stats;

-- Active users view
CREATE OR REPLACE VIEW `v_active_users` AS
SELECT 
  COUNT(DISTINCT CASE WHEN last_accessed_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN id END) as daily_active,
  COUNT(DISTINCT CASE WHEN last_accessed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN id END) as weekly_active,
  COUNT(DISTINCT CASE WHEN last_accessed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN id END) as monthly_active,
  COUNT(*) as total_emails
FROM temp_emails
WHERE is_active = 1;

-- =====================================================
-- FINAL OPTIMIZATIONS
-- =====================================================

-- Update table stats for query optimizer (safe on shared hosting)
ANALYZE TABLE temp_emails, received_emails, users, sessions, domains;

SELECT 'Database optimization complete!' as status;
