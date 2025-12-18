-- Drop existing admin policy and recreate email_forwarding policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate admin policy
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Ensure email_forwarding RLS policies exist
CREATE POLICY "Users can view their own forwarding rules" 
ON public.email_forwarding 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own forwarding rules" 
ON public.email_forwarding 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own forwarding rules" 
ON public.email_forwarding 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own forwarding rules" 
ON public.email_forwarding 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);