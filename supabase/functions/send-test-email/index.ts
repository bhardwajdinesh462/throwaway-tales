import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    let host: string | undefined;
    let port: number = 587;
    let username: string | undefined;
    let password: string | undefined;
    let fromEmail: string | undefined;
    let fromName: string = "Nullsto";
    let mailboxId: string | null = null;
    let configSource = "UNKNOWN";

    // Priority 1: Use smtpConfig from request if provided
    if (smtpConfig?.host && smtpConfig?.username && smtpConfig?.password) {
      host = smtpConfig.host;
      port = smtpConfig.port || 587;
      username = smtpConfig.username;
      password = smtpConfig.password;
      fromEmail = smtpConfig.fromEmail || smtpConfig.username;
      fromName = smtpConfig.fromName || "Nullsto";
      configSource = "REQUEST";
      console.log(`[send-test-email] Using SMTP config from request`);
    } else {
      // Priority 2: Try to get from mailbox load balancer
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: mailboxData, error: mailboxError } = await supabase
          .rpc('select_available_mailbox');

        if (!mailboxError && mailboxData && mailboxData.length > 0) {
          const mailbox = mailboxData[0];
          host = mailbox.smtp_host;
          port = mailbox.smtp_port || 587;
          username = mailbox.smtp_user;
          password = mailbox.smtp_password;
          fromEmail = mailbox.smtp_from || mailbox.smtp_user;
          mailboxId = mailbox.mailbox_id;
          configSource = "DATABASE_MAILBOX";
          console.log(`[send-test-email] Using mailbox from database: ${mailboxId}`);
        }
      } catch (dbError) {
        console.log(`[send-test-email] Could not get mailbox from database: ${dbError}`);
      }

      // Priority 3: Fall back to environment variables
      if (!host || !username || !password) {
        host = Deno.env.get("SMTP_HOST");
        port = parseInt(Deno.env.get("SMTP_PORT") || "587");
        username = Deno.env.get("SMTP_USER");
        password = Deno.env.get("SMTP_PASSWORD");
        fromEmail = Deno.env.get("SMTP_FROM") || username;
        configSource = "ENV_VARIABLES";
        console.log(`[send-test-email] Using SMTP config from environment variables`);
      }
    }

    console.log(`[send-test-email] Config source: ${configSource}`);
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
          error: `SMTP configuration incomplete. Missing: ${missing.join(', ')}. Please configure a mailbox in Admin → Mailboxes or set SMTP environment variables.` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-test-email] Sending to ${recipientEmail} via ${host}:${port} from ${fromEmail}`);

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
            SMTP Server: ${host}:${port}<br/>
            Config Source: ${configSource}
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

    // If we used a database mailbox, increment usage
    if (mailboxId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.rpc('increment_mailbox_usage', { p_mailbox_id: mailboxId });
        console.log(`[send-test-email] Incremented usage for mailbox ${mailboxId}`);
      } catch (usageError) {
        console.warn(`[send-test-email] Failed to increment mailbox usage: ${usageError}`);
      }
    }

    console.log(`[send-test-email] Test email sent successfully to ${recipientEmail}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Test email sent successfully to ${recipientEmail}`,
        details: {
          recipient: recipientEmail,
          smtpServer: `${host}:${port}`,
          configSource: configSource,
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
    } else if (errorMessage.includes("550") || errorMessage.includes("Cannot send") || errorMessage.includes("suspicious")) {
      errorMessage = "SMTP server rejected the request.";
      hint = "The mailbox may be rate-limited. Add more mailboxes in Admin → Mailboxes for load balancing.";
    } else if (errorMessage.includes("lookup") || errorMessage.includes("DNS") || errorMessage.includes("getaddrinfo") || errorMessage.includes("ENOTFOUND") || errorMessage.includes("not known")) {
      errorMessage = "Could not resolve SMTP hostname.";
      hint = "Check that the SMTP host is correct. Configure a mailbox in Admin → Mailboxes.";
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
