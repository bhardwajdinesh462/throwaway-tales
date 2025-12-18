-- ========================================
-- ADD SECRET TOKEN SYSTEM FOR ANONYMOUS ACCESS
-- ========================================

-- Add secret_token column to temp_emails
ALTER TABLE public.temp_emails 
ADD COLUMN IF NOT EXISTS secret_token text;

-- Create function to generate secure random token
CREATE OR REPLACE FUNCTION public.generate_secret_token()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  -- Generate a 32-character hex token
  RETURN encode(gen_random_bytes(16), 'hex');
END;
$$;

-- Set default value for new rows
ALTER TABLE public.temp_emails 
ALTER COLUMN secret_token SET DEFAULT public.generate_secret_token();

-- Generate tokens for existing rows without tokens
UPDATE public.temp_emails 
SET secret_token = public.generate_secret_token() 
WHERE secret_token IS NULL;

-- Make token NOT NULL after populating
ALTER TABLE public.temp_emails 
ALTER COLUMN secret_token SET NOT NULL;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_temp_emails_secret_token ON public.temp_emails(secret_token);

-- ========================================
-- ADD ENCRYPTION COLUMNS FOR EMAIL CONTENT
-- ========================================

-- Add encryption columns to received_emails
ALTER TABLE public.received_emails 
ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS encryption_key_id text;

-- ========================================
-- CREATE TOKEN VERIFICATION FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION public.verify_temp_email_token(
  p_temp_email_id uuid,
  p_token text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.temp_emails
    WHERE id = p_temp_email_id 
    AND secret_token = p_token
  )
$$;

-- ========================================
-- UPDATE RLS POLICIES FOR TOKEN VERIFICATION
-- ========================================

-- Drop existing anonymous policies on received_emails
DROP POLICY IF EXISTS "Anonymous users can view emails for anonymous temp addresses" ON public.received_emails;
DROP POLICY IF EXISTS "Anonymous users can update read status" ON public.received_emails;

-- Note: Token verification will be done at the application/edge function level
-- since RLS cannot access request headers directly for the token

-- Keep policies simple - the edge function will handle token verification
CREATE POLICY "Anonymous can view emails with valid session"
ON public.received_emails
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM temp_emails
  WHERE temp_emails.id = received_emails.temp_email_id
  AND temp_emails.user_id IS NULL
));

CREATE POLICY "Anonymous can update read status with valid session"
ON public.received_emails
FOR UPDATE
TO anon
USING (EXISTS (
  SELECT 1 FROM temp_emails
  WHERE temp_emails.id = received_emails.temp_email_id
  AND temp_emails.user_id IS NULL
));