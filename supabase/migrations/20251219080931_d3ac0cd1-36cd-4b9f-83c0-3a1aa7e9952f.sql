-- Create table for blocked IP addresses
CREATE TABLE public.blocked_ips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  reason TEXT,
  blocked_by UUID NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on IP address for quick lookups
CREATE UNIQUE INDEX idx_blocked_ips_address ON public.blocked_ips(ip_address) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

-- Only admins can manage blocked IPs
CREATE POLICY "Admins can manage blocked IPs" 
ON public.blocked_ips 
FOR ALL 
USING (is_admin(auth.uid()));

-- Anyone can check if IP is blocked (for middleware)
CREATE POLICY "Anyone can check blocked IPs" 
ON public.blocked_ips 
FOR SELECT 
USING (is_active = true);

-- Function to check if an IP is blocked
CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip_address TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_ips
    WHERE ip_address = p_ip_address
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  )
$$;