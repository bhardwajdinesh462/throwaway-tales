-- Add indexes for faster inbox queries
CREATE INDEX IF NOT EXISTS idx_received_emails_inbox 
ON public.received_emails (temp_email_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_received_emails_received_at 
ON public.received_emails (received_at DESC);

-- Add inboxes_today counter
INSERT INTO public.email_stats (stat_key, stat_value, updated_at)
VALUES ('inboxes_today', 0, NOW())
ON CONFLICT (stat_key) DO NOTHING;

-- Update increment_email_stats to also increment inboxes_today
CREATE OR REPLACE FUNCTION public.increment_email_stats()
RETURNS trigger AS $$
BEGIN
  -- Increment all-time counter
  UPDATE public.email_stats 
  SET stat_value = COALESCE(stat_value, 0) + 1, 
      updated_at = now()
  WHERE stat_key = 'total_temp_emails_created';
  
  -- Increment today's counter
  UPDATE public.email_stats 
  SET stat_value = COALESCE(stat_value, 0) + 1, 
      updated_at = now()
  WHERE stat_key = 'inboxes_today';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update reset function to reset both daily counters
CREATE OR REPLACE FUNCTION public.reset_daily_counters()
RETURNS void AS $$
BEGIN
  UPDATE public.email_stats 
  SET stat_value = 0, updated_at = NOW()
  WHERE stat_key IN ('emails_today', 'inboxes_today');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Initialize inboxes_today with current count since midnight IST
UPDATE public.email_stats 
SET stat_value = (
  SELECT COUNT(*) 
  FROM public.temp_emails 
  WHERE created_at >= (CURRENT_DATE - INTERVAL '5 hours 30 minutes')
),
updated_at = NOW()
WHERE stat_key = 'inboxes_today';