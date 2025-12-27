-- Create homepage_sections table for dynamic homepage content management
CREATE TABLE public.homepage_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT UNIQUE NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;

-- Anyone can read homepage sections (public content)
CREATE POLICY "Anyone can view homepage sections"
ON public.homepage_sections
FOR SELECT
USING (true);

-- Only admins can manage homepage sections
CREATE POLICY "Admins can manage homepage sections"
ON public.homepage_sections
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_homepage_sections_updated_at
BEFORE UPDATE ON public.homepage_sections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.homepage_sections;

-- Insert default content for all sections
INSERT INTO public.homepage_sections (section_key, content, display_order) VALUES
('hero', '{
  "badge": "Trusted by 1M+ users worldwide",
  "headline": "Protect Your Privacy with Disposable Email",
  "subtitle": "Generate instant, secure temporary email addresses. No registration required. Keep your real inbox clean and spam-free.",
  "features": [
    {"icon": "Zap", "label": "Instant Generation"},
    {"icon": "Shield", "label": "100% Anonymous"},
    {"icon": "Clock", "label": "Auto-Expiring"}
  ]
}'::jsonb, 1),
('features', '{
  "title": "Everything You Need for Email Privacy",
  "subtitle": "Our comprehensive suite of features keeps your real email address safe from spam, trackers, and unwanted subscriptions.",
  "items": [
    {"icon": "Mail", "title": "Instant Temp Email", "description": "Generate a disposable email address instantly. No signup or personal information required."},
    {"icon": "Shield", "title": "Complete Privacy", "description": "Your identity stays protected. We do not track, log, or sell any of your data."},
    {"icon": "Clock", "title": "Auto-Expiring", "description": "Emails automatically expire after your chosen duration. Set it and forget it."},
    {"icon": "Zap", "title": "Real-Time Inbox", "description": "Receive emails instantly with live updates. No need to refresh the page."},
    {"icon": "Lock", "title": "Secure & Encrypted", "description": "All communications are encrypted. Your temporary inbox is completely secure."},
    {"icon": "Smartphone", "title": "Mobile Friendly", "description": "Access your temporary email from any device. Fully responsive design."},
    {"icon": "Globe", "title": "Multiple Domains", "description": "Choose from various domain options for your temporary email address."},
    {"icon": "Bell", "title": "Instant Notifications", "description": "Get notified immediately when new emails arrive in your temporary inbox."},
    {"icon": "Trash2", "title": "One-Click Delete", "description": "Delete your temporary email and all associated data with a single click."}
  ]
}'::jsonb, 2),
('how_it_works', '{
  "title": "How It Works",
  "subtitle": "Get started in seconds with our simple three-step process",
  "steps": [
    {"icon": "Mail", "step": 1, "title": "Generate Email", "description": "Click the generate button to instantly create a unique temporary email address."},
    {"icon": "Copy", "step": 2, "title": "Use Anywhere", "description": "Copy your temporary email and use it for signups, verifications, or any online service."},
    {"icon": "Inbox", "step": 3, "title": "Receive Emails", "description": "All incoming emails appear instantly in your temporary inbox with real-time updates."}
  ]
}'::jsonb, 3),
('faq', '{
  "title": "Frequently Asked Questions",
  "subtitle": "Everything you need to know about our temporary email service",
  "items": [
    {"question": "What is a temporary email?", "answer": "A temporary email is a disposable email address that you can use for a short period. It helps protect your real email from spam and unwanted messages."},
    {"question": "How long does my temporary email last?", "answer": "By default, temporary emails last for 1 hour. Premium users can extend this duration up to 7 days or longer."},
    {"question": "Is my temporary email secure?", "answer": "Yes! All emails are encrypted and we do not store any personal information. Your privacy is our top priority."},
    {"question": "Can I receive attachments?", "answer": "Yes, you can receive email attachments. Premium users get additional storage for larger attachments."},
    {"question": "Do I need to create an account?", "answer": "No account is required for basic usage. However, creating a free account unlocks additional features like email history and multiple addresses."},
    {"question": "Can I reply to emails?", "answer": "Currently, our service is receive-only. This helps maintain anonymity and prevents misuse."}
  ]
}'::jsonb, 4),
('cta', '{
  "headline": "Ready to Protect Your Privacy?",
  "subtitle": "Join millions of users who trust our service to keep their inbox clean and their identity protected.",
  "primaryButton": {"text": "Generate Free Email", "link": "#inbox"},
  "secondaryButton": {"text": "View Pricing", "link": "/pricing"},
  "footerText": "No credit card required. Start protecting your privacy today."
}'::jsonb, 5),
('quick_tips', '{
  "title": "Quick Tips",
  "tips": [
    "Use temp emails for online signups to avoid spam",
    "Premium users can extend email lifetime up to 7 days",
    "Enable notifications to never miss an email",
    "Your emails are automatically deleted after expiry"
  ]
}'::jsonb, 6);