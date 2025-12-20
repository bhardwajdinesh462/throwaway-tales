import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hash function for secure token storage
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

interface CreateVerificationRequest {
  userId: string;
  email: string;
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
    console.log('[create-verification-and-send] No mailboxes found:', error?.message);
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
  config: { host: string; port: number; username: string; password: string; fromAddress: string },
  emailData: { to: string; subject: string; plainText: string; html: string }
): Promise<{ success: boolean; error?: string }> {
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
      from: config.fromAddress,
      to: emailData.to,
      subject: emailData.subject,
      content: emailData.plainText,
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
    const { userId, email, name }: CreateVerificationRequest = await req.json();

    console.log("[create-verification-and-send] Creating verification for:", { userId, email, name });

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ error: "userId and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[create-verification-and-send] Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Generate secure token server-side
    const rawToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    
    // Hash the token before storing (security best practice)
    const hashedToken = await hashToken(rawToken);

    // Calculate expiry (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Delete any existing verification for this user
    await supabase
      .from('email_verifications')
      .delete()
      .eq('user_id', userId);

    // Insert verification record with HASHED token (not raw token)
    const { error: insertError } = await supabase
      .from('email_verifications')
      .insert({
        user_id: userId,
        email: email,
        token: hashedToken,
        expires_at: expiresAt
      });

    if (insertError) {
      console.error("[create-verification-and-send] Failed to insert verification record:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create verification record: " + insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[create-verification-and-send] Verification record created successfully");

    // Get site settings for email - check both 'general' and 'general_settings' keys
    let siteName = "Nullsto";
    let siteUrl = "https://nullsto.edu.pl"; // Default to correct domain

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

    // Ensure siteUrl doesn't have trailing slash
    siteUrl = siteUrl.replace(/\/$/, '');

    console.log(`[create-verification-and-send] Using site URL: ${siteUrl}`);

    // Construct verification link with raw token
    const verifyLink = `${siteUrl}/verify-email?token=${rawToken}`;
    const userName = name || email.split('@')[0];
    const subject = `Verify your email for ${siteName}`;

    // Create HTML email body
    const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${siteName}</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
    <p>Hi ${userName},</p>
    <p>Thank you for signing up for ${siteName}! Please verify your email address by clicking the button below:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify Email Address</a>
    </div>
    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">${verifyLink}</p>
    <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
    <p style="color: #999; font-size: 12px; margin-bottom: 0;">If you didn't create an account with ${siteName}, you can safely ignore this email.</p>
  </div>
</body>
</html>`;

    // Plain text version
    const textBody = `Hi ${userName},

Thank you for signing up for ${siteName}! Please verify your email address by clicking the link below:

${verifyLink}

This link will expire in 24 hours.

If you didn't create an account with ${siteName}, you can safely ignore this email.`;

    // Get all available mailboxes for failover
    const mailboxes = await getAllMailboxes(supabase);
    console.log(`[create-verification-and-send] Found ${mailboxes.length} available mailboxes`);

    // Also check for env fallback
    const envHost = Deno.env.get("SMTP_HOST");
    const envPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const envUser = Deno.env.get("SMTP_USER");
    const envPass = Deno.env.get("SMTP_PASSWORD");
    const envFrom = Deno.env.get("SMTP_FROM") || envUser;
    const hasEnvFallback = envHost && envUser && envPass;

    if (mailboxes.length === 0 && !hasEnvFallback) {
      console.error("[create-verification-and-send] SMTP not configured - skipping email send");
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: "Verification created but email not sent (SMTP not configured)",
          token: rawToken
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try each mailbox with failover
    let lastError: string | null = null;
    let attemptCount = 0;

    for (const mailbox of mailboxes) {
      attemptCount++;
      console.log(`[create-verification-and-send] Attempt ${attemptCount}: Trying mailbox ${mailbox.smtp_from} via ${mailbox.smtp_host}`);

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
          plainText: textBody,
          html: htmlBody,
        }
      );

      if (result.success) {
        // Increment mailbox usage
        await supabase.rpc('increment_mailbox_usage', { p_mailbox_id: mailbox.mailbox_id });
        console.log(`[create-verification-and-send] Email sent successfully via ${mailbox.smtp_from}`);

        return new Response(
          JSON.stringify({ success: true, message: "Verification email sent" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Failed - log and mark unhealthy if permanent error
      lastError = result.error || 'Unknown error';
      console.error(`[create-verification-and-send] Mailbox ${mailbox.smtp_from} failed: ${lastError}`);

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
      console.log(`[create-verification-and-send] Attempt ${attemptCount}: Trying env fallback ${envHost}`);

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
          plainText: textBody,
          html: htmlBody,
        }
      );

      if (result.success) {
        console.log(`[create-verification-and-send] Email sent successfully via env fallback`);

        return new Response(
          JSON.stringify({ success: true, message: "Verification email sent" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      lastError = result.error || 'Unknown error';
      console.error(`[create-verification-and-send] Env fallback failed: ${lastError}`);
    }

    // All attempts failed - return with warning but success (verification was created)
    console.error(`[create-verification-and-send] All ${attemptCount} SMTP attempts failed`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        warning: `Verification created but email failed to send after ${attemptCount} attempts`,
        error: lastError,
        token: rawToken
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[create-verification-and-send] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
