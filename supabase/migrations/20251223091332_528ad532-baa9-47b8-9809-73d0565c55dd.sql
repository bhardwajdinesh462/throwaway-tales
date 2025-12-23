-- Fix temp_emails INSERT policy to allow both anonymous and authenticated users

-- Drop the existing insert policy
DROP POLICY IF EXISTS "Anyone can insert temp emails" ON public.temp_emails;

-- Create proper INSERT policy for anonymous users (guest emails)
CREATE POLICY "Anonymous users can create guest temp emails"
ON public.temp_emails
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);

-- Create proper INSERT policy for authenticated users
CREATE POLICY "Authenticated users can create temp emails"
ON public.temp_emails
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Also need UPDATE policy for extending expiry, etc.
DROP POLICY IF EXISTS "Users can update own temp emails" ON public.temp_emails;
CREATE POLICY "Users can update own temp emails"
ON public.temp_emails
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Anonymous users can update their own temp emails via token
CREATE POLICY "Anonymous users can update guest temp emails"
ON public.temp_emails
FOR UPDATE
TO anon
USING (user_id IS NULL AND validate_email_access_from_headers(id))
WITH CHECK (user_id IS NULL);

-- Delete policies
DROP POLICY IF EXISTS "Users can delete own temp emails" ON public.temp_emails;
CREATE POLICY "Users can delete own temp emails"
ON public.temp_emails
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Anonymous users can delete guest temp emails"
ON public.temp_emails
FOR DELETE
TO anon
USING (user_id IS NULL AND validate_email_access_from_headers(id));