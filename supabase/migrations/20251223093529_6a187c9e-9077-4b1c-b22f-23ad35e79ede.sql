-- SECURITY FIX 1: Make audit logs tamper-proof (append-only)
-- Drop any existing update/delete policies on admin_audit_logs
DROP POLICY IF EXISTS "Admins can delete audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admins can update audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Anyone can update audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Anyone can delete audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Audit logs cannot be updated" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Audit logs cannot be deleted" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Anon cannot update audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Anon cannot delete audit logs" ON public.admin_audit_logs;

-- Create explicit DENY policies for UPDATE and DELETE
CREATE POLICY "Audit logs cannot be updated"
ON public.admin_audit_logs
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Audit logs cannot be deleted"
ON public.admin_audit_logs
FOR DELETE
TO authenticated
USING (false);

CREATE POLICY "Anon cannot update audit logs"
ON public.admin_audit_logs
FOR UPDATE
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Anon cannot delete audit logs"
ON public.admin_audit_logs
FOR DELETE
TO anon
USING (false);

-- SECURITY FIX 2: Create encryption/decryption functions using extensions schema
-- Use the correct schema reference for pgcrypto functions

-- Function to encrypt sensitive data using extensions.pgp_sym_encrypt
CREATE OR REPLACE FUNCTION public.encrypt_sensitive(
  p_plaintext text,
  p_key_name text DEFAULT 'default'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_encrypted bytea;
BEGIN
  -- Use a simple derived key from app settings or a default
  v_key := coalesce(
    current_setting('app.encryption_key', true),
    current_setting('app.settings.email_encryption_key', true),
    'lovable_default_encryption_key_32chars!'
  );
  
  -- Encrypt using pgp_sym_encrypt from extensions schema
  v_encrypted := extensions.pgp_sym_encrypt(p_plaintext::bytea, v_key);
  
  RETURN encode(v_encrypted, 'base64');
END;
$$;

-- Function to decrypt sensitive data
CREATE OR REPLACE FUNCTION public.decrypt_sensitive(
  p_ciphertext text,
  p_key_name text DEFAULT 'default'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
  v_decrypted bytea;
BEGIN
  v_key := coalesce(
    current_setting('app.encryption_key', true),
    current_setting('app.settings.email_encryption_key', true),
    'lovable_default_encryption_key_32chars!'
  );
  
  -- Decrypt using pgp_sym_decrypt from extensions schema
  BEGIN
    v_decrypted := extensions.pgp_sym_decrypt(decode(p_ciphertext, 'base64'), v_key);
    RETURN convert_from(v_decrypted, 'UTF8');
  EXCEPTION WHEN OTHERS THEN
    -- If decryption fails, return NULL (data may not be encrypted or wrong key)
    RETURN NULL;
  END;
END;
$$;

-- Add encrypted columns to mailboxes table
ALTER TABLE public.mailboxes 
ADD COLUMN IF NOT EXISTS smtp_password_encrypted text,
ADD COLUMN IF NOT EXISTS imap_password_encrypted text;

-- Add encrypted columns to user_2fa table
ALTER TABLE public.user_2fa
ADD COLUMN IF NOT EXISTS totp_secret_encrypted text,
ADD COLUMN IF NOT EXISTS backup_codes_encrypted text;

-- Create secure accessor function for mailbox SMTP password (admin only)
CREATE OR REPLACE FUNCTION public.get_mailbox_smtp_password(p_mailbox_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted text;
  v_plaintext text;
BEGIN
  -- Only admins can access mailbox passwords
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  SELECT smtp_password_encrypted, smtp_password INTO v_encrypted, v_plaintext
  FROM public.mailboxes
  WHERE id = p_mailbox_id;
  
  -- Try encrypted first, then fallback to plaintext
  IF v_encrypted IS NOT NULL AND v_encrypted != '' THEN
    RETURN public.decrypt_sensitive(v_encrypted);
  END IF;
  
  RETURN v_plaintext;
END;
$$;

-- Create secure accessor function for mailbox IMAP password (admin only)
CREATE OR REPLACE FUNCTION public.get_mailbox_imap_password(p_mailbox_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted text;
  v_plaintext text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  SELECT imap_password_encrypted, imap_password INTO v_encrypted, v_plaintext
  FROM public.mailboxes
  WHERE id = p_mailbox_id;
  
  IF v_encrypted IS NOT NULL AND v_encrypted != '' THEN
    RETURN public.decrypt_sensitive(v_encrypted);
  END IF;
  
  RETURN v_plaintext;
END;
$$;

-- Create secure accessor for 2FA secret (user only)
CREATE OR REPLACE FUNCTION public.get_user_2fa_secret(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted text;
  v_plaintext text;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied: You can only access your own 2FA secret';
  END IF;
  
  SELECT totp_secret_encrypted, totp_secret INTO v_encrypted, v_plaintext
  FROM public.user_2fa
  WHERE user_id = p_user_id;
  
  IF v_encrypted IS NOT NULL AND v_encrypted != '' THEN
    RETURN public.decrypt_sensitive(v_encrypted);
  END IF;
  
  RETURN v_plaintext;
END;
$$;

-- Create secure accessor for 2FA backup codes (user only)
CREATE OR REPLACE FUNCTION public.get_user_2fa_backup_codes(p_user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encrypted text;
  v_codes text[];
  v_decrypted text;
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied: You can only access your own backup codes';
  END IF;
  
  SELECT backup_codes_encrypted, backup_codes INTO v_encrypted, v_codes
  FROM public.user_2fa
  WHERE user_id = p_user_id;
  
  IF v_encrypted IS NOT NULL AND v_encrypted != '' THEN
    v_decrypted := public.decrypt_sensitive(v_encrypted);
    IF v_decrypted IS NOT NULL THEN
      RETURN string_to_array(v_decrypted, ',');
    END IF;
  END IF;
  
  RETURN v_codes;
END;
$$;

-- Function to securely store a new mailbox password (encrypts on save)
CREATE OR REPLACE FUNCTION public.set_mailbox_smtp_password(p_mailbox_id uuid, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  UPDATE public.mailboxes
  SET smtp_password_encrypted = public.encrypt_sensitive(p_password),
      smtp_password = NULL,  -- Clear plaintext after encrypting
      updated_at = now()
  WHERE id = p_mailbox_id;
  
  RETURN true;
END;
$$;

-- Function to securely store IMAP password
CREATE OR REPLACE FUNCTION public.set_mailbox_imap_password(p_mailbox_id uuid, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  UPDATE public.mailboxes
  SET imap_password_encrypted = public.encrypt_sensitive(p_password),
      imap_password = NULL,
      updated_at = now()
  WHERE id = p_mailbox_id;
  
  RETURN true;
END;
$$;

-- Function to securely store 2FA secret
CREATE OR REPLACE FUNCTION public.set_user_2fa_secret(p_user_id uuid, p_secret text, p_backup_codes text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  UPDATE public.user_2fa
  SET totp_secret_encrypted = public.encrypt_sensitive(p_secret),
      backup_codes_encrypted = public.encrypt_sensitive(array_to_string(p_backup_codes, ',')),
      totp_secret = NULL,
      backup_codes = NULL,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.encrypt_sensitive(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_sensitive(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mailbox_smtp_password(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mailbox_imap_password(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_2fa_secret(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_2fa_backup_codes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_mailbox_smtp_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_mailbox_imap_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_2fa_secret(uuid, text, text[]) TO authenticated;

-- Update select_available_mailbox to use decryption
CREATE OR REPLACE FUNCTION public.select_available_mailbox()
RETURNS TABLE(mailbox_id uuid, smtp_host text, smtp_port integer, smtp_user text, smtp_password text, smtp_from text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM reset_mailbox_hourly_counters();
    PERFORM reset_mailbox_daily_counters();
    
    RETURN QUERY
    SELECT 
        m.id as mailbox_id,
        m.smtp_host,
        m.smtp_port,
        m.smtp_user,
        COALESCE(
          public.decrypt_sensitive(m.smtp_password_encrypted),
          m.smtp_password
        ) as smtp_password,
        m.smtp_from
    FROM mailboxes m
    WHERE m.is_active = true
      AND m.smtp_host IS NOT NULL
      AND m.smtp_user IS NOT NULL
      AND (m.smtp_password IS NOT NULL OR m.smtp_password_encrypted IS NOT NULL)
      AND m.emails_sent_this_hour < m.hourly_limit
      AND m.emails_sent_today < m.daily_limit
      AND (m.last_error_at IS NULL OR m.last_error_at < now() - interval '30 minutes')
    ORDER BY m.priority ASC, m.emails_sent_this_hour ASC
    LIMIT 1;
END;
$$;