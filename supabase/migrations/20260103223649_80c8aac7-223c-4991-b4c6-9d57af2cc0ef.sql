-- Create table for geographic/country blocks
CREATE TABLE IF NOT EXISTS public.blocked_countries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code CHAR(2) NOT NULL,
  country_name TEXT NOT NULL,
  reason TEXT,
  blocked_by UUID NOT NULL,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(country_code)
);

-- Enable RLS
ALTER TABLE public.blocked_countries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blocked_countries (admin only)
CREATE POLICY "Admins can view blocked countries"
ON public.blocked_countries FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert blocked countries"
ON public.blocked_countries FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update blocked countries"
ON public.blocked_countries FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete blocked countries"
ON public.blocked_countries FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Function to check if a country is blocked
CREATE OR REPLACE FUNCTION public.is_country_blocked(p_country_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.blocked_countries
    WHERE country_code = UPPER(p_country_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

-- Add RLS policy for app_settings to allow reading specific public settings
-- First drop existing policy if any that prevents reading
DROP POLICY IF EXISTS "Anyone can read public app settings" ON public.app_settings;

-- Create policy to allow reading specific public settings (payment, general, appearance, etc.)
CREATE POLICY "Anyone can read public app settings"
ON public.app_settings FOR SELECT
USING (
  key IN (
    'payment_settings',
    'general_settings', 
    'appearance_settings',
    'limit_modal_config',
    'announcement_settings',
    'captcha_settings',
    'seo_settings',
    'registration_settings',
    'blog_settings',
    'language_settings',
    'homepage_sections'
  )
);

-- Enable realtime for blocked_countries
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_countries;