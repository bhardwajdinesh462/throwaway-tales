-- Fix security policies - drop all existing first, then recreate

-- Drop existing temp_emails policies
DROP POLICY IF EXISTS "Anon can select recently created temp emails" ON public.temp_emails;
DROP POLICY IF EXISTS "temp_emails_select_own_or_guest" ON public.temp_emails;
DROP POLICY IF EXISTS "Users can view their own temp emails" ON public.temp_emails;
DROP POLICY IF EXISTS "Admins can view all temp emails" ON public.temp_emails;
DROP POLICY IF EXISTS "Guest access via token header" ON public.temp_emails;

-- Create secure temp_emails policies
-- Owners can see their own emails
CREATE POLICY "Users can view their own temp emails"
ON public.temp_emails FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all temp emails
CREATE POLICY "Admins can view all temp emails"
ON public.temp_emails FOR SELECT
USING (public.is_admin(auth.uid()));

-- Guest access requires token validation via headers
CREATE POLICY "Guest access via token header"
ON public.temp_emails FOR SELECT
USING (
  user_id IS NULL 
  AND is_active = true 
  AND expires_at > now()
  AND public.validate_email_access_from_headers(id)
);

-- Drop existing profiles policies  
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create secure profiles policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin(auth.uid()));

-- Drop existing admin_audit_logs policies
DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;

-- Create secure admin_audit_logs policies
CREATE POLICY "Admins can insert audit logs"
ON public.admin_audit_logs FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_logs FOR SELECT
USING (public.is_admin(auth.uid()));