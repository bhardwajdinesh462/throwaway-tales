-- ========================================
-- FIX RECEIVED_EMAILS TABLE RLS POLICIES
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view emails for their temp addresses" ON public.received_emails;
DROP POLICY IF EXISTS "System can insert received emails" ON public.received_emails;
DROP POLICY IF EXISTS "Users can update read status" ON public.received_emails;
DROP POLICY IF EXISTS "Admins can view all received emails" ON public.received_emails;

-- Recreate policies with proper authentication requirements
-- Authenticated users can view emails for their temp addresses
CREATE POLICY "Authenticated users can view emails for their temp addresses"
ON public.received_emails
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM temp_emails
  WHERE temp_emails.id = received_emails.temp_email_id
  AND temp_emails.user_id = auth.uid()
));

-- Anonymous users can view emails for anonymous temp addresses (no user_id)
CREATE POLICY "Anonymous users can view emails for anonymous temp addresses"
ON public.received_emails
FOR SELECT
TO anon
USING (EXISTS (
  SELECT 1 FROM temp_emails
  WHERE temp_emails.id = received_emails.temp_email_id
  AND temp_emails.user_id IS NULL
));

-- System/service role can insert received emails
CREATE POLICY "System can insert received emails"
ON public.received_emails
FOR INSERT
TO service_role
WITH CHECK (true);

-- Authenticated users can update read status for their emails
CREATE POLICY "Authenticated users can update read status"
ON public.received_emails
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM temp_emails
  WHERE temp_emails.id = received_emails.temp_email_id
  AND temp_emails.user_id = auth.uid()
));

-- Anonymous users can update read status for anonymous temp addresses
CREATE POLICY "Anonymous users can update read status"
ON public.received_emails
FOR UPDATE
TO anon
USING (EXISTS (
  SELECT 1 FROM temp_emails
  WHERE temp_emails.id = received_emails.temp_email_id
  AND temp_emails.user_id IS NULL
));

-- Admins can view all received emails
CREATE POLICY "Admins can view all received emails"
ON public.received_emails
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- ========================================
-- FIX PUSH_SUBSCRIPTIONS TABLE RLS POLICIES
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their push subscriptions" ON public.push_subscriptions;

-- Authenticated users can manage their own push subscriptions
CREATE POLICY "Authenticated users can manage push subscriptions"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Anonymous users can manage subscriptions tied to anonymous temp emails
CREATE POLICY "Anonymous users can manage anonymous push subscriptions"
ON public.push_subscriptions
FOR ALL
TO anon
USING (user_id IS NULL AND temp_email_id IS NOT NULL)
WITH CHECK (user_id IS NULL AND temp_email_id IS NOT NULL);