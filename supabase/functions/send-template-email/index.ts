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

// Get next available mailbox using RPC (handles encryption + limits + errors)
async function getNextMailbox(supabase: any): Promise<MailboxConfig | null> {
  const { data, error } = await supabase.rpc('select_available_mailbox');
  
  if (error) {
    console.log('[send-template-email] select_available_mailbox error:', error.message);
    return null;
  }
  
  if (!data || data.length === 0) {
    console.log('[send-template-email] No available mailboxes from RPC');
    return null;
  }
  
  const mb = data[0];
  return {
    mailbox_id: mb.mailbox_id,
    smtp_host: mb.smtp_host,
    smtp_port: mb.smtp_port || 587,
    smtp_user: mb.smtp_user,
    smtp_password: mb.smtp_password,
    smtp_from: mb.smtp_from || mb.smtp_user,
  };
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
      content: "auto",
      html: emailData.html,
      headers: {
        "MIME-Version": "1.0",
        "Content-Type": "text/html; charset=UTF-8",
      },
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

    // Fetch general settings for site name - check both keys
    let siteName = 'Nullsto Temp Mail';
    let siteUrl = 'https://nullsto.edu.pl';

    const { data: appSettings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['general', 'general_settings']);

    if (appSettings && appSettings.length > 0) {
      for (const setting of appSettings) {
        if (setting.value?.siteName) siteName = setting.value.siteName;
        if (setting.value?.siteUrl) siteUrl = setting.value.siteUrl;
      }
    }

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

    // Track used mailbox IDs to avoid retrying the same one
    const usedMailboxIds = new Set<string>();
    const MAX_ATTEMPTS = 5;
    let attemptCount = 0;
    let lastError: string | null = null;

    // Try mailboxes with proper failover using RPC
    while (attemptCount < MAX_ATTEMPTS) {
      attemptCount++;
      
      const mailbox = await getNextMailbox(supabase);
      
      if (!mailbox) {
        console.log(`[send-template-email] Attempt ${attemptCount}: No more mailboxes available from RPC`);
        break;
      }
      
      // Skip if we've already tried this mailbox
      if (usedMailboxIds.has(mailbox.mailbox_id)) {
        console.log(`[send-template-email] Attempt ${attemptCount}: Skipping already-tried mailbox ${mailbox.mailbox_id}`);
        continue;
      }
      
      usedMailboxIds.add(mailbox.mailbox_id);
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

        console.log(`[send-template-email] Email sent successfully via ${mailbox.smtp_from} on attempt ${attemptCount}`);

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

      // Failed - record error so this mailbox is excluded from next select_available_mailbox call
      lastError = result.error || 'Unknown error';
      console.error(`[send-template-email] Attempt ${attemptCount}: Mailbox ${mailbox.smtp_from} failed: ${lastError}`);

      // Record error - this makes the mailbox unavailable for the cooldown period
      await supabase.rpc('record_mailbox_error', { 
        p_mailbox_id: mailbox.mailbox_id, 
        p_error: lastError 
      });

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
      await sleep(300);
    }

    // All database mailboxes failed - try env fallback
    const envHost = Deno.env.get("SMTP_HOST");
    const envPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const envUser = Deno.env.get("SMTP_USER");
    const envPass = Deno.env.get("SMTP_PASSWORD");
    const envFrom = Deno.env.get("SMTP_FROM") || envUser;
    const hasEnvFallback = envHost && envUser && envPass;

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