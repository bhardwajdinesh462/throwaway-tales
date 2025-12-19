-- Fix 1: Protect profiles table from anonymous access
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Fix 2: Protect user_2fa table from anonymous access
CREATE POLICY "Deny anonymous access to user_2fa"
ON public.user_2fa
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Fix 3: Protect user_invoices table from anonymous access
CREATE POLICY "Deny anonymous access to user_invoices"
ON public.user_invoices
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Fix 3b: Make INSERT policy more restrictive (service_role only)
DROP POLICY IF EXISTS "System can insert invoices" ON public.user_invoices;
CREATE POLICY "System can insert invoices"
ON public.user_invoices
FOR INSERT
TO service_role
WITH CHECK (true);

-- Fix 4: Restrict email_templates to authenticated users only
DROP POLICY IF EXISTS "Anyone can read email templates" ON public.email_templates;
CREATE POLICY "Authenticated users can read email templates"
ON public.email_templates
FOR SELECT
TO authenticated
USING (true);