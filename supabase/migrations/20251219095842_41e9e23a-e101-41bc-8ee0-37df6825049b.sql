-- Drop and recreate the view with correct column order
DROP VIEW IF EXISTS public.temp_emails_public;

CREATE VIEW public.temp_emails_public AS
SELECT 
  id,
  address,
  domain_id,
  user_id,
  expires_at,
  is_active,
  created_at
FROM public.temp_emails;