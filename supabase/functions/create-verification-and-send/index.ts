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
  mailbox_id: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, name }: CreateVerificationRequest = await req.json();

    console.log("Creating verification for:", { userId, email, name });

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
      console.error("Missing Supabase environment variables");
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
      console.error("Failed to insert verification record:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create verification record: " + insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Verification record created successfully");

    // Get site settings for email
    const { data: appSettings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'general_settings')
      .single();

    const siteName = appSettings?.value?.siteName || "Nullsto";
    const siteUrl = appSettings?.value?.siteUrl || Deno.env.get("SITE_URL") || "https://nullsto.com";

    // Construct verification link
    // Use raw token in the link (will be hashed for comparison when verifying)
    const verifyLink = `${siteUrl}/verify-email?token=${rawToken}`;

    // Try to get mailbox from load balancer (database) first
    let mailboxConfig: MailboxConfig | null = null;
    
    const { data: mailboxData } = await supabase.rpc('select_available_mailbox');
    
    if (mailboxData && mailboxData.length > 0) {
      const mb = mailboxData[0];
      mailboxConfig = {
        mailbox_id: mb.mailbox_id,
        smtp_host: mb.smtp_host,
        smtp_port: mb.smtp_port,
        smtp_user: mb.smtp_user,
        smtp_password: mb.smtp_password,
        smtp_from: mb.smtp_from || mb.smtp_user
      };
      console.log(`Using mailbox from database: ${mailboxConfig.mailbox_id}`);
    } else {
      // Fall back to environment variables
      const smtpHost = Deno.env.get("SMTP_HOST");
      const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
      const smtpUser = Deno.env.get("SMTP_USER");
      const smtpPass = Deno.env.get("SMTP_PASSWORD");
      const smtpFrom = Deno.env.get("SMTP_FROM") || smtpUser;

      if (smtpHost && smtpUser && smtpPass) {
        mailboxConfig = {
          mailbox_id: null,
          smtp_host: smtpHost,
          smtp_port: smtpPort,
          smtp_user: smtpUser,
          smtp_password: smtpPass,
          smtp_from: smtpFrom || `noreply@${siteName.toLowerCase()}.com`
        };
        console.log("Using SMTP from environment variables");
      }
    }

    if (!mailboxConfig) {
      console.error("SMTP not configured - skipping email send");
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: "Verification created but email not sent (SMTP not configured)",
          token: rawToken
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userName = name || email.split('@')[0];

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

    try {
      // Create SMTP client using denomailer
      const client = new SMTPClient({
        connection: {
          hostname: mailboxConfig.smtp_host,
          port: mailboxConfig.smtp_port,
          tls: mailboxConfig.smtp_port === 465,
          auth: {
            username: mailboxConfig.smtp_user,
            password: mailboxConfig.smtp_password,
          },
        },
      });

      // Send the email with proper multipart content
      await client.send({
        from: mailboxConfig.smtp_from,
        to: email,
        subject: `Verify your email for ${siteName}`,
        content: textBody,
        html: htmlBody,
      });

      await client.close();

      // Increment mailbox usage if using database mailbox
      if (mailboxConfig.mailbox_id) {
        await supabase.rpc('increment_mailbox_usage', { p_mailbox_id: mailboxConfig.mailbox_id });
        console.log(`Incremented usage for mailbox ${mailboxConfig.mailbox_id}`);
      }

      console.log("Verification email sent successfully to:", email);

      return new Response(
        JSON.stringify({ success: true, message: "Verification email sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (smtpError: any) {
      console.error("SMTP error:", smtpError);
      
      // Record error for database mailbox
      if (mailboxConfig.mailbox_id) {
        await supabase.rpc('record_mailbox_error', { 
          p_mailbox_id: mailboxConfig.mailbox_id, 
          p_error: smtpError.message || 'SMTP send failed'
        });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: "Verification created but email failed to send",
          error: smtpError.message,
          token: rawToken
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error("Error in create-verification-and-send:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
