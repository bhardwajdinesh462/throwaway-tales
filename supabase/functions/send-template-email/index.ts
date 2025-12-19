import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendTemplateEmailRequest {
  templateId?: string;
  templateType?: string;
  recipientEmail: string;
  recipientName?: string;
  customVariables?: Record<string, string>;
}

interface MailboxConfig {
  mailbox_id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
}

// Helper to format date
const formatDate = (): string => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
};

// Helper to parse user agent
const parseUserAgent = (ua: string): string => {
  if (!ua) return 'Unknown Browser';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Opera')) return 'Opera';
  return 'Unknown Browser';
};

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get all available mailboxes for failover
async function getAllMailboxes(supabase: any): Promise<MailboxConfig[]> {
  const { data, error } = await supabase
    .from('mailboxes')
    .select('id, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, last_error, last_error_at')
    .eq('is_active', true)
    .not('smtp_host', 'is', null)
    .order('priority', { ascending: true });

  if (error || !data) {
    console.log('[send-template-email] No mailboxes found:', error?.message);
    return [];
  }

  // Filter out mailboxes with recent errors (within 30 minutes)
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  return data
    .filter((mb: any) => {
      if (!mb.last_error_at) return true;
      return mb.last_error_at < thirtyMinutesAgo;
    })
    .map((mb: any) => ({
      mailbox_id: mb.id,
      smtp_host: mb.smtp_host,
      smtp_port: mb.smtp_port,
      smtp_user: mb.smtp_user,
      smtp_password: mb.smtp_password,
      smtp_from: mb.smtp_from || mb.smtp_user,
    }));
}

// Mark a mailbox as unhealthy
async function markMailboxUnhealthy(supabase: any, mailboxId: string, errorMessage: string) {
  console.log(`[send-template-email] Marking mailbox ${mailboxId} as unhealthy: ${errorMessage}`);
  await supabase.rpc('record_mailbox_error', { 
    p_mailbox_id: mailboxId, 
    p_error: errorMessage 
  });
}

// Log email attempt
async function logEmailAttempt(supabase: any, params: {
  mailboxId: string | null;
  mailboxName: string | null;
  recipientEmail: string;
  subject: string;
  status: 'sent' | 'failed' | 'bounced';
  configSource: string;
  smtpHost?: string;
  errorMessage?: string;
  errorCode?: string;
  attemptCount?: number;
}) {
  try {
    await supabase.rpc('log_email_attempt', {
      p_mailbox_id: params.mailboxId,
      p_mailbox_name: params.mailboxName,
      p_recipient_email: params.recipientEmail,
      p_subject: params.subject,
      p_status: params.status,
      p_config_source: params.configSource,
      p_smtp_host: params.smtpHost,
      p_error_message: params.errorMessage,
      p_error_code: params.errorCode,
      p_attempt_count: params.attemptCount || 1,
    });
  } catch (err) {
    console.error('[send-template-email] Failed to log email attempt:', err);
  }
}

// Check if error is permanent (don't retry with same mailbox)
function isPermanentError(errorMessage: string): boolean {
  const permanentErrors = ['535', '550', '551', '552', '553', '554', 'Authentication', 'auth failed', 'suspicious', 'blocked', 'blacklisted'];
  return permanentErrors.some(e => errorMessage.includes(e));
}

