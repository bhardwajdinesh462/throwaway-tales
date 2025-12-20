import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthEmailRequest {
  type: "signup" | "recovery" | "email_change" | "magic_link";
  email: string;
  token?: string;
  tokenHash?: string;
  redirectUrl?: string;
  name?: string;
}

interface MailboxConfig {
  mailbox_id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
}

// Sleep helper for retry logic
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to format date
const formatDate = (): string => {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
};

// Helper to parse user agent
const parseUserAgent = (ua: string): string => {
  if (!ua) return "Unknown Browser";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  if (ua.includes("Opera")) return "Opera";
  return "Unknown Browser";
};

// Get all available mailboxes for failover
async function getAllMailboxes(supabase: any): Promise<MailboxConfig[]> {
  const { data, error } = await supabase
    .from('mailboxes')
    .select('id, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, last_error, last_error_at, emails_sent_this_hour, hourly_limit, emails_sent_today, daily_limit')
    .eq('is_active', true)
    .not('smtp_host', 'is', null)
    .not('smtp_user', 'is', null)
    .not('smtp_password', 'is', null)
    .order('priority', { ascending: true });

  if (error || !data) {
    console.log('[auth-email-hook] No mailboxes found:', error?.message);
    return [];
  }

  // Filter out mailboxes with recent errors or at limit
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  return data
    .filter((mb: any) => {
      // Check if at hourly/daily limit
      if (mb.emails_sent_this_hour >= (mb.hourly_limit || 50)) return false;
      if (mb.emails_sent_today >= (mb.daily_limit || 500)) return false;
      // If no recent error, include it
      if (!mb.last_error_at) return true;
      // If error was more than 30 mins ago, include it (allow retry)
      return mb.last_error_at < thirtyMinutesAgo;
    })
    .map((mb: any) => ({
      mailbox_id: mb.id,
      smtp_host: mb.smtp_host,
      smtp_port: mb.smtp_port || 587,
      smtp_user: mb.smtp_user,
      smtp_password: mb.smtp_password,
      smtp_from: mb.smtp_from || mb.smtp_user,
    }));
}

// Check if error is permanent (don't retry with same mailbox)
function isPermanentError(errorMessage: string): boolean {
  const permanentErrors = ['535', '550', '551', '552', '553', '554', 'Authentication', 'auth failed', 'suspicious', 'blocked', 'blacklisted'];
  return permanentErrors.some(e => errorMessage.toLowerCase().includes(e.toLowerCase()));
}

