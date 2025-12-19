-- Add SELECT policy for anonymous users to read newly created emails
CREATE POLICY "Anonymous can read newly created emails"
ON public.temp_emails
FOR SELECT
TO anon
USING (
  user_id IS NULL 
  AND created_at > (now() - interval '5 seconds')
);