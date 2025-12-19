-- Fix RLS policies for received_emails to require proper token validation
-- Current issue: Anonymous users can view ALL emails without token validation

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view emails for any temp email" ON public.received_emails;
DROP POLICY IF EXISTS "Anonymous users can view emails for temp_emails they have access to" ON public.received_emails;

-- Create a secure function to validate email access via session headers
CREATE OR REPLACE FUNCTION public.validate_email_access_from_headers(p_temp_email_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_is_valid boolean;
BEGIN
  -- Try to get token from request headers
  BEGIN
    v_token := current_setting('request.headers', true)::json->>'x-email-token';
  EXCEPTION WHEN OTHERS THEN
    v_token := NULL;
  END;
  
  -- If no token provided, deny access
  IF v_token IS NULL OR v_token = '' THEN
    RETURN false;
  END IF;
  
  -- Validate token using existing function
  SELECT verify_temp_email_token(p_temp_email_id, v_token) INTO v_is_valid;
  
  RETURN COALESCE(v_is_valid, false);
END;
$$;

-- Create secure policy for anonymous users - requires valid token in headers
CREATE POLICY "Anonymous users need valid token to view emails"
ON public.received_emails
FOR SELECT
TO anon
USING (
  validate_email_access_from_headers(temp_email_id)
);

-- Fix RLS policies for app_settings - restrict public access to non-sensitive keys
DROP POLICY IF EXISTS "Anyone can view settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public can read settings" ON public.app_settings;

-- Create policy that only allows public access to specific non-sensitive keys
CREATE POLICY "Public can read non-sensitive settings"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (
  key IN ('general_settings', 'appearance_settings', 'seo_settings', 'blog_settings')
);

-- Ensure admins still have full access
DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
CREATE POLICY "Admins have full access to settings"
ON public.app_settings
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));