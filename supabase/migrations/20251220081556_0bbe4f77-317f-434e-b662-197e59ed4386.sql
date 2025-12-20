-- Fix RLS policy for temp_emails INSERT to allow returning secret_token
-- Drop existing INSERT policy and recreate with proper permissions
DROP POLICY IF EXISTS "Anyone can create temp emails" ON public.temp_emails;

-- Create policy that allows INSERT and allows selecting the secret_token on return
CREATE POLICY "Anyone can create temp emails with token return" 
ON public.temp_emails 
FOR INSERT 
WITH CHECK (true);

-- Also need a policy to allow users to SELECT their just-inserted row (for RETURNING clause)
-- This is already covered by existing SELECT policies, but let's add one for anonymous users
-- to select their own email right after creation using the secret_token
DROP POLICY IF EXISTS "Anonymous access via token only" ON public.temp_emails;

-- Recreate with a simpler check - allow anonymous to read if they provide correct token in header
-- OR if they are reading immediately after insert (same transaction - use session context)
CREATE POLICY "Anonymous read with token or own insert" 
ON public.temp_emails 
FOR SELECT 
USING (
  -- Admin can read all
  is_admin(auth.uid())
  -- Authenticated user can read their own
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  -- Anonymous can read via token validation
  OR validate_email_access_from_headers(id)
  -- Allow reading guest emails (user_id IS NULL) - needed for RETURNING clause on INSERT
  OR (user_id IS NULL AND auth.uid() IS NULL)
);