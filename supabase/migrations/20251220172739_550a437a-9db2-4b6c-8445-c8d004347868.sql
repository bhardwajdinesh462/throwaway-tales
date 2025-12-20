-- Fix 1: profiles table - ensure users can ONLY see their own profile
-- Drop the existing problematic policies
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can only view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles for management" ON public.profiles;

-- Create proper SELECT policy that combines all valid access patterns
CREATE POLICY "Users can view own profile or admins can view all"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR is_admin(auth.uid())
);

-- Fix 2: temp_emails - hide secret_token from non-owners
-- Drop the problematic public access policy
DROP POLICY IF EXISTS "Public can view temp emails with valid access" ON public.temp_emails;

-- Create a more restrictive policy that doesn't expose tokens freely
CREATE POLICY "Owners and token holders can access temp emails"
ON public.temp_emails
FOR SELECT
USING (
  is_admin(auth.uid())
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (auth.uid() IS NULL AND user_id IS NULL AND validate_email_access_from_headers(id))
);

-- Fix 3: temp_emails_safe view - recreate with SECURITY INVOKER so it respects RLS
DROP VIEW IF EXISTS public.temp_emails_safe;

CREATE VIEW public.temp_emails_safe
WITH (security_invoker = true)
AS SELECT 
  id,
  address,
  domain_id,
  user_id,
  is_active,
  created_at,
  expires_at
FROM public.temp_emails;

-- Grant appropriate permissions on the view
GRANT SELECT ON public.temp_emails_safe TO authenticated;
GRANT SELECT ON public.temp_emails_safe TO anon;