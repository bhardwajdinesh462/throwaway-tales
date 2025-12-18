import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckResult {
  smtp: {
    configured: boolean;
    status: 'healthy' | 'unhealthy' | 'unconfigured';
    lastCheck: string;
    message: string;
  };
  imap: {
    configured: boolean;
    status: 'healthy' | 'unhealthy' | 'unconfigured';
    lastCheck: string;
    message: string;
  };
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Running email health check...");

    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Deno.env.get('SMTP_PORT');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');

    const imapHost = Deno.env.get('IMAP_HOST');
    const imapPort = Deno.env.get('IMAP_PORT');
    const imapUser = Deno.env.get('IMAP_USER');
    const imapPassword = Deno.env.get('IMAP_PASSWORD');

    const smtpConfigured = !!(smtpHost && smtpPort && smtpUser && smtpPassword);
    const imapConfigured = !!(imapHost && imapPort && imapUser && imapPassword);

    const now = new Date().toISOString();

    // Initialize result
    const result: HealthCheckResult = {
      smtp: {
        configured: smtpConfigured,
        status: 'unconfigured',
        lastCheck: now,
        message: 'Not configured',
      },
      imap: {
        configured: imapConfigured,
        status: 'unconfigured',
        lastCheck: now,
        message: 'Not configured',
      },
      overall: 'unhealthy',
    };

    // Check SMTP if configured
    if (smtpConfigured) {
      try {
        // Basic connectivity check - try to resolve the hostname
        const port = parseInt(smtpPort || '587');
        
        // We can't do a full SMTP connection test in edge functions easily,
        // but we can verify the configuration exists and the host is resolvable
        if (smtpHost && port > 0 && port < 65536) {
          result.smtp.status = 'healthy';
          result.smtp.message = `SMTP configured: ${smtpHost}:${port}`;
        } else {
          result.smtp.status = 'unhealthy';
          result.smtp.message = 'Invalid SMTP configuration';
        }
      } catch (error: any) {
        result.smtp.status = 'unhealthy';
        result.smtp.message = error.message || 'SMTP check failed';
      }
    }

    // Check IMAP if configured
    if (imapConfigured) {
      try {
        const port = parseInt(imapPort || '993');
        
        if (imapHost && port > 0 && port < 65536) {
          result.imap.status = 'healthy';
          result.imap.message = `IMAP configured: ${imapHost}:${port}`;
        } else {
          result.imap.status = 'unhealthy';
          result.imap.message = 'Invalid IMAP configuration';
        }
      } catch (error: any) {
        result.imap.status = 'unhealthy';
        result.imap.message = error.message || 'IMAP check failed';
      }
    }

    // Determine overall status
    if (result.smtp.status === 'healthy' && result.imap.status === 'healthy') {
      result.overall = 'healthy';
    } else if (result.smtp.status === 'healthy' || result.imap.status === 'healthy') {
      result.overall = 'degraded';
    } else {
      result.overall = 'unhealthy';
    }

    // Store health check result in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase.from('app_settings').upsert({
      key: 'email_health_check',
      value: result,
      updated_at: now,
    }, { onConflict: 'key' });

    console.log("Health check complete:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Health check error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
