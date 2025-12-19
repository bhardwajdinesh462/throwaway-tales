-- Function to manually assign subscription to a user (admin only)
CREATE OR REPLACE FUNCTION public.admin_assign_subscription(
  target_user_id uuid,
  target_tier_id uuid,
  duration_months integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier_name text;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Get tier name for logging
  SELECT name INTO tier_name FROM public.subscription_tiers WHERE id = target_tier_id;
  
  IF tier_name IS NULL THEN
    RAISE EXCEPTION 'Invalid subscription tier';
  END IF;
  
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Insert or update subscription
  INSERT INTO public.user_subscriptions (
    user_id, 
    tier_id, 
    status, 
    current_period_start, 
    current_period_end
  )
  VALUES (
    target_user_id, 
    target_tier_id, 
    'active',
    now(),
    now() + (duration_months || ' months')::interval
  )
  ON CONFLICT (user_id) DO UPDATE SET
    tier_id = target_tier_id,
    status = 'active',
    current_period_start = now(),
    current_period_end = now() + (duration_months || ' months')::interval,
    updated_at = now();
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, record_id, details)
  VALUES (
    auth.uid(), 
    'ASSIGN_SUBSCRIPTION', 
    'user_subscriptions', 
    target_user_id, 
    jsonb_build_object('tier', tier_name, 'duration_months', duration_months)
  );
  
  RETURN true;
END;
$$;

-- Function to get user's current subscription (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_user_subscription(target_user_id uuid)
RETURNS TABLE(
  subscription_id uuid,
  tier_id uuid,
  tier_name text,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    us.id as subscription_id,
    us.tier_id,
    st.name as tier_name,
    us.status,
    us.current_period_start,
    us.current_period_end
  FROM public.user_subscriptions us
  JOIN public.subscription_tiers st ON st.id = us.tier_id
  WHERE us.user_id = target_user_id
  LIMIT 1;
END;
$$;

-- Add unique constraint on user_subscriptions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_subscriptions_user_id_key'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Create email_restrictions table for blocked words and settings
CREATE TABLE IF NOT EXISTS public.email_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restriction_type text NOT NULL, -- 'blocked_word' or 'setting'
  value text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_restrictions ENABLE ROW LEVEL SECURITY;

-- Admins can manage restrictions
CREATE POLICY "Admins can manage email restrictions"
ON public.email_restrictions FOR ALL
USING (is_admin(auth.uid()));

-- Anyone can read active restrictions (needed for validation)
CREATE POLICY "Anyone can read active restrictions"
ON public.email_restrictions FOR SELECT
USING (is_active = true);

-- Function to check if email address contains blocked words
CREATE OR REPLACE FUNCTION public.check_email_restrictions(email_address text)
RETURNS TABLE(
  is_valid boolean,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  min_chars integer;
  blocked_word text;
  email_prefix text;
BEGIN
  -- Extract email prefix (before @)
  email_prefix := split_part(email_address, '@', 1);
  
  -- Check minimum characters setting
  SELECT value::integer INTO min_chars
  FROM public.email_restrictions
  WHERE restriction_type = 'min_characters' AND is_active = true
  LIMIT 1;
  
  IF min_chars IS NOT NULL AND length(email_prefix) < min_chars THEN
    RETURN QUERY SELECT false, format('Email prefix must be at least %s characters', min_chars);
    RETURN;
  END IF;
  
  -- Check blocked words
  SELECT value INTO blocked_word
  FROM public.email_restrictions
  WHERE restriction_type = 'blocked_word' 
    AND is_active = true
    AND lower(email_prefix) LIKE '%' || lower(value) || '%'
  LIMIT 1;
  
  IF blocked_word IS NOT NULL THEN
    RETURN QUERY SELECT false, format('Email contains blocked word: %s', blocked_word);
    RETURN;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT true, NULL::text;
END;
$$;

-- Create trigger to validate email before insert
CREATE OR REPLACE FUNCTION public.validate_temp_email_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  check_result record;
BEGIN
  SELECT * INTO check_result FROM public.check_email_restrictions(NEW.address);
  
  IF NOT check_result.is_valid THEN
    RAISE EXCEPTION '%', check_result.error_message;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on temp_emails table
DROP TRIGGER IF EXISTS check_email_restrictions_trigger ON public.temp_emails;
CREATE TRIGGER check_email_restrictions_trigger
BEFORE INSERT ON public.temp_emails
FOR EACH ROW
EXECUTE FUNCTION public.validate_temp_email_restrictions();