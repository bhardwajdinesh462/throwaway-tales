-- Enable realtime for mailboxes table
ALTER PUBLICATION supabase_realtime ADD TABLE public.mailboxes;
ALTER TABLE public.mailboxes REPLICA IDENTITY FULL;