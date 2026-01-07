-- Create blog_subscribers table for newsletter functionality
CREATE TABLE public.blog_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMP WITH TIME ZONE NULL
);

-- Enable RLS
ALTER TABLE public.blog_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow public insert for subscriptions (anyone can subscribe)
CREATE POLICY "Anyone can subscribe to blog"
ON public.blog_subscribers
FOR INSERT
WITH CHECK (true);

-- Allow public update for unsubscribing (users can unsubscribe themselves)
CREATE POLICY "Anyone can unsubscribe from blog"
ON public.blog_subscribers
FOR UPDATE
USING (true)
WITH CHECK (status = 'unsubscribed');

-- Admin can view all subscribers
CREATE POLICY "Admins can view all subscribers"
ON public.blog_subscribers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'moderator')
  )
);

-- Admin can delete subscribers
CREATE POLICY "Admins can delete subscribers"
ON public.blog_subscribers
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'moderator')
  )
);

-- Create index for faster lookups
CREATE INDEX idx_blog_subscribers_email ON public.blog_subscribers(email);
CREATE INDEX idx_blog_subscribers_status ON public.blog_subscribers(status);