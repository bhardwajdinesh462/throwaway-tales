-- ========================================
-- FIX PROFILES TABLE RLS POLICIES
-- ========================================

-- Drop all existing SELECT policies on profiles
DROP POLICY IF EXISTS "Authenticated users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create PERMISSIVE policies (default behavior, grants access when condition is true)
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- ========================================
-- FIX EMAIL_FORWARDING TABLE RLS POLICIES
-- ========================================

-- Drop all existing policies on email_forwarding
DROP POLICY IF EXISTS "Users can create their own forwarding rules" ON public.email_forwarding;
DROP POLICY IF EXISTS "Users can delete their own forwarding rules" ON public.email_forwarding;
DROP POLICY IF EXISTS "Users can manage their own forwarding rules" ON public.email_forwarding;
DROP POLICY IF EXISTS "Users can update their own forwarding rules" ON public.email_forwarding;
DROP POLICY IF EXISTS "Users can view their own forwarding rules" ON public.email_forwarding;

-- Create proper PERMISSIVE policies requiring authentication
CREATE POLICY "Authenticated users can view own forwarding rules"
ON public.email_forwarding
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create own forwarding rules"
ON public.email_forwarding
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own forwarding rules"
ON public.email_forwarding
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete own forwarding rules"
ON public.email_forwarding
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);