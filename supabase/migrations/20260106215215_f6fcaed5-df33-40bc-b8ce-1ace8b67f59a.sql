-- Fix get_mailbox_imap_password to allow service role access for edge functions
CREATE OR REPLACE FUNCTION public.get_mailbox_imap_password(p_mailbox_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_encrypted text;
  v_plaintext text;
  v_is_service_role boolean;
BEGIN
  -- Check if the caller is using service_role (for edge functions)
  v_is_service_role := coalesce(
    (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role',
    false
  );
  
  -- Allow access if service_role OR if user is admin
  IF NOT v_is_service_role AND NOT public.is_admin(auth.uid()) THEN
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
$function$;

-- Also fix get_mailbox_smtp_password for consistency
CREATE OR REPLACE FUNCTION public.get_mailbox_smtp_password(p_mailbox_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_encrypted text;
  v_plaintext text;
  v_is_service_role boolean;
BEGIN
  -- Check if the caller is using service_role (for edge functions)
  v_is_service_role := coalesce(
    (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role',
    false
  );
  
  -- Allow access if service_role OR if user is admin
  IF NOT v_is_service_role AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  SELECT smtp_password_encrypted, smtp_password INTO v_encrypted, v_plaintext
  FROM public.mailboxes
  WHERE id = p_mailbox_id;
  
  IF v_encrypted IS NOT NULL AND v_encrypted != '' THEN
    RETURN public.decrypt_sensitive(v_encrypted);
  END IF;
  
  RETURN v_plaintext;
END;
$function$;