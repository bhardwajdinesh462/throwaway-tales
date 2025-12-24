-- Add RLS policy to allow public read access for specific safe app_settings keys
CREATE POLICY "Allow public read for friendly_sites_widget and pricing_content" 
ON public.app_settings 
FOR SELECT 
USING (key IN ('friendly_sites_widget', 'pricing_content'));