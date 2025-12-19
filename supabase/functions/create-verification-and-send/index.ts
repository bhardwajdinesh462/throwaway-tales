import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateVerificationRequest {
  userId: string;
  email: string;
  name?: string;
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
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

    // Calculate expiry (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Delete any existing verification for this user
    await supabase
      .from('email_verifications')
      .delete()
      .eq('user_id', userId);

    // Insert verification record using service role (bypasses RLS)
    const { error: insertError } = await supabase
      .from('email_verifications')
      .insert({
        user_id: userId,
        email: email,
        token: token,
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
    const verifyLink = `${siteUrl}/verify-email?token=${token}`;

    // Get SMTP configuration
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || `noreply@${siteName.toLowerCase()}.com`;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error("SMTP not configured - skipping email send");
      // Still return success since verification record was created
      return new Response(
        JSON.stringify({ 
          success: true, 
          warning: "Verification created but email not sent (SMTP not configured)",
          token: token // Return token for testing purposes
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    const userName = name || email.split('@')[0];

    // Create HTML email body
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
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
      </html>
    `;

    // Send the email
    await client.send({
      from: smtpFrom,
      to: email,
      subject: `Verify your email for ${siteName}`,
      html: htmlBody,
    });

    await client.close();

    console.log("Verification email sent successfully to:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Verification email sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in create-verification-and-send:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
