-- Create admin role requests table for approval workflow
CREATE TABLE public.admin_role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  requested_role text NOT NULL CHECK (requested_role IN ('admin', 'moderator')),
  existing_role text,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_role_requests ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage all requests
CREATE POLICY "Admins can manage all role requests"
ON public.admin_role_requests
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
ON public.admin_role_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create requests for themselves
CREATE POLICY "Users can create own requests"
ON public.admin_role_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Add trigger for updated_at
CREATE TRIGGER update_admin_role_requests_updated_at
BEFORE UPDATE ON public.admin_role_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for faster queries
CREATE INDEX idx_admin_role_requests_status ON public.admin_role_requests(status);
CREATE INDEX idx_admin_role_requests_user_id ON public.admin_role_requests(user_id);