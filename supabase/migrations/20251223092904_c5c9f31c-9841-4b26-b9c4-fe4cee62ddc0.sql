-- Fix permissions and create reliable create_temp_email function

-- First, ensure GRANTs are in place for temp_emails table
GRANT SELECT ON public.temp_emails TO anon, authenticated;
GRANT INSERT ON public.temp_emails TO anon, authenticated;
GRANT UPDATE ON public.temp_emails TO anon, authenticated;
GRANT DELETE ON public.temp_emails TO anon, authenticated;

-- Also ensure GRANTs on domains table for reading
GRANT SELECT ON public.domains TO anon, authenticated;

-- Also ensure GRANTs on received_emails table
GRANT SELECT ON public.received_emails TO anon, authenticated;

-- Create a SECURITY DEFINER function for reliable email creation
-- This bypasses RLS completely and handles both guests and authenticated users
CREATE OR REPLACE FUNCTION public.create_temp_email(
  p_address text,
  p_domain_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_expires_at timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_email record;
  v_default_expiry timestamp with time zone;
  v_check_result record;
BEGIN
  -- Validate the email address against restrictions
  SELECT * INTO v_check_result FROM public.check_email_restrictions(p_address);
  IF NOT v_check_result.is_valid THEN
    RETURN jsonb_build_object('success', false, 'error', v_check_result.error_message);
  END IF;

  -- Validate domain exists and is active
  IF NOT EXISTS (SELECT 1 FROM public.domains WHERE id = p_domain_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive domain');
  END IF;

  -- Check for duplicate address
  IF EXISTS (SELECT 1 FROM public.temp_emails WHERE address = p_address AND is_active = true AND expires_at > now()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email address already exists');
  END IF;

  -- Calculate expiry: 2 hours for guests, 10 hours for users
  IF p_expires_at IS NOT NULL THEN
    v_default_expiry := p_expires_at;
  ELSIF p_user_id IS NOT NULL THEN
    v_default_expiry := now() + interval '10 hours';
  ELSE
    v_default_expiry := now() + interval '2 hours';
  END IF;

  -- Insert the new temp email
  INSERT INTO public.temp_emails (address, domain_id, user_id, expires_at, is_active)
  VALUES (p_address, p_domain_id, p_user_id, v_default_expiry, true)
  RETURNING id, address, domain_id, user_id, expires_at, is_active, created_at, secret_token
  INTO v_new_email;

  RETURN jsonb_build_object(
    'success', true,
    'email', jsonb_build_object(
      'id', v_new_email.id,
      'address', v_new_email.address,
      'domain_id', v_new_email.domain_id,
      'user_id', v_new_email.user_id,
      'expires_at', v_new_email.expires_at,
      'is_active', v_new_email.is_active,
      'created_at', v_new_email.created_at,
      'secret_token', v_new_email.secret_token
    )
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email address already exists');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.create_temp_email(text, uuid, uuid, timestamp with time zone) TO anon, authenticated;