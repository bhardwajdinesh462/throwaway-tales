-- Fix SECURITY DEFINER view issue
-- Recreate the view without SECURITY DEFINER (regular view)
DROP VIEW IF EXISTS public.temp_emails_public;

-- Create as a regular view (not security definer)
-- This view safely exposes temp_emails without the secret_token
CREATE VIEW public.temp_emails_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  address,
  domain_id,
  user_id,
  expires_at,
  is_active,
  created_at
FROM public.temp_emails;