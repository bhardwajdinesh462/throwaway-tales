-- Add a policy that allows anonymous users to SELECT temp emails they just created
-- This fixes the issue where INSERT succeeds but the subsequent SELECT fails
CREATE POLICY "Anon can select recently created temp emails"
ON public.temp_emails
FOR SELECT
TO anon
USING (
  user_id IS NULL 
  AND created_at > now() - interval '10 seconds'
);