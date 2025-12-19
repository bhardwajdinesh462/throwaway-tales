-- Create mailboxes table for multi-mailbox load balancing
CREATE TABLE public.mailboxes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    -- SMTP settings (for sending)
    smtp_host TEXT,
    smtp_port INTEGER DEFAULT 587,
    smtp_user TEXT,
    smtp_password TEXT,
    smtp_from TEXT,
    -- IMAP settings (for receiving)
    imap_host TEXT,
    imap_port INTEGER DEFAULT 993,
    imap_user TEXT,
    imap_password TEXT,
    receiving_email TEXT,
    -- Load balancing settings
    hourly_limit INTEGER DEFAULT 100,
    daily_limit INTEGER DEFAULT 1000,
    emails_sent_this_hour INTEGER DEFAULT 0,
    emails_sent_today INTEGER DEFAULT 0,
    last_hour_reset TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_day_reset TIMESTAMP WITH TIME ZONE DEFAULT now(),
    -- Receiving settings
    auto_delete_after_store BOOLEAN DEFAULT true,
    storage_used_bytes BIGINT DEFAULT 0,
    storage_limit_bytes BIGINT DEFAULT 10737418240, -- 10GB
    -- Status
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    last_error TEXT,
    last_error_at TIMESTAMP WITH TIME ZONE,
    last_polled_at TIMESTAMP WITH TIME ZONE,
    last_sent_at TIMESTAMP WITH TIME ZONE,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mailboxes ENABLE ROW LEVEL SECURITY;

-- Only admins can manage mailboxes
CREATE POLICY "Admins can manage mailboxes"
ON public.mailboxes
FOR ALL
USING (is_admin(auth.uid()));

-- Create function to reset hourly counters
CREATE OR REPLACE FUNCTION public.reset_mailbox_hourly_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE mailboxes 
    SET emails_sent_this_hour = 0, 
        last_hour_reset = now(),
        updated_at = now()
    WHERE last_hour_reset < now() - interval '1 hour';
END;
$$;

-- Create function to reset daily counters
CREATE OR REPLACE FUNCTION public.reset_mailbox_daily_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE mailboxes 
    SET emails_sent_today = 0, 
        last_day_reset = now(),
        updated_at = now()
    WHERE last_day_reset < now() - interval '1 day';
END;
$$;

-- Create function to select best available mailbox for sending
CREATE OR REPLACE FUNCTION public.select_available_mailbox()
RETURNS TABLE (
    mailbox_id UUID,
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_user TEXT,
    smtp_password TEXT,
    smtp_from TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- First reset any stale counters
    PERFORM reset_mailbox_hourly_counters();
    PERFORM reset_mailbox_daily_counters();
    
    -- Select the best available mailbox
    RETURN QUERY
    SELECT 
        m.id as mailbox_id,
        m.smtp_host,
        m.smtp_port,
        m.smtp_user,
        m.smtp_password,
        m.smtp_from
    FROM mailboxes m
    WHERE m.is_active = true
      AND m.smtp_host IS NOT NULL
      AND m.smtp_user IS NOT NULL
      AND m.smtp_password IS NOT NULL
      AND m.emails_sent_this_hour < m.hourly_limit
      AND m.emails_sent_today < m.daily_limit
      AND (m.last_error_at IS NULL OR m.last_error_at < now() - interval '30 minutes')
    ORDER BY m.priority ASC, m.emails_sent_this_hour ASC
    LIMIT 1;
END;
$$;

-- Create function to increment mailbox usage
CREATE OR REPLACE FUNCTION public.increment_mailbox_usage(p_mailbox_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE mailboxes 
    SET emails_sent_this_hour = emails_sent_this_hour + 1,
        emails_sent_today = emails_sent_today + 1,
        last_sent_at = now(),
        updated_at = now()
    WHERE id = p_mailbox_id;
END;
$$;

-- Create function to record mailbox error
CREATE OR REPLACE FUNCTION public.record_mailbox_error(p_mailbox_id UUID, p_error TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE mailboxes 
    SET last_error = p_error,
        last_error_at = now(),
        updated_at = now()
    WHERE id = p_mailbox_id;
END;
$$;

-- Create index for efficient querying
CREATE INDEX idx_mailboxes_active_priority ON public.mailboxes (is_active, priority) WHERE is_active = true;