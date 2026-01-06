-- Enable realtime for app_settings table
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;

-- Set REPLICA IDENTITY for complete row data during updates
ALTER TABLE public.app_settings REPLICA IDENTITY FULL;