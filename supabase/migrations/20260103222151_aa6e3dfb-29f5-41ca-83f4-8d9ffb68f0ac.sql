-- Add registration_ip column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS registration_ip TEXT;

-- Create blocked_emails table for email blocking
CREATE TABLE IF NOT EXISTS public.blocked_emails (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email_pattern TEXT NOT NULL,
    reason TEXT,
    blocked_by TEXT NOT NULL,
    blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_regex BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint on email_pattern
CREATE UNIQUE INDEX IF NOT EXISTS blocked_emails_pattern_unique ON public.blocked_emails(email_pattern) WHERE is_active = true;

-- Enable RLS on blocked_emails
ALTER TABLE public.blocked_emails ENABLE ROW LEVEL SECURITY;

-- Only admins can read blocked emails
CREATE POLICY "Only admins can read blocked emails" 
ON public.blocked_emails 
FOR SELECT 
TO authenticated 
USING (public.is_admin(auth.uid()));

-- Only admins can insert blocked emails
CREATE POLICY "Only admins can insert blocked emails" 
ON public.blocked_emails 
FOR INSERT 
TO authenticated 
WITH CHECK (public.is_admin(auth.uid()));

-- Only admins can update blocked emails
CREATE POLICY "Only admins can update blocked emails" 
ON public.blocked_emails 
FOR UPDATE 
TO authenticated 
USING (public.is_admin(auth.uid()));

-- Only admins can delete blocked emails
CREATE POLICY "Only admins can delete blocked emails" 
ON public.blocked_emails 
FOR DELETE 
TO authenticated 
USING (public.is_admin(auth.uid()));

-- Create function to check if an email is blocked
CREATE OR REPLACE FUNCTION public.is_email_blocked(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    blocked_record RECORD;
BEGIN
    -- Check for exact matches and regex patterns
    FOR blocked_record IN 
        SELECT email_pattern, is_regex 
        FROM public.blocked_emails 
        WHERE is_active = true 
        AND (expires_at IS NULL OR expires_at > NOW())
    LOOP
        IF blocked_record.is_regex THEN
            -- Regex pattern matching
            IF p_email ~* blocked_record.email_pattern THEN
                RETURN true;
            END IF;
        ELSE
            -- Exact match (case insensitive) or wildcard
            IF LOWER(p_email) = LOWER(blocked_record.email_pattern) 
               OR LOWER(p_email) LIKE LOWER(REPLACE(blocked_record.email_pattern, '*', '%')) THEN
                RETURN true;
            END IF;
        END IF;
    END LOOP;
    
    RETURN false;
END;
$$;

-- Add function to get user registration IP
CREATE OR REPLACE FUNCTION public.get_registration_ip()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT current_setting('request.headers', true)::json->>'x-forwarded-for'
$$;