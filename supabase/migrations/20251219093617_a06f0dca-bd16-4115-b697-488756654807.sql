-- Add function to revoke/cancel subscription (downgrade to free tier)
CREATE OR REPLACE FUNCTION public.admin_revoke_subscription(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  free_tier_id uuid;
  old_tier_name text;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Get free tier id
  SELECT id INTO free_tier_id 
  FROM public.subscription_tiers 
  WHERE LOWER(name) = 'free' AND is_active = true
  LIMIT 1;
  
  IF free_tier_id IS NULL THEN
    RAISE EXCEPTION 'Free tier not found';
  END IF;
  
  -- Get current tier name for logging
  SELECT st.name INTO old_tier_name
  FROM public.user_subscriptions us
  JOIN public.subscription_tiers st ON st.id = us.tier_id
  WHERE us.user_id = target_user_id;
  
  -- Update subscription to free tier and cancel
  UPDATE public.user_subscriptions
  SET 
    tier_id = free_tier_id,
    status = 'cancelled',
    stripe_subscription_id = NULL,
    stripe_customer_id = NULL,
    cancel_at_period_end = false,
    updated_at = now()
  WHERE user_id = target_user_id;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, record_id, details)
  VALUES (
    auth.uid(), 
    'REVOKE_SUBSCRIPTION', 
    'user_subscriptions', 
    target_user_id, 
    jsonb_build_object('old_tier', old_tier_name, 'new_tier', 'free')
  );
  
  RETURN true;
END;
$function$;