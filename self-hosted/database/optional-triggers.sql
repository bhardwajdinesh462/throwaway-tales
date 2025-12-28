-- =====================================================
-- OPTIONAL TRIGGERS AND EVENTS
-- =====================================================
-- Only run this file if your hosting supports triggers/events
-- Most cPanel shared hosting does NOT support these
-- 
-- The functionality is already handled by PHP cron jobs
-- This file is for VPS/dedicated servers only
-- =====================================================

-- Check if we have trigger permissions first
-- If this fails, your hosting doesn't support triggers

DELIMITER //

-- Update email stats on new received email
CREATE TRIGGER `update_email_stats_on_insert`
AFTER INSERT ON `received_emails`
FOR EACH ROW
BEGIN
  INSERT INTO `email_stats` (`date`, `emails_received`)
  VALUES (DATE(NEW.received_at), 1)
  ON DUPLICATE KEY UPDATE `emails_received` = `emails_received` + 1;
END//

-- Auto-generate preview text for emails
CREATE TRIGGER `received_emails_preview`
BEFORE INSERT ON `received_emails`
FOR EACH ROW
BEGIN
  IF NEW.body_text IS NOT NULL AND NEW.preview_text IS NULL THEN
    SET NEW.preview_text = LEFT(REGEXP_REPLACE(NEW.body_text, '[\r\n\t]+', ' '), 200);
  END IF;
END//

DELIMITER ;

-- =====================================================
-- SCHEDULED EVENTS (Requires EVENT privilege)
-- =====================================================
-- Enable event scheduler: SET GLOBAL event_scheduler = ON;

DELIMITER //

-- Cleanup expired sessions every hour
CREATE EVENT IF NOT EXISTS `cleanup_expired_sessions`
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
  DELETE FROM `sessions` WHERE `expires_at` < NOW();
END//

-- Cleanup expired temp emails daily
CREATE EVENT IF NOT EXISTS `cleanup_expired_temp_emails`
ON SCHEDULE EVERY 1 DAY
DO
BEGIN
  UPDATE `temp_emails` SET `is_active` = 0 WHERE `expires_at` < NOW() AND `is_active` = 1;
END//

-- Cleanup old rate limit records hourly
CREATE EVENT IF NOT EXISTS `cleanup_rate_limits`
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
  DELETE FROM `rate_limits` 
  WHERE `window_start` < DATE_SUB(NOW(), INTERVAL `window_seconds` SECOND);
END//

-- Cleanup old notifications and logs hourly
CREATE EVENT IF NOT EXISTS `cleanup_event`
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
  DELETE FROM email_notifications 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR);
  
  DELETE FROM webhook_logs 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
  LIMIT 10000;
END//

DELIMITER ;

SELECT 'Optional triggers and events installed!' as status;
