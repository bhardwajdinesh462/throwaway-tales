-- Add index on rate_limits.window_start for faster cleanup queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits (window_start);

-- Add index on received_emails for faster duplicate detection
CREATE INDEX IF NOT EXISTS idx_received_emails_dedup ON public.received_emails (temp_email_id, from_address, received_at);

-- Vacuum analyze the rate_limits table to reclaim space
-- Note: VACUUM cannot run in a transaction, so we'll use a function
DO $$
BEGIN
  -- Delete old rate limits immediately (older than 24 hours)
  DELETE FROM public.rate_limits WHERE window_start < NOW() - INTERVAL '24 hours';
  
  -- Log cleanup
  RAISE NOTICE 'Cleaned up old rate_limits records';
END $$;