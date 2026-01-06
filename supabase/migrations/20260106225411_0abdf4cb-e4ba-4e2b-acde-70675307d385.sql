-- Backfill missing profiles for existing auth users
-- This ensures all users have a profile row with correct email_verified status

INSERT INTO public.profiles (user_id, email, display_name, email_verified, created_at, updated_at)
SELECT 
  au.id as user_id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'display_name', split_part(au.email, '@', 1)) as display_name,
  (au.email_confirmed_at IS NOT NULL) as email_verified,
  au.created_at,
  now() as updated_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
);

-- Also update existing profiles that have NULL email_verified based on auth status
UPDATE public.profiles p
SET email_verified = true, updated_at = now()
FROM auth.users au
WHERE p.user_id = au.id
  AND au.email_confirmed_at IS NOT NULL
  AND (p.email_verified IS NULL OR p.email_verified = false);