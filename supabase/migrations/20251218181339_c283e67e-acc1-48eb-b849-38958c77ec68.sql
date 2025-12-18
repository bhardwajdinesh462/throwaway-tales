-- Fix generate_secret_token to explicitly reference extensions schema
CREATE OR REPLACE FUNCTION public.generate_secret_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(extensions.gen_random_bytes(16), 'hex');
END;
$$;