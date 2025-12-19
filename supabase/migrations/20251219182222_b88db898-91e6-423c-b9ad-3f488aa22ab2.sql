-- Create email_logs table for tracking all email send attempts, errors, and bounces
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mailbox_id UUID REFERENCES public.mailboxes(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, bounced
  error_code TEXT,
  error_message TEXT,
  smtp_response TEXT,
  attempt_count INTEGER DEFAULT 1,
  mailbox_name TEXT,
  smtp_host TEXT,
  config_source TEXT, -- REQUEST, DATABASE_MAILBOX, ENV_VARIABLES
  message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for common queries
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_mailbox_id ON public.email_logs(mailbox_id);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX idx_email_logs_recipient ON public.email_logs(recipient_email);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view email logs
CREATE POLICY "Admins can view email logs"
ON public.email_logs
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Only service role can insert/update (from edge functions)
CREATE POLICY "Service role can manage email logs"
ON public.email_logs
FOR ALL
USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE public.email_logs IS 'Tracks all email send attempts including errors and bounces for admin monitoring';

-- Create function to log email attempt
CREATE OR REPLACE FUNCTION public.log_email_attempt(
  p_mailbox_id UUID,
  p_recipient_email TEXT,
  p_subject TEXT,
  p_status TEXT,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_smtp_response TEXT DEFAULT NULL,
  p_mailbox_name TEXT DEFAULT NULL,
  p_smtp_host TEXT DEFAULT NULL,
  p_config_source TEXT DEFAULT NULL,
  p_message_id TEXT DEFAULT NULL,
  p_attempt_count INTEGER DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.email_logs (
    mailbox_id,
    recipient_email,
    subject,
    status,
    error_code,
    error_message,
    smtp_response,
    mailbox_name,
    smtp_host,
    config_source,
    message_id,
    attempt_count,
    sent_at,
    failed_at
  )
  VALUES (
    p_mailbox_id,
    p_recipient_email,
    p_subject,
    p_status,
    p_error_code,
    p_error_message,
    p_smtp_response,
    p_mailbox_name,
    p_smtp_host,
    p_config_source,
    p_message_id,
    p_attempt_count,
    CASE WHEN p_status = 'sent' THEN now() ELSE NULL END,
    CASE WHEN p_status = 'failed' OR p_status = 'bounced' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Create function to get email logs for admin
CREATE OR REPLACE FUNCTION public.get_email_logs(
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20,
  p_status_filter TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  mailbox_id UUID,
  mailbox_name TEXT,
  recipient_email TEXT,
  subject TEXT,
  status TEXT,
  error_code TEXT,
  error_message TEXT,
  smtp_response TEXT,
  smtp_host TEXT,
  config_source TEXT,
  message_id TEXT,
  attempt_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offset INTEGER;
  v_total BIGINT;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  v_offset := (p_page - 1) * p_page_size;
  
  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM public.email_logs e
  WHERE (p_status_filter IS NULL OR e.status = p_status_filter)
    AND (p_search IS NULL OR p_search = '' OR 
         e.recipient_email ILIKE '%' || p_search || '%' OR
         e.subject ILIKE '%' || p_search || '%' OR
         e.error_message ILIKE '%' || p_search || '%');

  RETURN QUERY
  SELECT 
    e.id,
    e.mailbox_id,
    e.mailbox_name,
    e.recipient_email,
    e.subject,
    e.status,
    e.error_code,
    e.error_message,
    e.smtp_response,
    e.smtp_host,
    e.config_source,
    e.message_id,
    e.attempt_count,
    e.created_at,
    e.sent_at,
    e.failed_at,
    v_total as total_count
  FROM public.email_logs e
  WHERE (p_status_filter IS NULL OR e.status = p_status_filter)
    AND (p_search IS NULL OR p_search = '' OR 
         e.recipient_email ILIKE '%' || p_search || '%' OR
         e.subject ILIKE '%' || p_search || '%' OR
         e.error_message ILIKE '%' || p_search || '%')
  ORDER BY e.created_at DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;

-- Create function to get email stats summary
CREATE OR REPLACE FUNCTION public.get_email_stats()
RETURNS TABLE(
  total_sent BIGINT,
  total_failed BIGINT,
  total_bounced BIGINT,
  sent_today BIGINT,
  failed_today BIGINT,
  success_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_sent BIGINT;
  v_total_failed BIGINT;
  v_total_bounced BIGINT;
  v_sent_today BIGINT;
  v_failed_today BIGINT;
  v_total BIGINT;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  SELECT COUNT(*) INTO v_total_sent FROM public.email_logs WHERE status = 'sent';
  SELECT COUNT(*) INTO v_total_failed FROM public.email_logs WHERE status = 'failed';
  SELECT COUNT(*) INTO v_total_bounced FROM public.email_logs WHERE status = 'bounced';
  SELECT COUNT(*) INTO v_sent_today FROM public.email_logs WHERE status = 'sent' AND created_at >= CURRENT_DATE;
  SELECT COUNT(*) INTO v_failed_today FROM public.email_logs WHERE status = 'failed' AND created_at >= CURRENT_DATE;
  
  v_total := v_total_sent + v_total_failed + v_total_bounced;

  RETURN QUERY SELECT 
    v_total_sent,
    v_total_failed,
    v_total_bounced,
    v_sent_today,
    v_failed_today,
    CASE WHEN v_total > 0 THEN ROUND((v_total_sent::NUMERIC / v_total::NUMERIC) * 100, 2) ELSE 0 END;
END;
$$;