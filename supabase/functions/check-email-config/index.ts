import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConfigStatus {
  name: string;
  configured: boolean;
}

interface ConfigCheckResponse {
  smtp: {
    configured: boolean;
    secrets: ConfigStatus[];
  };
  imap: {
    configured: boolean;
    secrets: ConfigStatus[];
  };
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Checking email configuration status...");

    // Check SMTP secrets
    const smtpSecrets: ConfigStatus[] = [
      { name: 'SMTP_HOST', configured: !!Deno.env.get('SMTP_HOST') },
      { name: 'SMTP_PORT', configured: !!Deno.env.get('SMTP_PORT') },
      { name: 'SMTP_USER', configured: !!Deno.env.get('SMTP_USER') },
      { name: 'SMTP_PASSWORD', configured: !!Deno.env.get('SMTP_PASSWORD') },
    ];

    // Check IMAP secrets
    const imapSecrets: ConfigStatus[] = [
      { name: 'IMAP_HOST', configured: !!Deno.env.get('IMAP_HOST') },
      { name: 'IMAP_PORT', configured: !!Deno.env.get('IMAP_PORT') },
      { name: 'IMAP_USER', configured: !!Deno.env.get('IMAP_USER') },
      { name: 'IMAP_PASSWORD', configured: !!Deno.env.get('IMAP_PASSWORD') },
    ];

    const smtpConfigured = smtpSecrets.every(s => s.configured);
    const imapConfigured = imapSecrets.every(s => s.configured);

    const response: ConfigCheckResponse = {
      smtp: {
        configured: smtpConfigured,
        secrets: smtpSecrets,
      },
      imap: {
        configured: imapConfigured,
        secrets: imapSecrets,
      },
    };

    console.log("Config status:", response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error checking config:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
