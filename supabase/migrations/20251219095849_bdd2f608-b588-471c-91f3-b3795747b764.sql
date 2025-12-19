-- Fix security definer view warning - recreate view with security_invoker
DROP VIEW IF EXISTS public.temp_emails_public;

CREATE VIEW public.temp_emails_public 
WITH (security_invoker = on)
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