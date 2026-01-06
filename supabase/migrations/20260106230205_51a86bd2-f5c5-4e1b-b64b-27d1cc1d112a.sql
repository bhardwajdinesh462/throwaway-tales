-- Add admin role for sidsaini445@gmail.com
INSERT INTO public.user_roles (id, user_id, role, created_at)
SELECT 
  gen_random_uuid(),
  p.user_id,
  'admin'::app_role,
  now()
FROM public.profiles p
WHERE LOWER(p.email) = 'sidsaini445@gmail.com'
ON CONFLICT DO NOTHING;

-- Create function to allow first user to claim admin role (only works if no admins exist)
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count integer;
  current_user_id uuid;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to claim admin role';
  END IF;
  
  -- Check if any admins exist
  SELECT COUNT(*) INTO admin_count
  FROM public.user_roles
  WHERE role = 'admin';
  
  IF admin_count > 0 THEN
    RAISE EXCEPTION 'Admin already exists. Contact existing admin for access.';
  END IF;
  
  -- Grant admin role to current user
  INSERT INTO public.user_roles (id, user_id, role, created_at)
  VALUES (gen_random_uuid(), current_user_id, 'admin', now());
  
  RETURN true;
END;
$$;

-- Create function to check if any admins exist (public, no auth needed)
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  );
$$;