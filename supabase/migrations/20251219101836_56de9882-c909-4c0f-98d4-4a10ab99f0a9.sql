-- Create email_templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  type text NOT NULL CHECK (type IN ('welcome', 'password_reset', 'verification', 'notification', 'custom')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on email_templates
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Anyone can read email templates" ON public.email_templates;

-- Create policies for email_templates
CREATE POLICY "Admins can manage email templates"
ON public.email_templates
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Anyone can read email templates"
ON public.email_templates
FOR SELECT
TO anon, authenticated
USING (true);

-- Insert default templates (only if they don't exist)
INSERT INTO public.email_templates (name, subject, body, type)
SELECT 'Welcome Email', 'Welcome to {{site_name}}!', 'Hello {{name}},

Welcome to {{site_name}}! We''re excited to have you on board.

Your account has been created successfully on {{date}}.

Best regards,
{{site_name}} Team', 'welcome'
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'welcome');

INSERT INTO public.email_templates (name, subject, body, type)
SELECT 'Email Verification', 'Verify your {{site_name}} account', 'Hello {{name}},

Please verify your email address by clicking the link below:

{{verify_link}}

This request was made on {{date}} from IP: {{ip_address}} using {{browser}}.

If you didn''t create an account, you can ignore this email.

Best regards,
{{site_name}} Team', 'verification'
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'verification');

INSERT INTO public.email_templates (name, subject, body, type)
SELECT 'Password Reset', 'Reset your {{site_name}} password', 'Hello {{name}},

You requested to reset your password on {{date}}.

Click the link below to set a new password:

{{reset_link}}

This link will expire in 1 hour.

Request details:
- IP Address: {{ip_address}}
- Browser: {{browser}}

If you didn''t request this, please ignore this email or contact support.

Best regards,
{{site_name}} Team', 'password_reset'
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'password_reset');

INSERT INTO public.email_templates (name, subject, body, type)
SELECT 'Notification', 'Notification from {{site_name}}', 'Hello {{name}},

{{site_name}} has a notification for you.

Date: {{date}}

Best regards,
{{site_name}} Team', 'notification'
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE type = 'notification');

-- Create updated_at trigger for email_templates
CREATE OR REPLACE FUNCTION public.update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_templates_updated_at();

-- Fix user_invoices: Remove overly permissive update policy
DROP POLICY IF EXISTS "System can update invoices" ON public.user_invoices;

-- Create admin-only update policy for user_invoices
CREATE POLICY "Only admins can update invoices"
ON public.user_invoices
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Fix temp_emails: Create secure view without secret_token for anonymous access
DROP VIEW IF EXISTS public.temp_emails_safe;
CREATE VIEW public.temp_emails_safe AS
SELECT 
  id,
  address,
  created_at,
  is_active,
  expires_at,
  domain_id,
  user_id
FROM public.temp_emails;

-- Grant select on the safe view
GRANT SELECT ON public.temp_emails_safe TO anon, authenticated;

-- Fix received_emails: Clean up conflicting anonymous policies
DROP POLICY IF EXISTS "Anonymous can view emails with valid session" ON public.received_emails;
DROP POLICY IF EXISTS "Anonymous can update read status with valid session" ON public.received_emails;

-- The validate_email_access_from_headers policy should be the only anonymous access policy