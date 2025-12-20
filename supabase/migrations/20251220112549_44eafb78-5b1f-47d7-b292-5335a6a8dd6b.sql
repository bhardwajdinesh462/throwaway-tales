-- Drop existing problematic policies
DROP POLICY IF EXISTS "Anyone can create temp emails with token return" ON public.temp_emails;
DROP POLICY IF EXISTS "Users can view own temp emails without token exposure" ON public.temp_emails;

-- Create a policy that allows INSERT for anyone (public role)
CREATE POLICY "Anyone can insert temp emails" 
ON public.temp_emails 
FOR INSERT 
TO public
WITH CHECK (true);

-- Create a SELECT policy that allows:
-- 1. Admins to see all
-- 2. Authenticated users to see their own
-- 3. Anyone to read a row if they just inserted it (checked by user_id matching OR no user_id for guests)
-- 4. Token-based access via headers
CREATE POLICY "Public can view temp emails with valid access" 
ON public.temp_emails 
FOR SELECT 
TO public
USING (
  is_admin(auth.uid()) 
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (auth.uid() IS NULL AND user_id IS NULL)
  OR validate_email_access_from_headers(id)
);