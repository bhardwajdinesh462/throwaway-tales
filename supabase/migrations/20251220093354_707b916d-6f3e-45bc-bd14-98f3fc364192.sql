-- Fix the SECURITY DEFINER view issue by using SECURITY INVOKER instead
DROP VIEW IF EXISTS public.temp_emails_safe;

-- Recreate the view with SECURITY INVOKER (the default, but being explicit)
CREATE VIEW public.temp_emails_safe 
WITH (security_invoker = true)
AS
SELECT 
  id,
  address,
  domain_id,
  user_id,
  is_active,
  created_at,
  expires_at
FROM public.temp_emails;

-- Grant appropriate permissions on the view
GRANT SELECT ON public.temp_emails_safe TO anon;
GRANT SELECT ON public.temp_emails_safe TO authenticated;