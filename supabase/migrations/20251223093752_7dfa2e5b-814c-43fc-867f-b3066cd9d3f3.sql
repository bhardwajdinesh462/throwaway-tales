-- Fix the log_sensitive_access trigger to handle NULL auth.uid() during migrations
CREATE OR REPLACE FUNCTION public.log_sensitive_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if we have a valid user id (skip during migrations)
  IF auth.uid() IS NOT NULL THEN
    IF TG_TABLE_NAME = 'mailboxes' AND TG_OP IN ('UPDATE', 'DELETE') THEN
      INSERT INTO admin_audit_logs (admin_user_id, action, table_name, record_id, details)
      VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        OLD.id,
        jsonb_build_object('name', OLD.name, 'operation', TG_OP)
      );
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix the encryption functions
CREATE OR REPLACE FUNCTION public.encrypt_sensitive(
  p_plaintext text,
  p_key_name text DEFAULT 'default'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_encrypted bytea;
BEGIN
  v_key := coalesce(
    current_setting('app.encryption_key', true),
    current_setting('app.settings.email_encryption_key', true),
    'lovable_default_encryption_key_32chars!'
  );
  
  v_encrypted := extensions.pgp_sym_encrypt(p_plaintext, v_key);
  
  RETURN encode(v_encrypted, 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_sensitive(
  p_ciphertext text,
  p_key_name text DEFAULT 'default'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_decrypted text;
BEGIN
  v_key := coalesce(
    current_setting('app.encryption_key', true),
    current_setting('app.settings.email_encryption_key', true),
    'lovable_default_encryption_key_32chars!'
  );
  
  BEGIN
    v_decrypted := extensions.pgp_sym_decrypt(decode(p_ciphertext, 'base64'), v_key);
    RETURN v_decrypted;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

-- Now migrate SMTP passwords
UPDATE public.mailboxes 
SET smtp_password_encrypted = public.encrypt_sensitive(smtp_password)
WHERE smtp_password IS NOT NULL 
  AND smtp_password != ''
  AND (smtp_password_encrypted IS NULL OR smtp_password_encrypted = '');

-- Migrate IMAP passwords
UPDATE public.mailboxes 
SET imap_password_encrypted = public.encrypt_sensitive(imap_password)
WHERE imap_password IS NOT NULL 
  AND imap_password != ''
  AND (imap_password_encrypted IS NULL OR imap_password_encrypted = '');

-- Migrate 2FA secrets
UPDATE public.user_2fa
SET totp_secret_encrypted = public.encrypt_sensitive(totp_secret)
WHERE totp_secret IS NOT NULL 
  AND totp_secret != ''
  AND (totp_secret_encrypted IS NULL OR totp_secret_encrypted = '');

-- Migrate backup codes
UPDATE public.user_2fa
SET backup_codes_encrypted = public.encrypt_sensitive(array_to_string(backup_codes, ','))
WHERE backup_codes IS NOT NULL 
  AND array_length(backup_codes, 1) > 0
  AND (backup_codes_encrypted IS NULL OR backup_codes_encrypted = '');