-- Fix security: Make email_restrictions only readable by admins (remove public access)
DROP POLICY IF EXISTS "Anyone can read active restrictions" ON public.email_restrictions;

-- Create proper admin-only read policy for email_restrictions
CREATE POLICY "Only admins can read email restrictions"
ON public.email_restrictions
FOR SELECT
USING (is_admin(auth.uid()));

-- Note: temp_emails_safe is a VIEW, not a table, so we can't apply RLS directly to it
-- The view already filters data appropriately based on the underlying temp_emails table