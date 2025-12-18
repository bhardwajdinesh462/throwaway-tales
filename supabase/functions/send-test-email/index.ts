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

    // Determine source of SMTP settings for logging
    const usingRequestConfig = !!(smtpConfig?.host && smtpConfig?.username && smtpConfig?.password);
    
    // Get SMTP settings from request first, then environment
    const host = smtpConfig?.host || Deno.env.get("SMTP_HOST");
    const port = smtpConfig?.port || parseInt(Deno.env.get("SMTP_PORT") || "587");
    const username = smtpConfig?.username || Deno.env.get("SMTP_USER");
    const password = smtpConfig?.password || Deno.env.get("SMTP_PASSWORD");
    // IMPORTANT: Default fromEmail to username if not provided (most SMTP servers require this)
    const fromEmail = smtpConfig?.fromEmail || smtpConfig?.username || username;
    const fromName = smtpConfig?.fromName || "Nullsto";

    console.log(`[send-test-email] Config source: ${usingRequestConfig ? 'REQUEST' : 'ENV VARIABLES'}`);
    console.log(`[send-test-email] SMTP Host: ${host}, Port: ${port}, Username: ${username}, From: ${fromEmail}`);

    if (!host || !username || !password) {
      const missing = [];
      if (!host) missing.push('host');
      if (!username) missing.push('username');
      if (!password) missing.push('password');
      console.error(`[send-test-email] Missing SMTP config: ${missing.join(', ')}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `SMTP configuration incomplete. Missing: ${missing.join(', ')}. Please configure SMTP settings in Admin → Email → SMTP Settings.` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-test-email] Sending to ${recipientEmail} via ${host}:${port} from ${fromEmail}`);

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
    console.error("[send-test-email] Error:", error);
    
    let errorMessage = error.message || "Failed to send email";
    let hint = "";
    
    // Provide more helpful error messages with hints
    if (errorMessage.includes("Authentication") || errorMessage.includes("auth")) {
      errorMessage = "SMTP authentication failed.";
      hint = "Check your username and password are correct.";
    } else if (errorMessage.includes("Connection") || errorMessage.includes("connect")) {
      errorMessage = "Could not connect to SMTP server.";
      hint = "Verify the host and port are correct and the server is reachable.";
    } else if (errorMessage.includes("TLS") || errorMessage.includes("SSL") || errorMessage.includes("tls")) {
      errorMessage = "SSL/TLS connection failed.";
      hint = "Try changing the encryption setting (SSL for port 465, TLS for port 587).";
    } else if (errorMessage.includes("550") || errorMessage.includes("Cannot send")) {
      errorMessage = "SMTP server rejected the From address.";
      hint = "Your From Email must match your SMTP username (e.g., use the same email address).";
    } else if (errorMessage.includes("DNS") || errorMessage.includes("getaddrinfo") || errorMessage.includes("ENOTFOUND")) {
      errorMessage = "Could not resolve SMTP hostname.";
      hint = "Check that the SMTP host is correct and publicly accessible.";
    }

    console.error(`[send-test-email] Friendly error: ${errorMessage}. Hint: ${hint}. Raw: ${error.message}`);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: hint ? `${errorMessage} ${hint}` : errorMessage,
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
