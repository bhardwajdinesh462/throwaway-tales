import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendVerificationRequest {
  userId: string;
  email: string;
  name?: string;
  token: string;
}

interface MailboxConfig {
  mailbox_id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
}

// Generate RFC 2822 compliant Message-ID
function generateMessageId(domain: string): string {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `<${timestamp}.${randomPart}@${domain}>`;
}

// Get domain from email address
function getDomainFromEmail(email: string): string {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1] : 'localhost';
}

// Sleep helper for retry logic
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
    console.log('[send-verification-email] No mailboxes found:', error?.message);
    return [];
  }

  // Filter out mailboxes with recent errors (within 30 minutes)
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  return data
    .filter((mb: any) => {
      // If no recent error, include it
      if (!mb.last_error_at) return true;
      // If error was more than 30 mins ago, include it (allow retry)
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
  console.log(`[send-verification-email] Marking mailbox ${mailboxId} as unhealthy: ${errorMessage}`);
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
    console.error('[send-verification-email] Failed to log email attempt:', err);
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
  emailData: { to: string; subject: string; plainText: string; html: string; siteName: string; messageId: string }
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
      replyTo: config.fromAddress,
      subject: emailData.subject,
      content: emailData.plainText,
      html: emailData.html,
      headers: {
        "Message-ID": emailData.messageId,
        "X-Mailer": "Nullsto Mail System",
        "X-Priority": "3",
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, name, token }: SendVerificationRequest = await req.json();

    console.log(`[send-verification-email] Sending verification to ${email}`);

    if (!email || !token || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch general settings for site name
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'general_settings')
      .single();

    const siteName = settingsData?.value?.siteName || 'Nullsto Temp Mail';
    const siteUrl = settingsData?.value?.siteUrl || 'https://nullsto.edu.pl';

    // Build verification link
    const verifyLink = `${siteUrl}/verify-email?token=${token}`;
    const subject = `Verify your email address - ${siteName}`;

    // Get all available mailboxes for failover
    const mailboxes = await getAllMailboxes(supabase);
    console.log(`[send-verification-email] Found ${mailboxes.length} available mailboxes`);

    // Also check for env fallback
    const envHost = Deno.env.get("SMTP_HOST");
    const envPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const envUser = Deno.env.get("SMTP_USER");
    const envPass = Deno.env.get("SMTP_PASSWORD");
    const envFrom = Deno.env.get("SMTP_FROM") || envUser;
    const hasEnvFallback = envHost && envUser && envPass;

    if (mailboxes.length === 0 && !hasEnvFallback) {
      console.error('[send-verification-email] No SMTP configuration available');
      return new Response(
        JSON.stringify({ success: false, error: "SMTP configuration incomplete. Please configure a mailbox in Admin > Mailboxes." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare email content
    const domain = getDomainFromEmail(mailboxes[0]?.smtp_from || envFrom || 'nullsto.edu.pl');
    const messageId = generateMessageId(domain);

    const plainTextBody = `
${siteName} - Verify Your Email Address

Hi ${name || 'there'},

Thank you for signing up for ${siteName}! To complete your registration and access all features, please verify your email address by clicking the link below:

${verifyLink}

This verification link will expire in 24 hours.

If you didn't create an account with us, you can safely ignore this email.

---
© ${new Date().getFullYear()} ${siteName}. All rights reserved.
This email was sent to ${email}
    `.trim();

    const htmlBody = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f4f4f5;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 40px 30px; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">${siteName}</h1>
      </div>
      <div style="padding: 40px 30px;">
        <h2 style="color: #0d9488; margin-top: 0;">Verify Your Email Address</h2>
        <p>Hi ${name || 'there'},</p>
        <p>Thank you for signing up for ${siteName}! To complete your registration and access all features, please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyLink}" style="display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">Verify Email Address</a>
        </div>
        <p>This verification link will expire in 24 hours.</p>
        <p>If you didn't create an account with us, you can safely ignore this email.</p>
        <div style="word-break: break-all; font-size: 12px; color: #64748b; margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px;">
          <strong>Can't click the button?</strong> Copy and paste this link into your browser:<br>
          ${verifyLink}
        </div>
      </div>
      <div style="text-align: center; padding: 20px 30px; color: #64748b; font-size: 12px; background: #f8fafc;">
        <p style="margin: 0;">© ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
        <p style="margin: 8px 0 0 0;">This email was sent to ${email}</p>
      </div>
    </div>
  </body>
</html>
    `;

    // Try each mailbox with failover
    let lastError: string | null = null;
    let attemptCount = 0;

    for (const mailbox of mailboxes) {
      attemptCount++;
      console.log(`[send-verification-email] Attempt ${attemptCount}: Trying mailbox ${mailbox.smtp_from} via ${mailbox.smtp_host}`);

      const result = await trySendEmail(
        {
          host: mailbox.smtp_host,
          port: mailbox.smtp_port,
          username: mailbox.smtp_user,
          password: String(mailbox.smtp_password),
          fromAddress: mailbox.smtp_from,
        },
        {
          to: email,
          subject,
          plainText: plainTextBody,
          html: htmlBody,
          siteName,
          messageId,
        }
      );

      if (result.success) {
        // Increment mailbox usage
        await supabase.rpc('increment_mailbox_usage', { p_mailbox_id: mailbox.mailbox_id });
        
        // Log success
        await logEmailAttempt(supabase, {
          mailboxId: mailbox.mailbox_id,
          mailboxName: mailbox.smtp_from,
          recipientEmail: email,
          subject,
          status: 'sent',
          configSource: 'database',
          smtpHost: mailbox.smtp_host,
          attemptCount,
        });

        console.log(`[send-verification-email] Email sent successfully via ${mailbox.smtp_from}`);

        return new Response(
          JSON.stringify({ success: true, message: "Verification email sent" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Failed - log and mark unhealthy if permanent error
      lastError = result.error || 'Unknown error';
      console.error(`[send-verification-email] Mailbox ${mailbox.smtp_from} failed: ${lastError}`);

      if (isPermanentError(lastError)) {
        await markMailboxUnhealthy(supabase, mailbox.mailbox_id, lastError);
      }

      // Log failed attempt
      await logEmailAttempt(supabase, {
        mailboxId: mailbox.mailbox_id,
        mailboxName: mailbox.smtp_from,
        recipientEmail: email,
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
      console.log(`[send-verification-email] Attempt ${attemptCount}: Trying env fallback ${envHost}`);

      const result = await trySendEmail(
        {
          host: envHost!,
          port: envPort,
          username: envUser!,
          password: String(envPass),
          fromAddress: envFrom!,
        },
        {
          to: email,
          subject,
          plainText: plainTextBody,
          html: htmlBody,
          siteName,
          messageId,
        }
      );

      if (result.success) {
        await logEmailAttempt(supabase, {
          mailboxId: null,
          mailboxName: envFrom || null,
          recipientEmail: email,
          subject,
          status: 'sent',
          configSource: 'environment',
          smtpHost: envHost,
          attemptCount,
        });

        console.log(`[send-verification-email] Email sent successfully via env fallback`);

        return new Response(
          JSON.stringify({ success: true, message: "Verification email sent" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      lastError = result.error || 'Unknown error';
      console.error(`[send-verification-email] Env fallback failed: ${lastError}`);

      await logEmailAttempt(supabase, {
        mailboxId: null,
        mailboxName: envFrom || null,
        recipientEmail: email,
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
    console.error("[send-verification-email] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
