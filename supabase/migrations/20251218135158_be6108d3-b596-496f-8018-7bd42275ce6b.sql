-- Create storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('email-attachments', 'email-attachments', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for attachments
CREATE POLICY "Users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'email-attachments');

CREATE POLICY "Users can view their email attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-attachments');

CREATE POLICY "Admins can manage all attachments"
ON storage.objects FOR ALL
USING (bucket_id = 'email-attachments' AND public.is_admin(auth.uid()));

-- Email attachments table
CREATE TABLE public.email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_email_id UUID NOT NULL REFERENCES public.received_emails(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments for their emails"
ON public.email_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM received_emails re
    JOIN temp_emails te ON te.id = re.temp_email_id
    WHERE re.id = email_attachments.received_email_id
    AND (te.user_id IS NULL OR te.user_id = auth.uid())
  )
);

CREATE POLICY "System can insert attachments"
ON public.email_attachments FOR INSERT
WITH CHECK (true);

-- Email forwarding settings table
CREATE TABLE public.email_forwarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  temp_email_id UUID NOT NULL REFERENCES public.temp_emails(id) ON DELETE CASCADE,
  forward_to_address TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(temp_email_id)
);

ALTER TABLE public.email_forwarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own forwarding rules"
ON public.email_forwarding FOR ALL
USING (auth.uid() = user_id);

-- Push notification subscriptions table
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  temp_email_id UUID REFERENCES public.temp_emails(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their push subscriptions"
ON public.push_subscriptions FOR ALL
USING ((user_id IS NULL AND temp_email_id IS NOT NULL) OR auth.uid() = user_id);

-- Trigger for updated_at on email_forwarding
CREATE TRIGGER update_email_forwarding_updated_at
BEFORE UPDATE ON public.email_forwarding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();