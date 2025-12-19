-- Enable realtime for temp_emails table to broadcast insert events
ALTER PUBLICATION supabase_realtime ADD TABLE public.temp_emails;