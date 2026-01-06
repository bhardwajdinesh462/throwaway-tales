CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user'
);


--
-- Name: add_admin_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_admin_role(target_user_id uuid, target_role public.app_role) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Insert or update role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, target_role)
  ON CONFLICT (user_id) DO UPDATE SET role = target_role;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), 'ADD_ADMIN_ROLE', 'user_roles', target_user_id, jsonb_build_object('role', target_role::text));
  
  RETURN true;
END;
$$;


--
-- Name: admin_assign_subscription(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_assign_subscription(target_user_id uuid, target_tier_id uuid, duration_months integer DEFAULT 1) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  tier_name text;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Get tier name for logging
  SELECT name INTO tier_name FROM public.subscription_tiers WHERE id = target_tier_id;
  
  IF tier_name IS NULL THEN
    RAISE EXCEPTION 'Invalid subscription tier';
  END IF;
  
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Insert or update subscription
  INSERT INTO public.user_subscriptions (
    user_id, 
    tier_id, 
    status, 
    current_period_start, 
    current_period_end
  )
  VALUES (
    target_user_id, 
    target_tier_id, 
    'active',
    now(),
    now() + (duration_months || ' months')::interval
  )
  ON CONFLICT (user_id) DO UPDATE SET
    tier_id = target_tier_id,
    status = 'active',
    current_period_start = now(),
    current_period_end = now() + (duration_months || ' months')::interval,
    updated_at = now();
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, record_id, details)
  VALUES (
    auth.uid(), 
    'ASSIGN_SUBSCRIPTION', 
    'user_subscriptions', 
    target_user_id, 
    jsonb_build_object('tier', tier_name, 'duration_months', duration_months)
  );
  
  RETURN true;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text,
    display_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email_verified boolean DEFAULT false,
    registration_ip text
);


--
-- Name: admin_get_all_profiles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_all_profiles() RETURNS SETOF public.profiles
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if user is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Log the access
  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, details)
  VALUES (auth.uid(), 'VIEW_ALL', 'profiles', '{"reason": "Admin viewed all user profiles"}'::jsonb);

  -- Return all profiles
  RETURN QUERY SELECT * FROM public.profiles;
END;
$$;


