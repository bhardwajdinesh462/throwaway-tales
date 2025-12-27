-- Fix RLS policies for app_settings to allow public read of actual keys used by the app
-- Currently policies allow 'seo_settings', 'general_settings' etc but app uses 'seo', 'general' etc

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Public can read non-sensitive settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public read for friendly_sites_widget and pricing_content" ON public.app_settings;

-- Create a single comprehensive policy for public settings read
-- This includes both old key names (for backward compat) and new key names
CREATE POLICY "Public can read public settings"
ON public.app_settings
FOR SELECT
USING (
  key = ANY (ARRAY[
    -- New key names (current usage)
    'seo',
    'general',
    'appearance',
    'pricing_content',
    'friendly_sites_widget',
    'blog_settings',
    'announcement',
    -- Old key names (backward compatibility)
    'seo_settings',
    'general_settings',
    'appearance_settings'
  ]::text[])
);