-- Update encryption functions to use the DB_ENCRYPTION_KEY from Supabase secrets
-- The key is set via: ALTER DATABASE postgres SET app.encryption_key = 'your-key';
-- Or accessed via current_setting('app.settings.db_encryption_key', true)

-- Clear plaintext SMTP passwords (encrypted versions now exist)
UPDATE public.mailboxes 
SET smtp_password = NULL
WHERE smtp_password_encrypted IS NOT NULL 
  AND smtp_password_encrypted != '';

-- Clear plaintext IMAP passwords (encrypted versions now exist)
UPDATE public.mailboxes 
SET imap_password = NULL
WHERE imap_password_encrypted IS NOT NULL 
  AND imap_password_encrypted != '';

-- Clear plaintext TOTP secrets (encrypted versions now exist)
UPDATE public.user_2fa
SET totp_secret = '***ENCRYPTED***'
WHERE totp_secret_encrypted IS NOT NULL 
  AND totp_secret_encrypted != ''
  AND totp_secret != '***ENCRYPTED***';

-- Clear plaintext backup codes (encrypted versions now exist)
UPDATE public.user_2fa
SET backup_codes = NULL
WHERE backup_codes_encrypted IS NOT NULL 
  AND backup_codes_encrypted != '';