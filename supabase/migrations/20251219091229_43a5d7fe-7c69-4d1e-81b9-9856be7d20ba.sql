-- Create user_suspensions table for tracking suspensions
CREATE TABLE public.user_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  suspended_by uuid NOT NULL,
  suspended_at timestamptz NOT NULL DEFAULT now(),
  suspended_until timestamptz, -- NULL means permanent
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  lifted_at timestamptz,
  lifted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;

-- Admins can manage suspensions
CREATE POLICY "Admins can manage suspensions"
ON public.user_suspensions FOR ALL
USING (is_admin(auth.uid()));

-- Users can view their own suspension status
CREATE POLICY "Users can view own suspension"
ON public.user_suspensions FOR SELECT
USING (auth.uid() = user_id);

-- Function to suspend a user
CREATE OR REPLACE FUNCTION public.suspend_user(
  target_user_id uuid,
  suspension_reason text DEFAULT NULL,
  suspend_until timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Function to lift a suspension
CREATE OR REPLACE FUNCTION public.unsuspend_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Function to check if a user is suspended
CREATE OR REPLACE FUNCTION public.is_user_suspended(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_suspensions
    WHERE user_id = check_user_id
    AND is_active = true
    AND (suspended_until IS NULL OR suspended_until > now())
  )
$$;

-- Function to get suspended users list
CREATE OR REPLACE FUNCTION public.get_suspended_users()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  email text,
  display_name text,
  suspended_at timestamptz,
  suspended_until timestamptz,
  reason text,
  suspended_by_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Function to bulk delete users
CREATE OR REPLACE FUNCTION public.bulk_delete_users(user_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Function to get admin audit logs
CREATE OR REPLACE FUNCTION public.get_admin_audit_logs(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_action_filter text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  admin_email text,
  admin_name text,
  action text,
  table_name text,
  record_id uuid,
  details jsonb,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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