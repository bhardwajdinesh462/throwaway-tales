-- =====================================================
-- OPTIONAL STORED PROCEDURES
-- =====================================================
-- Only run this file if your hosting supports stored procedures
-- Most cPanel shared hosting does NOT support these
-- 
-- The functionality is already handled by PHP code
-- This file is for VPS/dedicated servers with full MySQL access
-- =====================================================

DELIMITER //

-- Fast inbox fetch with pagination
DROP PROCEDURE IF EXISTS `get_inbox_fast`//
CREATE PROCEDURE `get_inbox_fast`(
  IN p_temp_email_id CHAR(36),
  IN p_limit INT,
  IN p_offset INT,
  IN p_filter VARCHAR(20)
)
BEGIN
  SELECT SQL_CALC_FOUND_ROWS
    id, temp_email_id, message_id,
    from_address, from_name, to_address, subject,
    has_attachments, attachment_count,
    is_read, is_starred, is_spam,
    received_at, read_at
  FROM received_emails
  WHERE temp_email_id = p_temp_email_id
    AND deleted_at IS NULL
    AND (
      p_filter = 'all' 
      OR (p_filter = 'unread' AND is_read = 0)
      OR (p_filter = 'starred' AND is_starred = 1)
    )
  ORDER BY received_at DESC
  LIMIT p_limit OFFSET p_offset;
  
  SELECT FOUND_ROWS() as total_count;
END//

-- Fast email count
DROP PROCEDURE IF EXISTS `get_email_counts`//
CREATE PROCEDURE `get_email_counts`(
  IN p_temp_email_id CHAR(36)
)
BEGIN
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
    SUM(CASE WHEN is_starred = 1 THEN 1 ELSE 0 END) as starred
  FROM received_emails
  WHERE temp_email_id = p_temp_email_id
    AND deleted_at IS NULL;
END//

-- Check for new emails since timestamp
DROP PROCEDURE IF EXISTS `check_new_emails`//
CREATE PROCEDURE `check_new_emails`(
  IN p_temp_email_id CHAR(36),
  IN p_since DATETIME
)
BEGIN
  SELECT 
    id, from_address, from_name, subject, received_at
  FROM received_emails
  WHERE temp_email_id = p_temp_email_id
    AND received_at > p_since
    AND deleted_at IS NULL
  ORDER BY received_at ASC;
END//

-- Efficient cleanup of old data
DROP PROCEDURE IF EXISTS `cleanup_old_data`//
CREATE PROCEDURE `cleanup_old_data`(
  IN p_days_emails INT,
  IN p_days_sessions INT,
  IN p_days_logs INT
)
BEGIN
  DECLARE deleted_emails INT DEFAULT 0;
  DECLARE deleted_sessions INT DEFAULT 0;
  DECLARE deleted_logs INT DEFAULT 0;
  
  -- Delete old emails (in batches to avoid locks)
  REPEAT
    DELETE FROM received_emails 
    WHERE (expires_at IS NOT NULL AND expires_at < NOW())
       OR (received_at < DATE_SUB(NOW(), INTERVAL p_days_emails DAY))
    LIMIT 1000;
    SET deleted_emails = deleted_emails + ROW_COUNT();
  UNTIL ROW_COUNT() = 0 END REPEAT;
  
  -- Delete expired sessions
  DELETE FROM sessions WHERE expires_at < NOW();
  SET deleted_sessions = ROW_COUNT();
  
  -- Delete old webhook logs
  DELETE FROM webhook_logs 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL p_days_logs DAY);
  SET deleted_logs = ROW_COUNT();
  
  -- Delete old notifications
  DELETE FROM email_notifications 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR);
  
  -- Delete expired temp emails
  DELETE FROM temp_emails 
  WHERE expires_at IS NOT NULL 
    AND expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY);
  
  SELECT deleted_emails as emails_deleted, 
         deleted_sessions as sessions_deleted,
         deleted_logs as logs_deleted;
END//

DELIMITER ;

-- Grant permissions if using limited user
-- GRANT EXECUTE ON PROCEDURE temp_email.get_inbox_fast TO 'webapp'@'%';
-- GRANT EXECUTE ON PROCEDURE temp_email.get_email_counts TO 'webapp'@'%';
-- GRANT EXECUTE ON PROCEDURE temp_email.check_new_emails TO 'webapp'@'%';
-- GRANT EXECUTE ON PROCEDURE temp_email.cleanup_old_data TO 'webapp'@'%';

SELECT 'Optional stored procedures installed!' as status;