--
-- Name: admin_get_user_subscription(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_user_subscription(target_user_id uuid) RETURNS TABLE(subscription_id uuid, tier_id uuid, tier_name text, status text, current_period_start timestamp with time zone, current_period_end timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    us.id as subscription_id,
    us.tier_id,
    st.name as tier_name,
    us.status,
    us.current_period_start,
    us.current_period_end
  FROM public.user_subscriptions us
  JOIN public.subscription_tiers st ON st.id = us.tier_id
  WHERE us.user_id = target_user_id
  LIMIT 1;
END;
$$;


--
-- Name: admin_revoke_subscription(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_revoke_subscription(target_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  free_tier_id uuid;
  old_tier_name text;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Get free tier id
  SELECT id INTO free_tier_id 
  FROM public.subscription_tiers 
  WHERE LOWER(name) = 'free' AND is_active = true
  LIMIT 1;
  
  IF free_tier_id IS NULL THEN
    RAISE EXCEPTION 'Free tier not found';
  END IF;
  
  -- Get current tier name for logging
  SELECT st.name INTO old_tier_name
  FROM public.user_subscriptions us
  JOIN public.subscription_tiers st ON st.id = us.tier_id
  WHERE us.user_id = target_user_id;
  
  -- Update subscription to free tier and cancel
  UPDATE public.user_subscriptions
  SET 
    tier_id = free_tier_id,
    status = 'cancelled',
    stripe_subscription_id = NULL,
    stripe_customer_id = NULL,
    cancel_at_period_end = false,
    updated_at = now()
  WHERE user_id = target_user_id;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, record_id, details)
  VALUES (
    auth.uid(), 
    'REVOKE_SUBSCRIPTION', 
    'user_subscriptions', 
    target_user_id, 
    jsonb_build_object('old_tier', old_tier_name, 'new_tier', 'free')
  );
  
  RETURN true;
END;
$$;


--
-- Name: bulk_delete_users(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bulk_delete_users(user_ids uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  deleted_count integer := 0;
  uid uuid;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  FOREACH uid IN ARRAY user_ids LOOP
    -- Skip if trying to delete yourself
    IF uid = auth.uid() THEN
      CONTINUE;
    END IF;
    
    -- Skip admins
    IF is_admin(uid) THEN
      CONTINUE;
    END IF;
    
    -- Delete user data
    DELETE FROM public.user_suspensions WHERE user_id = uid;
    DELETE FROM public.user_roles WHERE user_id = uid;
    DELETE FROM public.profiles WHERE user_id = uid;
    
    deleted_count := deleted_count + 1;
  END LOOP;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, details)
  VALUES (auth.uid(), 'BULK_DELETE_USERS', 'profiles', 
    jsonb_build_object('count', deleted_count, 'user_ids', user_ids));
  
  RETURN deleted_count;
END;
$$;


--
-- Name: check_email_restrictions(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_email_restrictions(email_address text) RETURNS TABLE(is_valid boolean, error_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  min_chars integer;
  blocked_word text;
  email_prefix text;
BEGIN
  -- Extract email prefix (before @)
  email_prefix := split_part(email_address, '@', 1);
  
  -- Check minimum characters setting
  SELECT value::integer INTO min_chars
  FROM public.email_restrictions
  WHERE restriction_type = 'min_characters' AND is_active = true
  LIMIT 1;
  
  IF min_chars IS NOT NULL AND length(email_prefix) < min_chars THEN
    RETURN QUERY SELECT false, format('Email prefix must be at least %s characters', min_chars);
    RETURN;
  END IF;
  
  -- Check blocked words
  SELECT value INTO blocked_word
  FROM public.email_restrictions
  WHERE restriction_type = 'blocked_word' 
    AND is_active = true
    AND lower(email_prefix) LIKE '%' || lower(value) || '%'
  LIMIT 1;
  
  IF blocked_word IS NOT NULL THEN
    RETURN QUERY SELECT false, format('Email contains blocked word: %s', blocked_word);
    RETURN;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT true, NULL::text;
END;
$$;


--
-- Name: check_rate_limit(text, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_rate_limit(p_identifier text, p_action_type text, p_max_requests integer DEFAULT 10, p_window_minutes integer DEFAULT 60) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_window_start timestamp with time zone;
  v_current_count integer;
BEGIN
  -- Calculate the start of the current time window
  v_window_start := date_trunc('hour', now()) + 
    (floor(extract(minute from now()) / p_window_minutes) * p_window_minutes) * interval '1 minute';
  
  -- Get current count for this identifier/action in this window
  SELECT request_count INTO v_current_count
  FROM public.rate_limits
  WHERE identifier = p_identifier
    AND action_type = p_action_type
    AND window_start = v_window_start;
  
  -- If no record exists, create one
  IF v_current_count IS NULL THEN
    INSERT INTO public.rate_limits (identifier, action_type, window_start, request_count)
    VALUES (p_identifier, p_action_type, v_window_start, 1)
    ON CONFLICT (identifier, action_type, window_start) 
    DO UPDATE SET request_count = rate_limits.request_count + 1
    RETURNING request_count INTO v_current_count;
    
    RETURN true; -- First request, allow it
  END IF;
  
  -- Check if limit exceeded
  IF v_current_count >= p_max_requests THEN
    RETURN false; -- Rate limit exceeded
  END IF;
  
  -- Increment counter
  UPDATE public.rate_limits
  SET request_count = request_count + 1
  WHERE identifier = p_identifier
    AND action_type = p_action_type
    AND window_start = v_window_start;
  
  RETURN true; -- Request allowed
END;
$$;


--
-- Name: cleanup_old_rate_limits(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_rate_limits() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - interval '24 hours';
END;
$$;


--
-- Name: create_temp_email(text, uuid, uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_temp_email(p_address text, p_domain_id uuid, p_user_id uuid DEFAULT NULL::uuid, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_new_email record;
  v_expiry timestamp with time zone;
  v_check_result record;
  v_user_tier record;
  v_free_tier record;
  v_active_email_count integer;
  v_max_emails integer;
  v_expiry_hours integer;
  v_client_ip text;
BEGIN
  -- Check if email pattern is blocked
  IF public.is_email_blocked(p_address) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This email address pattern is not allowed.');
  END IF;

  -- Check if client IP is blocked (get from headers)
  v_client_ip := NULLIF(split_part(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), '');
  IF v_client_ip IS NULL THEN
    v_client_ip := current_setting('request.headers', true)::json->>'x-real-ip';
  END IF;
  IF v_client_ip IS NULL THEN
    v_client_ip := current_setting('request.headers', true)::json->>'cf-connecting-ip';
  END IF;
  
  IF v_client_ip IS NOT NULL AND public.is_ip_blocked(v_client_ip) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your IP address has been blocked from creating emails.');
  END IF;

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

  -- Get the appropriate tier limits
  IF p_user_id IS NOT NULL THEN
    -- For authenticated users, get their subscription tier
    SELECT st.* INTO v_user_tier
    FROM public.user_subscriptions us
    JOIN public.subscription_tiers st ON st.id = us.tier_id
    WHERE us.user_id = p_user_id 
      AND us.status = 'active'
      AND us.current_period_end > now()
    ORDER BY st.price_monthly DESC
    LIMIT 1;
    
    -- If no active subscription, fall back to free tier
    IF v_user_tier IS NULL THEN
      SELECT * INTO v_user_tier 
      FROM public.subscription_tiers 
      WHERE LOWER(name) = 'free' AND is_active = true
      LIMIT 1;
    END IF;
    
    -- Count active emails for this user
    SELECT COUNT(*) INTO v_active_email_count
    FROM public.temp_emails
    WHERE user_id = p_user_id 
      AND is_active = true 
      AND expires_at > now();
    
    -- Set limits from tier (use defaults if tier not found)
    v_max_emails := COALESCE(v_user_tier.max_temp_emails, 3);
    v_expiry_hours := COALESCE(v_user_tier.email_expiry_hours, 10);
    
    -- Check max emails limit (-1 means unlimited)
    IF v_max_emails > 0 AND v_active_email_count >= v_max_emails THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('Email limit reached. Your plan allows %s emails.', v_max_emails),
        'code', 'TIER_LIMIT_REACHED',
        'limit', v_max_emails,
        'current', v_active_email_count
      );
    END IF;
  ELSE
    -- For guests, use the free tier
    SELECT * INTO v_free_tier 
    FROM public.subscription_tiers 
    WHERE LOWER(name) = 'free' AND is_active = true
    LIMIT 1;
    
    -- Use free tier expiry hours, default to 2 if not found
    v_expiry_hours := COALESCE(v_free_tier.email_expiry_hours, 2);
  END IF;

  -- Calculate expiry
  IF p_expires_at IS NOT NULL THEN
    v_expiry := p_expires_at;
  ELSE
    v_expiry := now() + (v_expiry_hours || ' hours')::interval;
  END IF;

  -- Insert the new temp email
  INSERT INTO public.temp_emails (address, domain_id, user_id, expires_at, is_active)
  VALUES (p_address, p_domain_id, p_user_id, v_expiry, true)
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


--
-- Name: decrypt_sensitive(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrypt_sensitive(p_ciphertext text, p_key_name text DEFAULT 'default'::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: delete_user_as_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user_as_admin(target_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Prevent deleting yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;
  
  -- Delete from user_roles first
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  
  -- Delete from profiles
  DELETE FROM public.profiles WHERE user_id = target_user_id;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), 'DELETE_USER', 'profiles', target_user_id, jsonb_build_object('reason', 'Admin deleted user'));
  
  RETURN true;
END;
$$;


--
-- Name: encrypt_sensitive(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.encrypt_sensitive(p_plaintext text, p_key_name text DEFAULT 'default'::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: enforce_temp_email_rate_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_temp_email_rate_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_identifier text;
  v_allowed boolean;
  v_headers json;
  v_ip text;
  v_setting jsonb;
  v_max_requests int := 10;
  v_window_minutes int := 60;
  v_headers_text text;
BEGIN
  -- Optional configurable settings
  SELECT value INTO v_setting
  FROM public.app_settings
  WHERE key = 'rate_limit_temp_email_create'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_setting IS NOT NULL THEN
    v_max_requests := COALESCE((v_setting->>'max_requests')::int, v_max_requests);
    v_window_minutes := COALESCE((v_setting->>'window_minutes')::int, v_window_minutes);
  END IF;

  -- Use user_id if authenticated
  IF NEW.user_id IS NOT NULL THEN
    v_identifier := NEW.user_id::text;
  ELSE
    -- For anonymous users, try to use request IP headers (best-effort)
    -- NOTE: current_setting(...) can sometimes be empty string; treat that as missing.
    v_headers_text := NULLIF(current_setting('request.headers', true), '');
    v_headers := COALESCE(v_headers_text, '{}')::json;

    -- Prefer x-forwarded-for (may contain multiple IPs)
    v_ip := NULLIF(split_part(COALESCE(v_headers->>'x-forwarded-for', ''), ',', 1), '');

    IF v_ip IS NULL THEN
      v_ip := NULLIF(v_headers->>'x-real-ip', '');
    END IF;

    IF v_ip IS NULL THEN
      v_ip := NULLIF(v_headers->>'cf-connecting-ip', '');
    END IF;

    IF v_ip IS NOT NULL THEN
      v_identifier := 'anon_ip_' || v_ip;
    ELSE
      -- Last resort: hash user-agent to reduce global collisions
      v_identifier := 'anon_ua_' || md5(COALESCE(v_headers->>'user-agent', 'unknown'));
    END IF;
  END IF;

  v_allowed := public.check_rate_limit(v_identifier, 'temp_email_create', v_max_requests, v_window_minutes);

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before creating more temporary emails.';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: find_user_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_user_by_email(search_email text) RETURNS TABLE(found_user_id uuid, found_email text, found_display_name text, found_role text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id,
    p.email,
    p.display_name,
    COALESCE(ur.role::text, 'user')
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE LOWER(p.email) = LOWER(search_email)
  LIMIT 1;
END;
$$;


--
-- Name: generate_secret_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_secret_token() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN encode(extensions.gen_random_bytes(16), 'hex');
END;
$$;


--
-- Name: get_admin_audit_logs(integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_audit_logs(p_page integer DEFAULT 1, p_page_size integer DEFAULT 20, p_action_filter text DEFAULT NULL::text) RETURNS TABLE(id uuid, admin_email text, admin_name text, action text, table_name text, record_id uuid, details jsonb, created_at timestamp with time zone, total_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_offset integer;
  v_total bigint;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  v_offset := (p_page - 1) * p_page_size;
  
  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM public.admin_audit_logs
  WHERE (p_action_filter IS NULL OR action ILIKE '%' || p_action_filter || '%');

  RETURN QUERY
  SELECT 
    l.id,
    p.email as admin_email,
    p.display_name as admin_name,
    l.action,
    l.table_name,
    l.record_id,
    l.details,
    l.created_at,
    v_total as total_count
  FROM public.admin_audit_logs l
  LEFT JOIN public.profiles p ON p.user_id = l.admin_user_id
  WHERE (p_action_filter IS NULL OR l.action ILIKE '%' || p_action_filter || '%')
  ORDER BY l.created_at DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;


--
-- Name: get_admin_users(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_users() RETURNS TABLE(id uuid, user_id uuid, email text, display_name text, role text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.email,
    p.display_name,
    ur.role::text,
    ur.created_at
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role IN ('admin', 'moderator')
  ORDER BY ur.created_at DESC;
END;
$$;


--
-- Name: get_all_profiles_for_admin(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_profiles_for_admin(p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 10) RETURNS TABLE(id uuid, user_id uuid, email text, display_name text, avatar_url text, created_at timestamp with time zone, updated_at timestamp with time zone, role text, total_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_offset integer;
    v_total bigint;
BEGIN
    -- Check if user is admin
    IF NOT is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required';
    END IF;

    v_offset := (p_page - 1) * p_page_size;
    
    -- Get total count
    SELECT COUNT(*) INTO v_total
    FROM public.profiles p
    WHERE (p_search IS NULL OR p_search = '' OR 
           p.email ILIKE '%' || p_search || '%' OR 
           p.display_name ILIKE '%' || p_search || '%');
    
    -- Return results with roles
    RETURN QUERY
    SELECT 
        p.id,
        p.user_id,
        p.email,
        p.display_name,
        p.avatar_url,
        p.created_at,
        p.updated_at,
        COALESCE(ur.role::text, 'user') as role,
        v_total as total_count
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE (p_search IS NULL OR p_search = '' OR 
           p.email ILIKE '%' || p_search || '%' OR 
           p.display_name ILIKE '%' || p_search || '%')
    ORDER BY p.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset;
END;
$$;


--
-- Name: get_email_logs(integer, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_email_logs(p_page integer DEFAULT 1, p_page_size integer DEFAULT 20, p_status_filter text DEFAULT NULL::text, p_search text DEFAULT NULL::text) RETURNS TABLE(id uuid, mailbox_id uuid, mailbox_name text, recipient_email text, subject text, status text, error_code text, error_message text, smtp_response text, smtp_host text, config_source text, message_id text, attempt_count integer, created_at timestamp with time zone, sent_at timestamp with time zone, failed_at timestamp with time zone, total_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: get_email_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_email_stats() RETURNS TABLE(total_sent bigint, total_failed bigint, total_bounced bigint, sent_today bigint, failed_today bigint, success_rate numeric)
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: get_mailbox_imap_password(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_mailbox_imap_password(p_mailbox_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: get_mailbox_smtp_password(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_mailbox_smtp_password(p_mailbox_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: get_registration_ip(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_registration_ip() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT current_setting('request.headers', true)::json->>'x-forwarded-for'
$$;


--
-- Name: get_suspended_users(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_suspended_users() RETURNS TABLE(id uuid, user_id uuid, email text, display_name text, suspended_at timestamp with time zone, suspended_until timestamp with time zone, reason text, suspended_by_email text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    p.email,
    p.display_name,
    s.suspended_at,
    s.suspended_until,
    s.reason,
    admin_p.email as suspended_by_email
  FROM public.user_suspensions s
  JOIN public.profiles p ON p.user_id = s.user_id
  LEFT JOIN public.profiles admin_p ON admin_p.user_id = s.suspended_by
  WHERE s.is_active = true
  ORDER BY s.suspended_at DESC;
END;
$$;


--
-- Name: get_user_2fa_backup_codes(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_2fa_backup_codes(p_user_id uuid) RETURNS text[]
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: get_user_2fa_secret(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_2fa_secret(p_user_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_count integer;
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );

  -- Check if this is the first user (count existing users)
  SELECT COUNT(*) INTO user_count FROM auth.users WHERE id != new.id;
  
  -- If first user, make them admin
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'admin');
  ELSE
    -- Otherwise, assign default user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, 'user');
  END IF;

  RETURN new;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: increment_email_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_email_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.email_stats 
  SET stat_value = stat_value + 1, updated_at = now()
  WHERE stat_key = 'total_emails_generated';
  RETURN NEW;
END;
$$;


--
-- Name: increment_mailbox_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_mailbox_usage(p_mailbox_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;


--
-- Name: is_country_blocked(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_country_blocked(p_country_code text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.blocked_countries
    WHERE country_code = UPPER(p_country_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;


--
-- Name: is_email_blocked(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_email_blocked(p_email text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    blocked_record RECORD;
BEGIN
    -- Check for exact matches and regex patterns
    FOR blocked_record IN 
        SELECT email_pattern, is_regex 
        FROM public.blocked_emails 
        WHERE is_active = true 
        AND (expires_at IS NULL OR expires_at > NOW())
    LOOP
        IF blocked_record.is_regex THEN
            -- Regex pattern matching
            IF p_email ~* blocked_record.email_pattern THEN
                RETURN true;
            END IF;
        ELSE
            -- Exact match (case insensitive) or wildcard
            IF LOWER(p_email) = LOWER(blocked_record.email_pattern) 
               OR LOWER(p_email) LIKE LOWER(REPLACE(blocked_record.email_pattern, '*', '%')) THEN
                RETURN true;
            END IF;
        END IF;
    END LOOP;
    
    RETURN false;
END;
$$;


--
-- Name: is_guest_temp_email(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_guest_temp_email(_temp_email_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.temp_emails te
    where te.id = _temp_email_id
      and te.user_id is null
  );
$$;


--
-- Name: is_ip_blocked(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_ip_blocked(p_ip_address text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_ips
    WHERE ip_address = p_ip_address
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  )
$$;


--
-- Name: is_user_suspended(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_user_suspended(check_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_suspensions
    WHERE user_id = check_user_id
    AND is_active = true
    AND (suspended_until IS NULL OR suspended_until > now())
  )
$$;


--
-- Name: log_admin_access(text, text, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_admin_access(p_action text, p_table_name text, p_record_id uuid DEFAULT NULL::uuid, p_details jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_log_id uuid;
BEGIN
  -- Only log if user is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can create audit logs';
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), p_action, p_table_name, p_record_id, p_details)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;


--
-- Name: log_email_attempt(uuid, text, text, text, text, text, text, text, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_email_attempt(p_mailbox_id uuid, p_recipient_email text, p_subject text, p_status text, p_error_code text DEFAULT NULL::text, p_error_message text DEFAULT NULL::text, p_smtp_response text DEFAULT NULL::text, p_mailbox_name text DEFAULT NULL::text, p_smtp_host text DEFAULT NULL::text, p_config_source text DEFAULT NULL::text, p_message_id text DEFAULT NULL::text, p_attempt_count integer DEFAULT 1) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: log_sensitive_access(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_sensitive_access() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: record_mailbox_error(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_mailbox_error(p_mailbox_id uuid, p_error text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE mailboxes 
    SET last_error = p_error,
        last_error_at = now(),
        updated_at = now()
    WHERE id = p_mailbox_id;
END;
$$;


--
-- Name: remove_admin_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_admin_role(target_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  admin_count integer;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Prevent removing yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove your own admin role';
  END IF;
  
  -- Count remaining admins
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin' AND user_id != target_user_id;
  
  -- Ensure at least one admin remains
  IF admin_count < 1 THEN
    RAISE EXCEPTION 'Cannot remove the last admin';
  END IF;
  
  -- Update role to 'user' instead of deleting
  UPDATE public.user_roles SET role = 'user' WHERE user_id = target_user_id;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), 'REMOVE_ADMIN_ROLE', 'user_roles', target_user_id, jsonb_build_object('reason', 'Admin role removed'));
  
  RETURN true;
END;
$$;


--
-- Name: reset_mailbox_daily_counters(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_mailbox_daily_counters() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE mailboxes 
    SET emails_sent_today = 0, 
        last_day_reset = now(),
        updated_at = now()
    WHERE last_day_reset < now() - interval '1 day';
END;
$$;


--
-- Name: reset_mailbox_hourly_counters(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_mailbox_hourly_counters() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE mailboxes 
    SET emails_sent_this_hour = 0, 
        last_hour_reset = now(),
        updated_at = now()
    WHERE last_hour_reset < now() - interval '1 hour';
END;
$$;


--
-- Name: select_available_mailbox(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.select_available_mailbox() RETURNS TABLE(mailbox_id uuid, smtp_host text, smtp_port integer, smtp_user text, smtp_password text, smtp_from text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: set_mailbox_imap_password(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_mailbox_imap_password(p_mailbox_id uuid, p_password text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: set_mailbox_smtp_password(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_mailbox_smtp_password(p_mailbox_id uuid, p_password text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: set_user_2fa_secret(uuid, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_2fa_secret(p_user_id uuid, p_secret text, p_backup_codes text[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: suspend_user(uuid, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suspend_user(target_user_id uuid, suspension_reason text DEFAULT NULL::text, suspend_until timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Prevent suspending yourself
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot suspend your own account';
  END IF;
  
  -- Prevent suspending other admins
  IF is_admin(target_user_id) THEN
    RAISE EXCEPTION 'Cannot suspend admin users';
  END IF;
  
  -- Insert or update suspension
  INSERT INTO public.user_suspensions (user_id, suspended_by, reason, suspended_until, is_active)
  VALUES (target_user_id, auth.uid(), suspension_reason, suspend_until, true)
  ON CONFLICT (user_id) DO UPDATE SET
    suspended_by = auth.uid(),
    suspended_at = now(),
    reason = suspension_reason,
    suspended_until = suspend_until,
    is_active = true,
    lifted_at = NULL,
    lifted_by = NULL;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), 'SUSPEND_USER', 'user_suspensions', target_user_id, 
    jsonb_build_object('reason', suspension_reason, 'until', suspend_until));
  
  RETURN true;
END;
$$;


--
-- Name: unsuspend_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unsuspend_user(target_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  -- Update suspension record
  UPDATE public.user_suspensions
  SET is_active = false,
      lifted_at = now(),
      lifted_by = auth.uid()
  WHERE user_id = target_user_id AND is_active = true;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, table_name, record_id, details)
  VALUES (auth.uid(), 'UNSUSPEND_USER', 'user_suspensions', target_user_id, 
    jsonb_build_object('reason', 'Suspension lifted by admin'));
  
  RETURN true;
END;
$$;


--
-- Name: update_email_templates_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_email_templates_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_friendly_websites_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_friendly_websites_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_subscription_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_subscription_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: validate_email_access_from_headers(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_email_access_from_headers(p_temp_email_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_token text;
  v_valid boolean := false;
BEGIN
  -- Get token from request headers
  v_token := current_setting('request.headers', true)::json->>'x-email-token';
  
  -- If no token provided, deny access
  IF v_token IS NULL OR v_token = '' THEN
    RETURN false;
  END IF;
  
  -- Validate token against stored secret_token
  SELECT EXISTS (
    SELECT 1 FROM temp_emails
    WHERE id = p_temp_email_id
      AND secret_token = v_token
      AND is_active = true
      AND expires_at > now()
  ) INTO v_valid;
  
  RETURN v_valid;
END;
$$;


--
-- Name: validate_temp_email_restrictions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_temp_email_restrictions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  check_result record;
BEGIN
  SELECT * INTO check_result FROM public.check_email_restrictions(NEW.address);
  
  IF NOT check_result.is_valid THEN
    RAISE EXCEPTION '%', check_result.error_message;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: verify_temp_email_token(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_temp_email_token(p_temp_email_id uuid, p_token text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.temp_emails
    WHERE id = p_temp_email_id 
    AND secret_token = p_token
  )
$$;


--
-- Name: admin_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id uuid NOT NULL,
    action text NOT NULL,
    table_name text NOT NULL,
    record_id uuid,
    details jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_role_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_role_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    requested_role text NOT NULL,
    existing_role text,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_role_requests_requested_role_check CHECK ((requested_role = ANY (ARRAY['admin'::text, 'moderator'::text]))),
    CONSTRAINT admin_role_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: backup_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    backup_type text DEFAULT 'manual'::text NOT NULL,
    status text DEFAULT 'completed'::text,
    file_size_bytes bigint,
    tables_included text[],
    row_counts jsonb,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval)
);


--
-- Name: banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    "position" text NOT NULL,
    type text NOT NULL,
    content text NOT NULL,
    image_url text,
    link_url text,
    is_active boolean DEFAULT true NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    priority integer DEFAULT 0 NOT NULL,
    click_count integer DEFAULT 0 NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    width integer DEFAULT 728,
    height integer DEFAULT 90,
    size_name text DEFAULT 'leaderboard'::text,
    CONSTRAINT banners_position_check CHECK (("position" = ANY (ARRAY['header'::text, 'sidebar'::text, 'content'::text, 'footer'::text]))),
    CONSTRAINT banners_type_check CHECK ((type = ANY (ARRAY['image'::text, 'html'::text, 'script'::text, 'text'::text])))
);

ALTER TABLE ONLY public.banners REPLICA IDENTITY FULL;


--
-- Name: blocked_countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocked_countries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    country_code character(2) NOT NULL,
    country_name text NOT NULL,
    reason text,
    blocked_by uuid NOT NULL,
    blocked_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: blocked_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocked_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email_pattern text NOT NULL,
    reason text,
    blocked_by text NOT NULL,
    blocked_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    is_regex boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: blocked_ips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocked_ips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_address text NOT NULL,
    reason text,
    blocked_by uuid NOT NULL,
    blocked_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: blogs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blogs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text,
    content text NOT NULL,
    featured_image_url text,
    meta_title text,
    meta_description text,
    tags text[] DEFAULT '{}'::text[],
    category text DEFAULT 'General'::text,
    author text NOT NULL,
    reading_time integer DEFAULT 5,
    published boolean DEFAULT false,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_premium boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    received_email_id uuid NOT NULL,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_size integer NOT NULL,
    storage_path text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_forwarding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_forwarding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    temp_email_id uuid NOT NULL,
    forward_to_address text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mailbox_id uuid,
    recipient_email text NOT NULL,
    subject text,
    status text DEFAULT 'pending'::text NOT NULL,
    error_code text,
    error_message text,
    smtp_response text,
    attempt_count integer DEFAULT 1,
    mailbox_name text,
    smtp_host text,
    config_source text,
    message_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    failed_at timestamp with time zone
);


--
-- Name: email_restrictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_restrictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restriction_type text NOT NULL,
    value text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stat_key text NOT NULL,
    stat_value bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT email_templates_type_check CHECK ((type = ANY (ARRAY['welcome'::text, 'password_reset'::text, 'verification'::text, 'notification'::text, 'custom'::text])))
);


--
-- Name: email_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text) NOT NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval)
);


--
-- Name: friendly_websites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friendly_websites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    icon_url text,
    description text,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    open_in_new_tab boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: homepage_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homepage_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_key text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_enabled boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: mailboxes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mailboxes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    smtp_host text,
    smtp_port integer DEFAULT 587,
    smtp_user text,
    smtp_password text,
    smtp_from text,
    imap_host text,
    imap_port integer DEFAULT 993,
    imap_user text,
    imap_password text,
    receiving_email text,
    hourly_limit integer DEFAULT 100,
    daily_limit integer DEFAULT 1000,
    emails_sent_this_hour integer DEFAULT 0,
    emails_sent_today integer DEFAULT 0,
    last_hour_reset timestamp with time zone DEFAULT now(),
    last_day_reset timestamp with time zone DEFAULT now(),
    auto_delete_after_store boolean DEFAULT true,
    storage_used_bytes bigint DEFAULT 0,
    storage_limit_bytes bigint DEFAULT '10737418240'::bigint,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 1,
    last_error text,
    last_error_at timestamp with time zone,
    last_polled_at timestamp with time zone,
    last_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    smtp_password_encrypted text,
    imap_password_encrypted text,
    is_primary boolean DEFAULT false
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    temp_email_id uuid,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth_key text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    action_type text NOT NULL,
    window_start timestamp with time zone DEFAULT now() NOT NULL,
    request_count integer DEFAULT 1 NOT NULL
);

ALTER TABLE ONLY public.rate_limits REPLICA IDENTITY FULL;


--
-- Name: received_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.received_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    temp_email_id uuid NOT NULL,
    from_address text NOT NULL,
    subject text,
    body text,
    html_body text,
    is_read boolean DEFAULT false NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    is_encrypted boolean DEFAULT false,
    encryption_key_id text
);

ALTER TABLE ONLY public.received_emails REPLICA IDENTITY FULL;


--
-- Name: saved_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    received_email_id uuid NOT NULL,
    saved_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: scheduled_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_maintenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    scheduled_start timestamp with time zone NOT NULL,
    scheduled_end timestamp with time zone,
    affected_services jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'scheduled'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT scheduled_maintenance_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: subscription_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    price_monthly numeric(10,2) DEFAULT 0 NOT NULL,
    price_yearly numeric(10,2) DEFAULT 0 NOT NULL,
    max_temp_emails integer DEFAULT 3 NOT NULL,
    email_expiry_hours integer DEFAULT 1 NOT NULL,
    can_forward_emails boolean DEFAULT false NOT NULL,
    can_use_custom_domains boolean DEFAULT false NOT NULL,
    can_use_api boolean DEFAULT false NOT NULL,
    priority_support boolean DEFAULT false NOT NULL,
    ai_summaries_per_day integer DEFAULT 5 NOT NULL,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: temp_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temp_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    address text NOT NULL,
    domain_id uuid NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '02:00:00'::interval) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    secret_token text DEFAULT public.generate_secret_token() NOT NULL
);


--
-- Name: temp_emails_safe; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.temp_emails_safe WITH (security_invoker='true') AS
 SELECT id,
    address,
    domain_id,
    user_id,
    is_active,
    created_at,
    expires_at
   FROM public.temp_emails;


--
-- Name: uptime_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uptime_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service text NOT NULL,
    status text DEFAULT 'operational'::text NOT NULL,
    response_time_ms integer,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT uptime_records_status_check CHECK ((status = ANY (ARRAY['operational'::text, 'degraded'::text, 'partial_outage'::text, 'major_outage'::text])))
);


--
-- Name: user_2fa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_2fa (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    totp_secret text NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    backup_codes text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    totp_secret_encrypted text,
    backup_codes_encrypted text
);


--
-- Name: user_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    stripe_invoice_id text,
    stripe_payment_intent_id text,
    amount_paid numeric DEFAULT 0 NOT NULL,
    currency text DEFAULT 'usd'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    description text,
    invoice_url text,
    invoice_pdf text,
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    paypal_order_id text,
    payment_provider text DEFAULT 'stripe'::text
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tier_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    current_period_start timestamp with time zone DEFAULT now() NOT NULL,
    current_period_end timestamp with time zone DEFAULT (now() + '1 mon'::interval) NOT NULL,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    paypal_subscription_id text,
    payment_provider text DEFAULT 'stripe'::text,
    CONSTRAINT user_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text, 'expired'::text, 'past_due'::text])))
);


--
-- Name: user_suspensions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_suspensions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    suspended_by uuid NOT NULL,
    suspended_at timestamp with time zone DEFAULT now() NOT NULL,
    suspended_until timestamp with time zone,
    reason text,
    is_active boolean DEFAULT true NOT NULL,
    lifted_at timestamp with time zone,
    lifted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    temp_emails_created integer DEFAULT 0 NOT NULL,
    ai_summaries_used integer DEFAULT 0 NOT NULL,
    emails_received integer DEFAULT 0 NOT NULL,
    emails_forwarded integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_audit_logs admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: admin_role_requests admin_role_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_role_requests
    ADD CONSTRAINT admin_role_requests_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_key_key UNIQUE (key);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: backup_history backup_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_history
    ADD CONSTRAINT backup_history_pkey PRIMARY KEY (id);


--
-- Name: banners banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banners
    ADD CONSTRAINT banners_pkey PRIMARY KEY (id);


--
-- Name: blocked_countries blocked_countries_country_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_countries
    ADD CONSTRAINT blocked_countries_country_code_key UNIQUE (country_code);


--
-- Name: blocked_countries blocked_countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_countries
    ADD CONSTRAINT blocked_countries_pkey PRIMARY KEY (id);


--
-- Name: blocked_emails blocked_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_emails
    ADD CONSTRAINT blocked_emails_pkey PRIMARY KEY (id);


--
-- Name: blocked_ips blocked_ips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_ips
    ADD CONSTRAINT blocked_ips_pkey PRIMARY KEY (id);


--
-- Name: blogs blogs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blogs
    ADD CONSTRAINT blogs_pkey PRIMARY KEY (id);


--
-- Name: blogs blogs_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blogs
    ADD CONSTRAINT blogs_slug_key UNIQUE (slug);


--
-- Name: domains domains_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_name_key UNIQUE (name);


--
-- Name: domains domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_pkey PRIMARY KEY (id);


--
-- Name: email_attachments email_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_attachments
    ADD CONSTRAINT email_attachments_pkey PRIMARY KEY (id);


--
-- Name: email_forwarding email_forwarding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_forwarding
    ADD CONSTRAINT email_forwarding_pkey PRIMARY KEY (id);


--
-- Name: email_forwarding email_forwarding_temp_email_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_forwarding
    ADD CONSTRAINT email_forwarding_temp_email_id_key UNIQUE (temp_email_id);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: email_restrictions email_restrictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_restrictions
    ADD CONSTRAINT email_restrictions_pkey PRIMARY KEY (id);


--
-- Name: email_stats email_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_stats
    ADD CONSTRAINT email_stats_pkey PRIMARY KEY (id);


--
-- Name: email_stats email_stats_stat_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_stats
    ADD CONSTRAINT email_stats_stat_key_key UNIQUE (stat_key);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: email_verifications email_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT email_verifications_pkey PRIMARY KEY (id);


--
-- Name: email_verifications email_verifications_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT email_verifications_token_key UNIQUE (token);


--
-- Name: friendly_websites friendly_websites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendly_websites
    ADD CONSTRAINT friendly_websites_pkey PRIMARY KEY (id);


--
-- Name: homepage_sections homepage_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_sections
    ADD CONSTRAINT homepage_sections_pkey PRIMARY KEY (id);


--
-- Name: homepage_sections homepage_sections_section_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_sections
    ADD CONSTRAINT homepage_sections_section_key_key UNIQUE (section_key);


--
-- Name: mailboxes mailboxes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailboxes
    ADD CONSTRAINT mailboxes_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_identifier_action_type_window_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_identifier_action_type_window_start_key UNIQUE (identifier, action_type, window_start);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (id);


--
-- Name: received_emails received_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.received_emails
    ADD CONSTRAINT received_emails_pkey PRIMARY KEY (id);


--
-- Name: saved_emails saved_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_emails
    ADD CONSTRAINT saved_emails_pkey PRIMARY KEY (id);


--
-- Name: saved_emails saved_emails_user_id_received_email_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_emails
    ADD CONSTRAINT saved_emails_user_id_received_email_id_key UNIQUE (user_id, received_email_id);


--
-- Name: scheduled_maintenance scheduled_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_maintenance
    ADD CONSTRAINT scheduled_maintenance_pkey PRIMARY KEY (id);


--
-- Name: subscription_tiers subscription_tiers_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_tiers
    ADD CONSTRAINT subscription_tiers_name_key UNIQUE (name);


--
-- Name: subscription_tiers subscription_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_tiers
    ADD CONSTRAINT subscription_tiers_pkey PRIMARY KEY (id);


--
-- Name: temp_emails temp_emails_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_emails
    ADD CONSTRAINT temp_emails_address_key UNIQUE (address);


--
-- Name: temp_emails temp_emails_address_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_emails
    ADD CONSTRAINT temp_emails_address_unique UNIQUE (address);


--
-- Name: temp_emails temp_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_emails
    ADD CONSTRAINT temp_emails_pkey PRIMARY KEY (id);


--
-- Name: uptime_records uptime_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uptime_records
    ADD CONSTRAINT uptime_records_pkey PRIMARY KEY (id);


--
-- Name: user_2fa user_2fa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_2fa
    ADD CONSTRAINT user_2fa_pkey PRIMARY KEY (id);


--
-- Name: user_2fa user_2fa_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_2fa
    ADD CONSTRAINT user_2fa_user_id_key UNIQUE (user_id);


--
-- Name: user_invoices user_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_invoices
    ADD CONSTRAINT user_invoices_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: user_subscriptions user_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: user_subscriptions user_subscriptions_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);


--
-- Name: user_suspensions user_suspensions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_suspensions
    ADD CONSTRAINT user_suspensions_pkey PRIMARY KEY (id);


--
-- Name: user_suspensions user_suspensions_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_suspensions
    ADD CONSTRAINT user_suspensions_user_id_key UNIQUE (user_id);


--
-- Name: user_usage user_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_usage
    ADD CONSTRAINT user_usage_pkey PRIMARY KEY (id);


--
-- Name: user_usage user_usage_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_usage
    ADD CONSTRAINT user_usage_user_id_date_key UNIQUE (user_id, date);


--
-- Name: blocked_emails_pattern_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX blocked_emails_pattern_unique ON public.blocked_emails USING btree (email_pattern) WHERE (is_active = true);


--
-- Name: idx_admin_role_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_role_requests_status ON public.admin_role_requests USING btree (status);


--
-- Name: idx_admin_role_requests_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_role_requests_user_id ON public.admin_role_requests USING btree (user_id);


--
-- Name: idx_blocked_ips_address; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_blocked_ips_address ON public.blocked_ips USING btree (ip_address) WHERE (is_active = true);


--
-- Name: idx_email_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_created_at ON public.email_logs USING btree (created_at DESC);


--
-- Name: idx_email_logs_mailbox_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_mailbox_id ON public.email_logs USING btree (mailbox_id);


--
-- Name: idx_email_logs_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_recipient ON public.email_logs USING btree (recipient_email);


--
-- Name: idx_email_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_logs_status ON public.email_logs USING btree (status);


--
-- Name: idx_mailboxes_active_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mailboxes_active_priority ON public.mailboxes USING btree (is_active, priority) WHERE (is_active = true);


--
-- Name: idx_mailboxes_is_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mailboxes_is_primary ON public.mailboxes USING btree (is_primary) WHERE (is_primary = true);


--
-- Name: idx_rate_limits_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_lookup ON public.rate_limits USING btree (identifier, action_type, window_start);


--
-- Name: idx_rate_limits_window_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_window_start ON public.rate_limits USING btree (window_start);


--
-- Name: idx_received_emails_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_received_emails_dedup ON public.received_emails USING btree (temp_email_id, from_address, received_at);


--
-- Name: idx_scheduled_maintenance_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_maintenance_start ON public.scheduled_maintenance USING btree (scheduled_start);


--
-- Name: idx_scheduled_maintenance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_maintenance_status ON public.scheduled_maintenance USING btree (status);


--
-- Name: idx_temp_emails_active_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_emails_active_address ON public.temp_emails USING btree (address) WHERE (is_active = true);


--
-- Name: idx_temp_emails_secret_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temp_emails_secret_token ON public.temp_emails USING btree (secret_token);


--
-- Name: idx_uptime_records_checked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uptime_records_checked ON public.uptime_records USING btree (checked_at);


--
-- Name: idx_uptime_records_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uptime_records_service ON public.uptime_records USING btree (service);


--
-- Name: received_emails_unique_message; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX received_emails_unique_message ON public.received_emails USING btree (temp_email_id, from_address, subject, received_at);


--
-- Name: mailboxes audit_mailboxes_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_mailboxes_changes AFTER DELETE OR UPDATE ON public.mailboxes FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_access();


--
-- Name: temp_emails check_email_restrictions_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER check_email_restrictions_trigger BEFORE INSERT ON public.temp_emails FOR EACH ROW EXECUTE FUNCTION public.validate_temp_email_restrictions();


--
-- Name: temp_emails enforce_temp_email_rate_limit_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_temp_email_rate_limit_trigger BEFORE INSERT ON public.temp_emails FOR EACH ROW EXECUTE FUNCTION public.enforce_temp_email_rate_limit();


--
-- Name: temp_emails increment_total_emails_generated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER increment_total_emails_generated AFTER INSERT ON public.temp_emails FOR EACH ROW EXECUTE FUNCTION public.increment_email_stats();


--
-- Name: admin_role_requests update_admin_role_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_admin_role_requests_updated_at BEFORE UPDATE ON public.admin_role_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: banners update_banners_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: blogs update_blogs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_blogs_updated_at BEFORE UPDATE ON public.blogs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: email_forwarding update_email_forwarding_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_email_forwarding_updated_at BEFORE UPDATE ON public.email_forwarding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: email_templates update_email_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_email_templates_updated_at();


--
-- Name: friendly_websites update_friendly_websites_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_friendly_websites_updated_at BEFORE UPDATE ON public.friendly_websites FOR EACH ROW EXECUTE FUNCTION public.update_friendly_websites_updated_at();


--
-- Name: homepage_sections update_homepage_sections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_homepage_sections_updated_at BEFORE UPDATE ON public.homepage_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscription_tiers update_subscription_tiers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscription_tiers_updated_at BEFORE UPDATE ON public.subscription_tiers FOR EACH ROW EXECUTE FUNCTION public.update_subscription_updated_at();


--
-- Name: user_2fa update_user_2fa_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_2fa_updated_at BEFORE UPDATE ON public.user_2fa FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_subscriptions update_user_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_subscription_updated_at();


--
-- Name: user_usage update_user_usage_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_usage_updated_at BEFORE UPDATE ON public.user_usage FOR EACH ROW EXECUTE FUNCTION public.update_subscription_updated_at();


--
-- Name: email_attachments email_attachments_received_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_attachments
    ADD CONSTRAINT email_attachments_received_email_id_fkey FOREIGN KEY (received_email_id) REFERENCES public.received_emails(id) ON DELETE CASCADE;


--
-- Name: email_forwarding email_forwarding_temp_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_forwarding
    ADD CONSTRAINT email_forwarding_temp_email_id_fkey FOREIGN KEY (temp_email_id) REFERENCES public.temp_emails(id) ON DELETE CASCADE;


--
-- Name: email_logs email_logs_mailbox_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_mailbox_id_fkey FOREIGN KEY (mailbox_id) REFERENCES public.mailboxes(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_temp_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_temp_email_id_fkey FOREIGN KEY (temp_email_id) REFERENCES public.temp_emails(id) ON DELETE CASCADE;


--
-- Name: received_emails received_emails_temp_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.received_emails
    ADD CONSTRAINT received_emails_temp_email_id_fkey FOREIGN KEY (temp_email_id) REFERENCES public.temp_emails(id) ON DELETE CASCADE;


--
-- Name: saved_emails saved_emails_received_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_emails
    ADD CONSTRAINT saved_emails_received_email_id_fkey FOREIGN KEY (received_email_id) REFERENCES public.received_emails(id) ON DELETE CASCADE;


--
-- Name: saved_emails saved_emails_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_emails
    ADD CONSTRAINT saved_emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: scheduled_maintenance scheduled_maintenance_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_maintenance
    ADD CONSTRAINT scheduled_maintenance_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: temp_emails temp_emails_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_emails
    ADD CONSTRAINT temp_emails_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.domains(id) ON DELETE CASCADE;


--
-- Name: temp_emails temp_emails_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temp_emails
    ADD CONSTRAINT temp_emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_subscriptions user_subscriptions_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.subscription_tiers(id);


--
-- Name: user_subscriptions user_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_usage user_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_usage
    ADD CONSTRAINT user_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: blocked_countries Admins can delete blocked countries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete blocked countries" ON public.blocked_countries FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: admin_audit_logs Admins can insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert audit logs" ON public.admin_audit_logs FOR INSERT WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: blocked_countries Admins can insert blocked countries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert blocked countries" ON public.blocked_countries FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: admin_role_requests Admins can manage all role requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all role requests" ON public.admin_role_requests USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_subscriptions Admins can manage all subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all subscriptions" ON public.user_subscriptions USING (public.is_admin(auth.uid()));


--
-- Name: backup_history Admins can manage backup history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage backup history" ON public.backup_history USING (public.is_admin(auth.uid()));


--
-- Name: banners Admins can manage banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage banners" ON public.banners USING (public.is_admin(auth.uid()));


--
-- Name: blocked_ips Admins can manage blocked IPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage blocked IPs" ON public.blocked_ips USING (public.is_admin(auth.uid()));


--
-- Name: blogs Admins can manage blogs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage blogs" ON public.blogs USING (public.is_admin(auth.uid()));


--
-- Name: domains Admins can manage domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage domains" ON public.domains USING (public.is_admin(auth.uid()));


--
-- Name: email_restrictions Admins can manage email restrictions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage email restrictions" ON public.email_restrictions USING (public.is_admin(auth.uid()));


--
-- Name: email_templates Admins can manage email templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage email templates" ON public.email_templates TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: friendly_websites Admins can manage friendly websites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage friendly websites" ON public.friendly_websites USING (public.is_admin(auth.uid()));


--
-- Name: homepage_sections Admins can manage homepage sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage homepage sections" ON public.homepage_sections USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: mailboxes Admins can manage mailboxes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage mailboxes" ON public.mailboxes USING (public.is_admin(auth.uid()));


--
-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage roles" ON public.user_roles USING (public.is_admin(auth.uid()));


--
-- Name: scheduled_maintenance Admins can manage scheduled maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage scheduled maintenance" ON public.scheduled_maintenance USING (public.is_admin(auth.uid()));


--
-- Name: user_suspensions Admins can manage suspensions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage suspensions" ON public.user_suspensions USING (public.is_admin(auth.uid()));


--
-- Name: subscription_tiers Admins can manage tiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage tiers" ON public.subscription_tiers USING (public.is_admin(auth.uid()));


--
-- Name: blocked_countries Admins can update blocked countries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update blocked countries" ON public.blocked_countries FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: user_invoices Admins can view all invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all invoices" ON public.user_invoices FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: received_emails Admins can view all received emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all received emails" ON public.received_emails FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: temp_emails Admins can view all temp emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all temp emails" ON public.temp_emails FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: user_usage Admins can view all usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all usage" ON public.user_usage FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: admin_audit_logs Admins can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: blocked_countries Admins can view blocked countries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view blocked countries" ON public.blocked_countries FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: email_logs Admins can view email logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view email logs" ON public.email_logs FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: app_settings Admins have full access to settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins have full access to settings" ON public.app_settings TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: admin_audit_logs Anon cannot delete audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anon cannot delete audit logs" ON public.admin_audit_logs FOR DELETE TO anon USING (false);


--
-- Name: admin_audit_logs Anon cannot update audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anon cannot update audit logs" ON public.admin_audit_logs FOR UPDATE TO anon USING (false) WITH CHECK (false);


--
-- Name: push_subscriptions Anonymous can delete own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous can delete own push subscriptions" ON public.push_subscriptions FOR DELETE TO anon USING (((user_id IS NULL) AND (temp_email_id IS NOT NULL)));


--
-- Name: push_subscriptions Anonymous can insert push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous can insert push subscriptions" ON public.push_subscriptions FOR INSERT TO anon WITH CHECK (((user_id IS NULL) AND (temp_email_id IS NOT NULL)));


--
-- Name: push_subscriptions Anonymous can manage own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous can manage own push subscriptions" ON public.push_subscriptions FOR SELECT TO anon USING (((user_id IS NULL) AND (temp_email_id IS NOT NULL)));


--
-- Name: push_subscriptions Anonymous can update own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous can update own push subscriptions" ON public.push_subscriptions FOR UPDATE TO anon USING (((user_id IS NULL) AND (temp_email_id IS NOT NULL))) WITH CHECK (((user_id IS NULL) AND (temp_email_id IS NOT NULL)));


--
-- Name: temp_emails Anonymous users can create guest temp emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous users can create guest temp emails" ON public.temp_emails FOR INSERT TO anon WITH CHECK ((user_id IS NULL));


--
-- Name: temp_emails Anonymous users can delete guest temp emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous users can delete guest temp emails" ON public.temp_emails FOR DELETE TO anon USING (((user_id IS NULL) AND public.validate_email_access_from_headers(id)));


--
-- Name: temp_emails Anonymous users can update guest temp emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anonymous users can update guest temp emails" ON public.temp_emails FOR UPDATE TO anon USING (((user_id IS NULL) AND public.validate_email_access_from_headers(id))) WITH CHECK ((user_id IS NULL));


--
-- Name: blocked_ips Anyone can check blocked IPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can check blocked IPs" ON public.blocked_ips FOR SELECT USING ((is_active = true));


--
-- Name: app_settings Anyone can read public app settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read public app settings" ON public.app_settings FOR SELECT USING ((key = ANY (ARRAY['payment_settings'::text, 'general_settings'::text, 'appearance_settings'::text, 'limit_modal_config'::text, 'announcement_settings'::text, 'captcha_settings'::text, 'seo_settings'::text, 'registration_settings'::text, 'blog_settings'::text, 'language_settings'::text, 'homepage_sections'::text])));


--
-- Name: blogs Anyone can read published blogs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read published blogs" ON public.blogs FOR SELECT USING ((published = true));


--
-- Name: banners Anyone can view active banners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active banners" ON public.banners FOR SELECT USING (((is_active = true) AND ((start_date IS NULL) OR (start_date <= now())) AND ((end_date IS NULL) OR (end_date >= now()))));


--
-- Name: domains Anyone can view active domains; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active domains" ON public.domains FOR SELECT USING ((is_active = true));


--
-- Name: friendly_websites Anyone can view active friendly websites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active friendly websites" ON public.friendly_websites FOR SELECT USING ((is_active = true));


--
-- Name: subscription_tiers Anyone can view active tiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active tiers" ON public.subscription_tiers FOR SELECT USING ((is_active = true));


--
-- Name: email_stats Anyone can view email stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view email stats" ON public.email_stats FOR SELECT USING (true);


--
-- Name: homepage_sections Anyone can view homepage sections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view homepage sections" ON public.homepage_sections FOR SELECT USING (true);


--
-- Name: scheduled_maintenance Anyone can view scheduled maintenance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view scheduled maintenance" ON public.scheduled_maintenance FOR SELECT USING (true);


--
-- Name: uptime_records Anyone can view uptime records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view uptime records" ON public.uptime_records FOR SELECT USING (true);


--
-- Name: admin_audit_logs Audit logs cannot be deleted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Audit logs cannot be deleted" ON public.admin_audit_logs FOR DELETE TO authenticated USING (false);


--
-- Name: admin_audit_logs Audit logs cannot be updated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Audit logs cannot be updated" ON public.admin_audit_logs FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: email_forwarding Authenticated users can create own forwarding rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create own forwarding rules" ON public.email_forwarding FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: temp_emails Authenticated users can create temp emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create temp emails" ON public.temp_emails FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) OR (user_id IS NULL)));


--
-- Name: email_forwarding Authenticated users can delete own forwarding rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete own forwarding rules" ON public.email_forwarding FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: email_templates Authenticated users can read email templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read email templates" ON public.email_templates FOR SELECT TO authenticated USING (true);


--
-- Name: email_forwarding Authenticated users can update own forwarding rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update own forwarding rules" ON public.email_forwarding FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: received_emails Authenticated users can update read status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update read status" ON public.received_emails FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.temp_emails
  WHERE ((temp_emails.id = received_emails.temp_email_id) AND (temp_emails.user_id = auth.uid())))));


--
-- Name: received_emails Authenticated users can view emails for their temp addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view emails for their temp addresses" ON public.received_emails FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.temp_emails
  WHERE ((temp_emails.id = received_emails.temp_email_id) AND (temp_emails.user_id = auth.uid())))));


--
-- Name: email_forwarding Authenticated users can view own forwarding rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view own forwarding rules" ON public.email_forwarding FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: temp_emails Authenticated users can view own temp emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view own temp emails" ON public.temp_emails FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: push_subscriptions Authenticated users manage own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users manage own push subscriptions" ON public.push_subscriptions TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: rate_limits Deny anon access to rate_limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny anon access to rate_limits" ON public.rate_limits TO anon USING (false) WITH CHECK (false);


--
-- Name: email_forwarding Deny anonymous access to email_forwarding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny anonymous access to email_forwarding" ON public.email_forwarding TO anon USING (false) WITH CHECK (false);


--
-- Name: saved_emails Deny anonymous access to saved_emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny anonymous access to saved_emails" ON public.saved_emails TO anon USING (false) WITH CHECK (false);


--
-- Name: user_2fa Deny anonymous access to user_2fa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny anonymous access to user_2fa" ON public.user_2fa AS RESTRICTIVE TO anon USING (false);


--
-- Name: user_invoices Deny anonymous access to user_invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny anonymous access to user_invoices" ON public.user_invoices AS RESTRICTIVE TO anon USING (false);


--
-- Name: user_roles Deny anonymous access to user_roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny anonymous access to user_roles" ON public.user_roles FOR SELECT TO anon USING (false);


--
-- Name: rate_limits Deny authenticated access to rate_limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny authenticated access to rate_limits" ON public.rate_limits TO authenticated USING (false) WITH CHECK (false);


--
-- Name: mailboxes Deny non-admin access to mailboxes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny non-admin access to mailboxes" ON public.mailboxes USING (public.is_admin(auth.uid()));


--
-- Name: temp_emails Guest access via token header; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guest access via token header" ON public.temp_emails FOR SELECT USING (((user_id IS NULL) AND (is_active = true) AND (expires_at > now()) AND public.validate_email_access_from_headers(id)));


--
-- Name: blocked_emails Only admins can delete blocked emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can delete blocked emails" ON public.blocked_emails FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: blocked_emails Only admins can insert blocked emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can insert blocked emails" ON public.blocked_emails FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: blocked_emails Only admins can read blocked emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can read blocked emails" ON public.blocked_emails FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: email_restrictions Only admins can read email restrictions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can read email restrictions" ON public.email_restrictions FOR SELECT USING (public.is_admin(auth.uid()));


--
-- Name: blocked_emails Only admins can update blocked emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can update blocked emails" ON public.blocked_emails FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: user_invoices Only admins can update invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can update invoices" ON public.user_invoices FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


--
-- Name: admin_audit_logs Only admins can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can view audit logs" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));


--
-- Name: email_attachments Only service role can insert attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only service role can insert attachments" ON public.email_attachments FOR INSERT WITH CHECK ((( SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text));


--
-- Name: user_invoices Only service role can insert invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only service role can insert invoices" ON public.user_invoices FOR INSERT WITH CHECK ((( SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text));


--
-- Name: received_emails Only service role can insert received emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only service role can insert received emails" ON public.received_emails FOR INSERT WITH CHECK ((( SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text));


--
-- Name: email_stats Only service role can modify stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only service role can modify stats" ON public.email_stats USING ((( SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text));


--
-- Name: temp_emails Owners and token holders can access temp emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and token holders can access temp emails" ON public.temp_emails FOR SELECT USING ((public.is_admin(auth.uid()) OR ((auth.uid() IS NOT NULL) AND (user_id = auth.uid())) OR ((auth.uid() IS NULL) AND (user_id IS NULL) AND public.validate_email_access_from_headers(id))));


--
-- Name: app_settings Public can read public settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read public settings" ON public.app_settings FOR SELECT USING ((key = ANY (ARRAY['seo'::text, 'general'::text, 'appearance'::text, 'pricing_content'::text, 'friendly_sites_widget'::text, 'blog_settings'::text, 'announcement'::text, 'seo_settings'::text, 'general_settings'::text, 'appearance_settings'::text])));


--
-- Name: email_logs Service role can manage email logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage email logs" ON public.email_logs USING ((auth.role() = 'service_role'::text));


--
-- Name: uptime_records Service role can manage uptime records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage uptime records" ON public.uptime_records USING ((( SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text));


--
-- Name: received_emails Token-validated access to received emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Token-validated access to received emails" ON public.received_emails FOR SELECT USING (public.validate_email_access_from_headers(temp_email_id));


--
-- Name: admin_role_requests Users can create own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own requests" ON public.admin_role_requests FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (status = 'pending'::text)));


--
-- Name: user_2fa Users can delete own 2FA settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own 2FA settings" ON public.user_2fa FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: temp_emails Users can delete own temp emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own temp emails" ON public.temp_emails FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: user_2fa Users can insert own 2FA settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own 2FA settings" ON public.user_2fa FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_subscriptions Users can insert own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own subscription" ON public.user_subscriptions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_usage Users can insert own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own usage" ON public.user_usage FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: email_verifications Users can insert own verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own verifications" ON public.email_verifications FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: saved_emails Users can manage their saved emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their saved emails" ON public.saved_emails USING ((auth.uid() = user_id));


--
-- Name: user_2fa Users can update own 2FA settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own 2FA settings" ON public.user_2fa FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_subscriptions Users can update own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own subscription" ON public.user_subscriptions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: temp_emails Users can update own temp emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own temp emails" ON public.temp_emails FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: user_usage Users can update own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own usage" ON public.user_usage FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: email_verifications Users can update own verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own verifications" ON public.email_verifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: email_attachments Users can view attachments for their emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view attachments for their emails" ON public.email_attachments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.received_emails re
     JOIN public.temp_emails te ON ((te.id = re.temp_email_id)))
  WHERE ((re.id = email_attachments.received_email_id) AND ((te.user_id IS NULL) OR (te.user_id = auth.uid()))))));


--
-- Name: user_2fa Users can view own 2FA settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own 2FA settings" ON public.user_2fa FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_invoices Users can view own invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own invoices" ON public.user_invoices FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: admin_role_requests Users can view own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own requests" ON public.admin_role_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_subscriptions Users can view own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own subscription" ON public.user_subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_suspensions Users can view own suspension; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own suspension" ON public.user_suspensions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_usage Users can view own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own usage" ON public.user_usage FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: email_verifications Users can view own verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own verifications" ON public.email_verifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: temp_emails Users can view their own temp emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own temp emails" ON public.temp_emails FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: admin_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_role_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_role_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

--
-- Name: banners; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

--
-- Name: blocked_countries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocked_countries ENABLE ROW LEVEL SECURITY;

--
-- Name: blocked_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocked_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: blocked_ips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

--
-- Name: blogs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

--
-- Name: domains; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

--
-- Name: email_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: email_forwarding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_forwarding ENABLE ROW LEVEL SECURITY;

--
-- Name: email_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: email_restrictions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_restrictions ENABLE ROW LEVEL SECURITY;

--
-- Name: email_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: email_verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: friendly_websites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.friendly_websites ENABLE ROW LEVEL SECURITY;

--
-- Name: homepage_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: mailboxes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mailboxes ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: received_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.received_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_maintenance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_maintenance ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: temp_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.temp_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: uptime_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.uptime_records ENABLE ROW LEVEL SECURITY;

--
-- Name: user_2fa; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_2fa ENABLE ROW LEVEL SECURITY;

--
-- Name: user_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_suspensions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;