// Try to send email with a specific mailbox config
async function trySendEmail(
  config: { host: string; port: number; username: string; password: string; fromAddress: string },
  emailData: { to: string; subject: string; html: string; siteName: string }
): Promise<{ success: boolean; error?: string }> {
  const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

  const client = new SMTPClient({
    connection: {
      hostname: config.host,
      port: config.port,
      tls: config.port === 465,
      auth: {
        username: config.username,
        password: config.password,
      },
    },
  });

  try {
    await client.send({
      from: `${emailData.siteName} <${config.fromAddress}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
    });

    await client.close();
    return { success: true };
  } catch (error: any) {
    try { await client.close(); } catch { /* ignore */ }
    return { success: false, error: error.message };
  }
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { templateId, templateType, recipientEmail, recipientName, customVariables }: SendTemplateEmailRequest = await req.json();
    
    // Get request metadata for template variables
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-real-ip') || 
                     'Unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const browser = parseUserAgent(userAgent);
    const currentDate = formatDate();

    console.log(`[send-template-email] Request: templateId=${templateId}, templateType=${templateType}, to=${recipientEmail}`);

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Recipient email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!templateId && !templateType) {
      return new Response(
        JSON.stringify({ success: false, error: "Either templateId or templateType is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the template
    let templateQuery = supabase.from('email_templates').select('*');
    if (templateId) {
      templateQuery = templateQuery.eq('id', templateId);
    } else if (templateType) {
      templateQuery = templateQuery.eq('type', templateType);
    }

    const { data: templates, error: templateError } = await templateQuery.limit(1);

    if (templateError) {
      console.error('[send-template-email] Template fetch error:', templateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch template" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Template not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const template = templates[0];

    // Fetch general settings for site name
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'general_settings')
      .single();

    const siteName = settingsData?.value?.siteName || 'Nullsto Temp Mail';
    const siteUrl = settingsData?.value?.siteUrl || 'https://nullsto.edu.pl';

    // Replace template variables
    const replaceVariables = (text: string): string => {
      let result = text
        .replace(/\{\{site_name\}\}/g, siteName)
        .replace(/\{\{site_url\}\}/g, siteUrl)
        .replace(/\{\{name\}\}/g, recipientName || 'User')
        .replace(/\{\{email\}\}/g, recipientEmail)
        .replace(/\{\{link\}\}/g, siteUrl)
        .replace(/\{\{reset_link\}\}/g, `${siteUrl}/auth?mode=reset`)
        .replace(/\{\{verify_link\}\}/g, `${siteUrl}/verify-email`)
        .replace(/\{\{date\}\}/g, currentDate)
        .replace(/\{\{ip_address\}\}/g, clientIp)
        .replace(/\{\{browser\}\}/g, browser);

      // Replace any custom variables
      if (customVariables) {
        for (const [key, value] of Object.entries(customVariables)) {
          result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }
      }

      return result;
    };

    const subject = replaceVariables(template.subject);
    const body = replaceVariables(template.body);

    // Convert plain text body to HTML if it doesn't contain HTML tags
    const isHtml = /<[^>]+>/g.test(body);
    const htmlBody = isHtml ? body : `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 12px; }
            a { color: #0d9488; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0;">${siteName}</h1>
          </div>
          <div class="content">
            ${body.split('\n').map(line => `<p>${line}</p>`).join('')}
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    // Get all available mailboxes for failover
    const mailboxes = await getAllMailboxes(supabase);
    console.log(`[send-template-email] Found ${mailboxes.length} available mailboxes`);

    // Check for env fallback
    const envHost = Deno.env.get("SMTP_HOST");
    const envPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const envUser = Deno.env.get("SMTP_USER");
    const envPass = Deno.env.get("SMTP_PASSWORD");
    const envFrom = Deno.env.get("SMTP_FROM") || envUser;
    const hasEnvFallback = envHost && envUser && envPass;

    if (mailboxes.length === 0 && !hasEnvFallback) {
      console.error('[send-template-email] No SMTP configuration available');
      return new Response(
        JSON.stringify({ success: false, error: "SMTP configuration incomplete. Please configure a mailbox in Admin > Mailboxes." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try each mailbox with failover
    let lastError: string | null = null;
    let attemptCount = 0;

    for (const mailbox of mailboxes) {
      attemptCount++;
      console.log(`[send-template-email] Attempt ${attemptCount}: Trying mailbox ${mailbox.smtp_from} via ${mailbox.smtp_host}`);

      const result = await trySendEmail(
        {
          host: mailbox.smtp_host,
          port: mailbox.smtp_port,
          username: mailbox.smtp_user,
          password: String(mailbox.smtp_password),
          fromAddress: mailbox.smtp_from,
        },
        {
          to: recipientEmail,
          subject,
          html: htmlBody,
          siteName,
        }
      );

      if (result.success) {
        // Increment mailbox usage
        await supabase.rpc('increment_mailbox_usage', { p_mailbox_id: mailbox.mailbox_id });
        
        // Log success
        await logEmailAttempt(supabase, {
          mailboxId: mailbox.mailbox_id,
          mailboxName: mailbox.smtp_from,
          recipientEmail,
          subject,
          status: 'sent',
          configSource: 'database',
          smtpHost: mailbox.smtp_host,
          attemptCount,
        });

        console.log(`[send-template-email] Email sent successfully via ${mailbox.smtp_from}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Email sent successfully to ${recipientEmail}`,
            template: template.name,
            subject
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Failed - log and mark unhealthy if permanent error
      lastError = result.error || 'Unknown error';
      console.error(`[send-template-email] Mailbox ${mailbox.smtp_from} failed: ${lastError}`);

      if (isPermanentError(lastError)) {
        await markMailboxUnhealthy(supabase, mailbox.mailbox_id, lastError);
      }

      // Log failed attempt
      await logEmailAttempt(supabase, {
        mailboxId: mailbox.mailbox_id,
        mailboxName: mailbox.smtp_from,
        recipientEmail,
        subject,
        status: 'failed',
        configSource: 'database',
        smtpHost: mailbox.smtp_host,
        errorMessage: lastError,
        attemptCount,
      });

      // Small delay before next attempt
      await sleep(500);
    }

    // All database mailboxes failed - try env fallback
    if (hasEnvFallback) {
      attemptCount++;
      console.log(`[send-template-email] Attempt ${attemptCount}: Trying env fallback ${envHost}`);

      const result = await trySendEmail(
        {
          host: envHost!,
          port: envPort,
          username: envUser!,
          password: String(envPass),
          fromAddress: envFrom!,
        },
        {
          to: recipientEmail,
          subject,
          html: htmlBody,
          siteName,
        }
      );

      if (result.success) {
        await logEmailAttempt(supabase, {
          mailboxId: null,
          mailboxName: envFrom || null,
          recipientEmail,
          subject,
          status: 'sent',
          configSource: 'environment',
          smtpHost: envHost,
          attemptCount,
        });

        console.log(`[send-template-email] Email sent successfully via env fallback`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Email sent successfully to ${recipientEmail}`,
            template: template.name,
            subject
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      lastError = result.error || 'Unknown error';
      console.error(`[send-template-email] Env fallback failed: ${lastError}`);

      await logEmailAttempt(supabase, {
        mailboxId: null,
        mailboxName: envFrom || null,
        recipientEmail,
        subject,
        status: 'failed',
        configSource: 'environment',
        smtpHost: envHost,
        errorMessage: lastError,
        attemptCount,
      });
    }

    // All attempts failed
    throw new Error(`All ${attemptCount} SMTP attempts failed. Last error: ${lastError}`);

  } catch (error: any) {
    console.error("[send-template-email] Error:", error);
    
    let errorMessage = error.message || "Failed to send email";
    
    if (errorMessage.includes("Authentication") || errorMessage.includes("auth")) {
      errorMessage = "SMTP authentication failed. Check your credentials.";
    } else if (errorMessage.includes("Connection") || errorMessage.includes("connect")) {
      errorMessage = "Could not connect to SMTP server.";
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
