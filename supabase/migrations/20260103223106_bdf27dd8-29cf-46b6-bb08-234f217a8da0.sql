-- Add email/IP blocking checks to create_temp_email function
CREATE OR REPLACE FUNCTION public.create_temp_email(p_address text, p_domain_id uuid, p_user_id uuid DEFAULT NULL::uuid, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new_email record;
  v_expiry timestamp with time zone;
  v_check_result record;
  v_user_tier record;
  v_free_tier record;
  v_active_email_count integer;
  v_max_emails integer;
  v_expiry_hours integer;
  v_client_ip text;
BEGIN
  -- Check if email pattern is blocked
  IF public.is_email_blocked(p_address) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This email address pattern is not allowed.');
  END IF;

  -- Check if client IP is blocked (get from headers)
  v_client_ip := NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), '');
  IF v_client_ip IS NULL THEN
    v_client_ip := current_setting('request.headers', true)::json->>'x-real-ip';
  END IF;
  IF v_client_ip IS NULL THEN
    v_client_ip := current_setting('request.headers', true)::json->>'cf-connecting-ip';
  END IF;
  
  IF v_client_ip IS NOT NULL AND public.is_ip_blocked(v_client_ip) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your IP address has been blocked from creating emails.');
  END IF;

  -- Validate the email address against restrictions
  SELECT * INTO v_check_result FROM public.check_email_restrictions(p_address);
  IF NOT v_check_result.is_valid THEN
    RETURN jsonb_build_object('success', false, 'error', v_check_result.error_message);
  END IF;

  -- Validate domain exists and is active
  IF NOT EXISTS (SELECT 1 FROM public.domains WHERE id = p_domain_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive domain');
  END IF;

  -- Check for duplicate address
  IF EXISTS (SELECT 1 FROM public.temp_emails WHERE address = p_address AND is_active = true AND expires_at > now()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email address already exists');
  END IF;

  -- Get the appropriate tier limits
  IF p_user_id IS NOT NULL THEN
    -- For authenticated users, get their subscription tier
    SELECT st.* INTO v_user_tier
    FROM public.user_subscriptions us
    JOIN public.subscription_tiers st ON st.id = us.tier_id
    WHERE us.user_id = p_user_id 
      AND us.status = 'active'
      AND us.current_period_end > now()
    ORDER BY st.price_monthly DESC
    LIMIT 1;
    
    -- If no active subscription, fall back to free tier
    IF v_user_tier IS NULL THEN
      SELECT * INTO v_user_tier 
      FROM public.subscription_tiers 
      WHERE LOWER(name) = 'free' AND is_active = true
      LIMIT 1;
    END IF;
    
    -- Count active emails for this user
    SELECT COUNT(*) INTO v_active_email_count
    FROM public.temp_emails
    WHERE user_id = p_user_id 
      AND is_active = true 
      AND expires_at > now();
    
    -- Set limits from tier (use defaults if tier not found)
    v_max_emails := COALESCE(v_user_tier.max_temp_emails, 3);
    v_expiry_hours := COALESCE(v_user_tier.email_expiry_hours, 10);
    
    -- Check max emails limit (-1 means unlimited)
    IF v_max_emails > 0 AND v_active_email_count >= v_max_emails THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('Email limit reached. Your plan allows %s emails.', v_max_emails),
        'code', 'TIER_LIMIT_REACHED',
        'limit', v_max_emails,
        'current', v_active_email_count
      );
    END IF;
  ELSE
    -- For guests, use the free tier
    SELECT * INTO v_free_tier 
    FROM public.subscription_tiers 
    WHERE LOWER(name) = 'free' AND is_active = true
    LIMIT 1;
    
    -- Use free tier expiry hours, default to 2 if not found
    v_expiry_hours := COALESCE(v_free_tier.email_expiry_hours, 2);
  END IF;

  -- Calculate expiry
  IF p_expires_at IS NOT NULL THEN
    v_expiry := p_expires_at;
  ELSE
    v_expiry := now() + (v_expiry_hours || ' hours')::interval;
  END IF;

  -- Insert the new temp email
  INSERT INTO public.temp_emails (address, domain_id, user_id, expires_at, is_active)
  VALUES (p_address, p_domain_id, p_user_id, v_expiry, true)
  RETURNING id, address, domain_id, user_id, expires_at, is_active, created_at, secret_token
  INTO v_new_email;

  RETURN jsonb_build_object(
    'success', true,
    'email', jsonb_build_object(
      'id', v_new_email.id,
      'address', v_new_email.address,
      'domain_id', v_new_email.domain_id,
      'user_id', v_new_email.user_id,
      'expires_at', v_new_email.expires_at,
      'is_active', v_new_email.is_active,
      'created_at', v_new_email.created_at,
      'secret_token', v_new_email.secret_token
    )
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email address already exists');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;