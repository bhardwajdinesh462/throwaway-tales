-- Update email expiry default from 1 hour to 2 hours
ALTER TABLE public.temp_emails 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '2 hours');