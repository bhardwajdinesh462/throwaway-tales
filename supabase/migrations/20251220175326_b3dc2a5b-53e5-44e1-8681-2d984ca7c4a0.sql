CREATE OR REPLACE FUNCTION public.enforce_temp_email_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_identifier text;
  v_allowed boolean;
  v_headers json;
  v_ip text;
  v_setting jsonb;
  v_max_requests int := 10;
  v_window_minutes int := 60;
  v_headers_text text;
BEGIN
  -- Optional configurable settings
  SELECT value INTO v_setting
  FROM public.app_settings
  WHERE key = 'rate_limit_temp_email_create'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_setting IS NOT NULL THEN
    v_max_requests := COALESCE((v_setting->>'max_requests')::int, v_max_requests);
    v_window_minutes := COALESCE((v_setting->>'window_minutes')::int, v_window_minutes);
  END IF;

  -- Use user_id if authenticated
  IF NEW.user_id IS NOT NULL THEN
    v_identifier := NEW.user_id::text;
  ELSE
    -- For anonymous users, try to use request IP headers (best-effort)
    -- NOTE: current_setting(...) can sometimes be empty string; treat that as missing.
    v_headers_text := NULLIF(current_setting('request.headers', true), '');
    v_headers := COALESCE(v_headers_text, '{}')::json;

    -- Prefer x-forwarded-for (may contain multiple IPs)
    v_ip := NULLIF(split_part(COALESCE(v_headers->>'x-forwarded-for', ''), ',', 1), '');

    IF v_ip IS NULL THEN
      v_ip := NULLIF(v_headers->>'x-real-ip', '');
    END IF;

    IF v_ip IS NULL THEN
      v_ip := NULLIF(v_headers->>'cf-connecting-ip', '');
    END IF;

    IF v_ip IS NOT NULL THEN
      v_identifier := 'anon_ip_' || v_ip;
    ELSE
      -- Last resort: hash user-agent to reduce global collisions
      v_identifier := 'anon_ua_' || md5(COALESCE(v_headers->>'user-agent', 'unknown'));
    END IF;
  END IF;

  v_allowed := public.check_rate_limit(v_identifier, 'temp_email_create', v_max_requests, v_window_minutes);

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before creating more temporary emails.';
  END IF;

  RETURN NEW;
END;
$$;