-- Fix Security Definer View issue: Drop the temp_emails_safe view and use a regular view with SECURITY INVOKER
DROP VIEW IF EXISTS public.temp_emails_safe;

-- The temp_emails_public view already exists and is a better approach
-- Just make sure it doesn't include secret_token (it already doesn't based on schema)

-- Fix Function Search Path: Update validate_email_access_from_headers function
CREATE OR REPLACE FUNCTION public.validate_email_access_from_headers(p_temp_email_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_valid boolean := false;
BEGIN
  -- Get token from request headers
  BEGIN
    v_token := current_setting('request.headers', true)::json->>'x-email-token';
  EXCEPTION WHEN OTHERS THEN
    v_token := NULL;
  END;
  
  IF v_token IS NULL OR v_token = '' THEN
    RETURN false;
  END IF;
  
  -- Verify the token matches the temp_email's secret_token
  SELECT EXISTS(
    SELECT 1 FROM temp_emails
    WHERE id = p_temp_email_id
    AND secret_token = v_token
    AND user_id IS NULL
  ) INTO v_valid;
  
  RETURN v_valid;
END;
$$;

-- Fix update_email_templates_updated_at function search path
CREATE OR REPLACE FUNCTION public.update_email_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;