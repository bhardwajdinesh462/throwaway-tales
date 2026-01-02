-- Create scheduled_maintenance table for maintenance windows
CREATE TABLE IF NOT EXISTS public.scheduled_maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
  scheduled_end TIMESTAMP WITH TIME ZONE,
  affected_services JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create uptime_records table for historical tracking
CREATE TABLE IF NOT EXISTS public.uptime_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'degraded', 'partial_outage', 'major_outage')),
  response_time_ms INTEGER,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_maintenance_status ON public.scheduled_maintenance(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_maintenance_start ON public.scheduled_maintenance(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_uptime_records_service ON public.uptime_records(service);
CREATE INDEX IF NOT EXISTS idx_uptime_records_checked ON public.uptime_records(checked_at);

-- Enable RLS
ALTER TABLE public.scheduled_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uptime_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheduled_maintenance
CREATE POLICY "Admins can manage scheduled maintenance"
  ON public.scheduled_maintenance
  FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Anyone can view scheduled maintenance"
  ON public.scheduled_maintenance
  FOR SELECT
  USING (true);

-- RLS Policies for uptime_records
CREATE POLICY "Service role can manage uptime records"
  ON public.uptime_records
  FOR ALL
  USING ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role');

CREATE POLICY "Anyone can view uptime records"
  ON public.uptime_records
  FOR SELECT
  USING (true);

-- Enable realtime for maintenance (for live status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_maintenance;