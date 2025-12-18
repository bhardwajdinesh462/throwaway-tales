-- Add unique constraint to prevent duplicate emails at database level
-- Using a composite unique index on temp_email_id, from_address, subject, and received_at

-- First, we need to remove existing duplicates before adding the constraint
-- Keep the first occurrence (lowest id) of each duplicate group
DELETE FROM public.received_emails
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY temp_email_id, from_address, subject, received_at
        ORDER BY id
      ) as rn
    FROM public.received_emails
  ) sub
  WHERE rn > 1
);

-- Now add the unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS received_emails_unique_message 
ON public.received_emails (temp_email_id, from_address, subject, received_at);