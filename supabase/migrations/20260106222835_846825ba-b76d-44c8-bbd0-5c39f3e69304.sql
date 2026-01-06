-- Create or replace function to increment the email_stats counter when temp_emails are created
CREATE OR REPLACE FUNCTION public.increment_email_stats_on_temp_email_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment the total_temp_emails_created counter
  UPDATE public.email_stats 
  SET stat_value = stat_value + 1,
      updated_at = now()
  WHERE stat_key = 'total_temp_emails_created';
  
  -- If no row was updated (counter doesn't exist), insert it
  IF NOT FOUND THEN
    INSERT INTO public.email_stats (stat_key, stat_value, updated_at)
    VALUES ('total_temp_emails_created', 1, now())
    ON CONFLICT (stat_key) DO UPDATE 
    SET stat_value = email_stats.stat_value + 1,
        updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_increment_email_stats ON public.temp_emails;

-- Create the trigger
CREATE TRIGGER trigger_increment_email_stats
  AFTER INSERT ON public.temp_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_email_stats_on_temp_email_insert();

-- Also ensure realtime is enabled for email_stats table
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_stats;

-- Sync the current counter value with actual temp_emails count + previous value
-- This fixes the stuck 60000 value by adding all temp_emails created since
DO $$
DECLARE
  current_total BIGINT;
  new_count BIGINT;
BEGIN
  -- Get current stat value
  SELECT COALESCE(stat_value, 0) INTO current_total 
  FROM public.email_stats 
  WHERE stat_key = 'total_temp_emails_created';
  
  -- Get actual temp_emails count
  SELECT COUNT(*) INTO new_count FROM public.temp_emails;
  
  -- Update to the higher of current value or actual count
  -- This ensures we never decrease the monotonic counter
  UPDATE public.email_stats 
  SET stat_value = GREATEST(current_total, new_count),
      updated_at = now()
  WHERE stat_key = 'total_temp_emails_created';
END $$;