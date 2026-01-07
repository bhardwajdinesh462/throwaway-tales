-- Enable full replica identity for complete row data in realtime events
ALTER TABLE received_emails REPLICA IDENTITY FULL;

-- Add received_emails to realtime publication for instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE received_emails;