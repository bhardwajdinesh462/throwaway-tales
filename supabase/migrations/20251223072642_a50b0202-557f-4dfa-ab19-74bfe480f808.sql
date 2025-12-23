-- Create friendly_websites table for sidebar widget
CREATE TABLE public.friendly_websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_url TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  open_in_new_tab BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.friendly_websites ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view active friendly websites"
ON public.friendly_websites
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage friendly websites"
ON public.friendly_websites
FOR ALL
USING (is_admin(auth.uid()));

-- Create backup_history table
CREATE TABLE public.backup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT DEFAULT 'completed',
  file_size_bytes BIGINT,
  tables_included TEXT[],
  row_counts JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

-- Enable RLS
ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for backup_history
CREATE POLICY "Admins can manage backup history"
ON public.backup_history
FOR ALL
USING (is_admin(auth.uid()));

-- Insert default friendly_sites_widget settings
INSERT INTO public.app_settings (key, value)
VALUES ('friendly_sites_widget', '{
  "enabled": true,
  "visibleToPublic": true,
  "visibleToLoggedIn": true,
  "colorScheme": "primary",
  "size": "medium",
  "position": "right",
  "showOnMobile": true,
  "animationType": "slide"
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_friendly_websites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for friendly_websites
CREATE TRIGGER update_friendly_websites_updated_at
BEFORE UPDATE ON public.friendly_websites
FOR EACH ROW
EXECUTE FUNCTION public.update_friendly_websites_updated_at();