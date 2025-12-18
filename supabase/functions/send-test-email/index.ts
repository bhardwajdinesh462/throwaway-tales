import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'none' | 'ssl' | 'tls';
  fromEmail: string;
  fromName: string;
}

interface TestEmailRequest {
  recipientEmail: string;
  subject?: string;
  body?: string;
  smtpConfig?: SMTPConfig;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail, subject, body, smtpConfig }: TestEmailRequest = await req.json();

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Recipient email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get SMTP settings from environment or request
    const host = smtpConfig?.host || Deno.env.get("SMTP_HOST");
    const port = smtpConfig?.port || parseInt(Deno.env.get("SMTP_PORT") || "587");
    const username = smtpConfig?.username || Deno.env.get("SMTP_USER");
    const password = smtpConfig?.password || Deno.env.get("SMTP_PASSWORD");
    const fromEmail = smtpConfig?.fromEmail || username;
    const fromName = smtpConfig?.fromName || "Nullsto";

    if (!host || !username || !password) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "SMTP configuration is incomplete. Please configure SMTP settings in the admin panel." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Attempting to send test email to ${recipientEmail} via ${host}:${port}`);

    // Use Deno's SMTP client to send email
    // Note: Deno doesn't have a built-in SMTP client, so we'll use a third-party module
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const client = new SMTPClient({
      connection: {
        hostname: host,
        port: port,
        tls: smtpConfig?.encryption === 'ssl' || port === 465,
        auth: {
          username: username,
          password: password,
        },
      },
    });

    const emailSubject = subject || "Test Email from Nullsto";
    const emailBody = body || `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #0d9488;">Test Email Successful!</h1>
          <p>This is a test email from your Nullsto installation.</p>
          <p>Your SMTP configuration is working correctly.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">
            Sent at: ${new Date().toISOString()}<br/>
            SMTP Server: ${host}:${port}
          </p>
        </body>
      </html>
    `;

    await client.send({
      from: `${fromName} <${fromEmail}>`,
      to: recipientEmail,
      subject: emailSubject,
      html: emailBody,
    });

    await client.close();

    console.log(`Test email sent successfully to ${recipientEmail}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Test email sent successfully to ${recipientEmail}`,
        details: {
          recipient: recipientEmail,
          smtpServer: `${host}:${port}`,
          sentAt: new Date().toISOString()
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error sending test email:", error);
    
    let errorMessage = error.message || "Failed to send email";
    
    // Provide more helpful error messages
    if (errorMessage.includes("Authentication")) {
      errorMessage = "SMTP authentication failed. Please check your username and password.";
    } else if (errorMessage.includes("Connection")) {
      errorMessage = "Could not connect to SMTP server. Please check the host and port.";
    } else if (errorMessage.includes("TLS") || errorMessage.includes("SSL")) {
      errorMessage = "SSL/TLS connection failed. Try changing the encryption setting.";
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
