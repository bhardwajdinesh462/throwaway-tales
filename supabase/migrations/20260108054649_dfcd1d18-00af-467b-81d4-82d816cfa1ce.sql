-- Ensure the counter rows exist
INSERT INTO public.email_stats (stat_key, stat_value)
VALUES ('emails_today', 0)
ON CONFLICT (stat_key) DO NOTHING;

INSERT INTO public.email_stats (stat_key, stat_value)
VALUES ('total_emails_received', 0)
ON CONFLICT (stat_key) DO NOTHING;

-- Create or replace the function to increment received email counters
CREATE OR REPLACE FUNCTION public.increment_received_email_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment total received emails
  UPDATE public.email_stats 
  SET stat_value = stat_value + 1,
      updated_at = NOW()
  WHERE stat_key = 'total_emails_received';
  
  -- Increment today's counter
  UPDATE public.email_stats 
  SET stat_value = stat_value + 1,
      updated_at = NOW()
  WHERE stat_key = 'emails_today';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_increment_received_email_stats ON public.received_emails;
CREATE TRIGGER trigger_increment_received_email_stats
  AFTER INSERT ON public.received_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_received_email_stats();

-- Create a function to reset the daily counter (for cron job)
CREATE OR REPLACE FUNCTION public.reset_emails_today()
RETURNS void AS $$
BEGIN
  UPDATE public.email_stats 
  SET stat_value = 0,
      updated_at = NOW()
  WHERE stat_key = 'emails_today';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Initialize total_emails_received to match actual count
UPDATE public.email_stats 
SET stat_value = (SELECT COUNT(*) FROM public.received_emails),
    updated_at = NOW()
WHERE stat_key = 'total_emails_received';

-- Initialize emails_today to current count since midnight IST (18:30 UTC previous day)
UPDATE public.email_stats 
SET stat_value = (
  SELECT COUNT(*) 
  FROM public.received_emails 
  WHERE received_at >= (CURRENT_DATE - INTERVAL '5 hours 30 minutes')
),
updated_at = NOW()
WHERE stat_key = 'emails_today';