// Try to send email with a specific mailbox config
async function trySendEmail(
  config: { host: string; port: number; username: string; password: string; fromAddress: string; siteName: string },
  emailData: { to: string; subject: string; html: string }
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
      from: `${config.siteName} <${config.fromAddress}>`,
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: AuthEmailRequest = await req.json();
    const { type, email, token, tokenHash, redirectUrl, name } = payload;

    // Get request metadata for template variables
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "Unknown";
    const userAgent = req.headers.get("user-agent") || "";
    const browser = parseUserAgent(userAgent);
    const currentDate = formatDate();

    console.log(`[auth-email-hook] Processing ${type} email for ${email}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Map auth email type to template type
    const templateTypeMap: Record<string, string> = {
      signup: "verification",
      recovery: "password_reset",
      email_change: "verification",
      magic_link: "verification",
    };

    const templateType = templateTypeMap[type] || "notification";

    // Fetch the template
    const { data: templates, error: templateError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("type", templateType)
      .limit(1);

    if (templateError) {
      console.error("[auth-email-hook] Template fetch error:", templateError);
    }

    // Fetch general settings - check both 'general' and 'general_settings' keys
    let siteName = "Nullsto";
    let siteUrl = "https://nullsto.edu.pl"; // Default to correct domain

    const { data: appSettings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["general", "general_settings"]);

    if (appSettings && appSettings.length > 0) {
      for (const setting of appSettings) {
        if (setting.value?.siteName) siteName = setting.value.siteName;
        if (setting.value?.siteUrl) siteUrl = setting.value.siteUrl;
      }
    }

    // Ensure siteUrl doesn't have trailing slash
    siteUrl = siteUrl.replace(/\/$/, '');

    console.log(`[auth-email-hook] Using site URL: ${siteUrl}`);

    // Build action URL
    let actionUrl = redirectUrl || siteUrl;
    if (token || tokenHash) {
      const tokenParam = tokenHash || token;
      if (type === "recovery") {
        actionUrl = `${siteUrl}/auth?mode=reset&token=${tokenParam}`;
      } else if (type === "signup" || type === "email_change") {
        actionUrl = `${siteUrl}/verify-email?token=${tokenParam}`;
      } else {
        actionUrl = `${siteUrl}/auth?token=${tokenParam}`;
      }
    }

    // Use template or fallback to default content
    let subject: string;
    let body: string;

    if (templates && templates.length > 0) {
      const template = templates[0];
      subject = template.subject;
      body = template.body;
    } else {
      // Fallback templates
      if (type === "signup") {
        subject = `Welcome to {{site_name}}!`;
        body = `Hello {{name}},\n\nWelcome to {{site_name}}! Please verify your email by clicking the link below:\n\n{{verify_link}}\n\nIf you didn't create an account, you can ignore this email.\n\nBest regards,\n{{site_name}} Team`;
      } else if (type === "recovery") {
        subject = `Reset your {{site_name}} password`;
        body = `Hello,\n\nYou requested to reset your password. Click the link below to set a new password:\n\n{{reset_link}}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, you can ignore this email.\n\nBest regards,\n{{site_name}} Team`;
      } else {
        subject = `Action required for {{site_name}}`;
        body = `Hello,\n\nPlease click the link below to complete your action:\n\n{{link}}\n\nBest regards,\n{{site_name}} Team`;
      }
    }

    // Replace variables
    const replaceVariables = (text: string): string => {
      return text
        .replace(/\{\{site_name\}\}/g, siteName)
        .replace(/\{\{site_url\}\}/g, siteUrl)
        .replace(/\{\{name\}\}/g, name || email.split("@")[0])
        .replace(/\{\{email\}\}/g, email)
        .replace(/\{\{link\}\}/g, actionUrl)
        .replace(/\{\{reset_link\}\}/g, actionUrl)
        .replace(/\{\{verify_link\}\}/g, actionUrl)
        .replace(/\{\{date\}\}/g, currentDate)
        .replace(/\{\{ip_address\}\}/g, clientIp)
        .replace(/\{\{browser\}\}/g, browser);
    };

    subject = replaceVariables(subject);
    body = replaceVariables(body);

    // Create HTML email
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background: #f1f5f9; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 32px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
            .content { padding: 32px; }
            .content p { margin: 0 0 16px; color: #475569; }
            .button { display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
            .button:hover { opacity: 0.9; }
            .footer { text-align: center; padding: 24px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
            .footer a { color: #0d9488; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                <h1>${siteName}</h1>
              </div>
              <div class="content">
                ${body
                  .split("\n")
                  .map((line) => {
                    if (line.includes("http://") || line.includes("https://")) {
                      return `<p><a href="${actionUrl}" class="button">Click Here</a></p>`;
                    }
                    return line ? `<p>${line}</p>` : "";
                  })
                  .join("")}
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
                <p>If you didn't request this email, you can safely ignore it.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Get all available mailboxes for failover
    const mailboxes = await getAllMailboxes(supabase);
    console.log(`[auth-email-hook] Found ${mailboxes.length} available mailboxes`);

    // Also check for env fallback
    const envHost = Deno.env.get("SMTP_HOST");
    const envPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const envUser = Deno.env.get("SMTP_USER");
    const envPass = Deno.env.get("SMTP_PASSWORD");
    const envFrom = Deno.env.get("SMTP_FROM") || envUser;
    const hasEnvFallback = envHost && envUser && envPass;

    if (mailboxes.length === 0 && !hasEnvFallback) {
      console.error("[auth-email-hook] Missing SMTP configuration");
      return new Response(JSON.stringify({ success: false, error: "SMTP configuration incomplete. Please configure a mailbox in Admin > Mailboxes." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try each mailbox with failover
    let lastError: string | null = null;
    let attemptCount = 0;

    for (const mailbox of mailboxes) {
      attemptCount++;
      console.log(`[auth-email-hook] Attempt ${attemptCount}: Trying mailbox ${mailbox.smtp_from} via ${mailbox.smtp_host}`);

      const result = await trySendEmail(
        {
          host: mailbox.smtp_host,
          port: mailbox.smtp_port,
          username: mailbox.smtp_user,
          password: String(mailbox.smtp_password),
          fromAddress: mailbox.smtp_from,
          siteName,
        },
        {
          to: email,
          subject,
          html: htmlBody,
        }
      );

      if (result.success) {
        // Increment mailbox usage
        await supabase.rpc('increment_mailbox_usage', { p_mailbox_id: mailbox.mailbox_id });
        console.log(`[auth-email-hook] ${type} email sent successfully to ${email} via ${mailbox.smtp_from}`);

        return new Response(JSON.stringify({ success: true, message: `${type} email sent to ${email}` }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Failed - log and mark unhealthy if permanent error
      lastError = result.error || 'Unknown error';
      console.error(`[auth-email-hook] Mailbox ${mailbox.smtp_from} failed: ${lastError}`);

      if (isPermanentError(lastError)) {
        await supabase.rpc('record_mailbox_error', { 
          p_mailbox_id: mailbox.mailbox_id, 
          p_error: lastError 
        });
      }

      // Small delay before next attempt
      await sleep(500);
    }

    // All database mailboxes failed - try env fallback
    if (hasEnvFallback) {
      attemptCount++;
      console.log(`[auth-email-hook] Attempt ${attemptCount}: Trying env fallback ${envHost}`);

      const result = await trySendEmail(
        {
          host: envHost!,
          port: envPort,
          username: envUser!,
          password: String(envPass),
          fromAddress: envFrom!,
          siteName,
        },
        {
          to: email,
          subject,
          html: htmlBody,
        }
      );

      if (result.success) {
        console.log(`[auth-email-hook] ${type} email sent successfully via env fallback`);

        return new Response(JSON.stringify({ success: true, message: `${type} email sent to ${email}` }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      lastError = result.error || 'Unknown error';
      console.error(`[auth-email-hook] Env fallback failed: ${lastError}`);
    }

    // All attempts failed
    throw new Error(`All ${attemptCount} SMTP attempts failed. Last error: ${lastError}`);

  } catch (error: any) {
    console.error("[auth-email-hook] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
