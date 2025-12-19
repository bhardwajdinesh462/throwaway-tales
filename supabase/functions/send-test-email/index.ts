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
      // Explicit UTF-8 string encoding for password to handle special characters
      password = String(smtpConfig.password);
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
          password = String(mailbox.smtp_password);
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
        password = String(Deno.env.get("SMTP_PASSWORD") || "");
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

    // Determine connection settings based on port
    const useTls = smtpConfig?.encryption === 'ssl' || port === 465;
    
    const client = new SMTPClient({
      connection: {
        hostname: host,
        port: port,
        tls: useTls,
        auth: {
          username: username,
          password: password,
        },
      },
    });

    const emailSubject = subject || "Test Email from Nullsto";
    const domain = getDomainFromEmail(fromEmail!);
    const messageId = generateMessageId(domain);
    const timestamp = new Date().toISOString();
    
    // Create plain text version for better deliverability
    const plainTextBody = `
Test Email Successful!

This is a test email from your Nullsto installation.
Your SMTP configuration is working correctly.

---
Sent at: ${timestamp}
SMTP Server: ${host}:${port}
Config Source: ${configSource}
Message-ID: ${messageId}
    `.trim();
    
    // Create HTML body with proper headers for better deliverability
    const emailBody = body || `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; padding: 20px; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">Test Email Successful!</h1>
    </div>
    <div style="padding: 30px;">
      <p style="color: #333; line-height: 1.6;">This is a test email from your <strong>Nullsto</strong> installation.</p>
      <p style="color: #333; line-height: 1.6;">Your SMTP configuration is working correctly.</p>
      <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #16a34a; font-weight: 600;">✓ Email delivered successfully</p>
      </div>
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 20px;">
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;"><strong>Sent at:</strong> ${timestamp}</p>
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;"><strong>SMTP Server:</strong> ${host}:${port}</p>
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;"><strong>Config Source:</strong> ${configSource}</p>
        <p style="margin: 0; font-size: 12px; color: #64748b;"><strong>Message-ID:</strong> ${messageId}</p>
      </div>
    </div>
    <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0;">If you received this email, your SMTP configuration is working!</p>
      <p style="margin: 8px 0 0 0; color: #94a3b8;">Check spam folder if emails don't appear in inbox.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Retry logic with exponential backoff
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[send-test-email] Attempt ${attempt}/${maxRetries}`);
        
        await client.send({
          from: `${fromName} <${fromEmail}>`,
          to: recipientEmail,
          replyTo: fromEmail,
          subject: emailSubject,
          content: plainTextBody,
          html: emailBody,
          headers: {
            "Message-ID": messageId,
            "X-Mailer": "Nullsto Mail System",
            "X-Priority": "3",
            "X-Auto-Response-Suppress": "All",
            "List-Unsubscribe": `<mailto:${fromEmail}?subject=unsubscribe>`,
          },
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
              sentAt: timestamp,
              messageId: messageId,
              attempt: attempt
            },
            deliverabilityInfo: {
              checkSpam: true,
              spamHint: "If you don't see the email in your inbox, check your Spam/Junk folder.",
              spfDkimHint: "For better deliverability, ensure SPF and DKIM records are configured for your sending domain.",
              testTools: ["mail-tester.com", "mxtoolbox.com/deliverability"]
            }
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (sendError: any) {
        lastError = sendError;
        console.error(`[send-test-email] Attempt ${attempt} failed:`, sendError.message);
        
        // Don't retry on authentication errors (permanent failures)
        if (sendError.message.includes("535") || sendError.message.includes("Authentication")) {
          console.log(`[send-test-email] Authentication error - not retrying`);
          break;
        }
        
        // Don't retry on rate limit/suspicious activity (needs time cooldown)
        if (sendError.message.includes("550") || sendError.message.includes("suspicious")) {
          console.log(`[send-test-email] Rate limit or suspicious activity - not retrying`);
          break;
        }
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
          console.log(`[send-test-email] Waiting ${delay}ms before retry...`);
          await sleep(delay);
        }
      }
    }
    
    // Close client if still open
    try {
      await client.close();
    } catch {
      // Ignore close errors
    }

    // If we get here, all retries failed
    throw lastError || new Error("Failed to send email after multiple attempts");

  } catch (error: any) {
    console.error("[send-test-email] Error:", error);
    
    let errorMessage = error.message || "Failed to send email";
    let hint = "";
    let retryable = true;
    
    // Provide more helpful error messages with hints
    if (errorMessage.includes("535") || errorMessage.includes("Authentication") || errorMessage.includes("auth") || errorMessage.includes("Incorrect authentication")) {
      errorMessage = "SMTP authentication failed.";
      hint = "Check your username and password are correct. Some providers require app-specific passwords.";
      retryable = false;
    } else if (errorMessage.includes("Connection") || errorMessage.includes("connect")) {
      errorMessage = "Could not connect to SMTP server.";
      hint = "Verify the host and port are correct and the server is reachable.";
    } else if (errorMessage.includes("TLS") || errorMessage.includes("SSL") || errorMessage.includes("tls")) {
      errorMessage = "SSL/TLS connection failed.";
      hint = "Try changing the encryption setting (SSL for port 465, TLS for port 587).";
    } else if (errorMessage.includes("550") || errorMessage.includes("Cannot send") || errorMessage.includes("suspicious")) {
      errorMessage = "SMTP server rejected the request.";
      hint = "The mailbox may be rate-limited or blocked. Wait 1-2 hours and try again, or add more mailboxes in Admin → Mailboxes for load balancing.";
      retryable = false;
    } else if (errorMessage.includes("lookup") || errorMessage.includes("DNS") || errorMessage.includes("getaddrinfo") || errorMessage.includes("ENOTFOUND") || errorMessage.includes("not known")) {
      errorMessage = "Could not resolve SMTP hostname.";
      hint = "Check that the SMTP host is correct. Configure a mailbox in Admin → Mailboxes.";
    } else if (errorMessage.includes("timeout")) {
      errorMessage = "Connection timed out.";
      hint = "The SMTP server may be slow or unreachable. Try again later.";
    }

    console.error(`[send-test-email] Friendly error: ${errorMessage}. Hint: ${hint}. Raw: ${error.message}`);

    // Return 200 so the frontend can display friendly error details without invoke() throwing
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: hint ? `${errorMessage} ${hint}` : errorMessage,
        details: error.message,
        retryable: retryable,
        deliverabilityInfo: {
          checkSpam: true,
          spamHint: "If emails are being sent but not received, check your Spam/Junk folder.",
          commonIssues: [
            "Missing SPF record for sending domain",
            "Missing DKIM configuration",
            "Sending domain not verified",
            "Rate limiting by mail provider"
          ]
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
