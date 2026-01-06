-- Enable realtime for domains table
ALTER PUBLICATION supabase_realtime ADD TABLE public.domains;
ALTER TABLE public.domains REPLICA IDENTITY FULL;

-- Enable realtime for blogs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.blogs;
ALTER TABLE public.blogs REPLICA IDENTITY FULL;