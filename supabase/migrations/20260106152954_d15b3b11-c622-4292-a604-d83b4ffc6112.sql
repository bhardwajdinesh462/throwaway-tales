-- Add is_primary column to mailboxes table for IMAP failover priority
ALTER TABLE public.mailboxes ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Create index for faster primary mailbox lookup
CREATE INDEX IF NOT EXISTS idx_mailboxes_is_primary ON public.mailboxes(is_primary) WHERE is_primary = true;