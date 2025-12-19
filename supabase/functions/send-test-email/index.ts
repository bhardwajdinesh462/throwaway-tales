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

interface MailboxInfo {
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

// Create Supabase client helper
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseKey);
}

// Log email attempt to database
async function logEmailAttempt(
  supabase: ReturnType<typeof getSupabaseClient>,
  params: {
    mailboxId: string | null;
    recipientEmail: string;
    subject: string;
    status: 'sent' | 'failed' | 'bounced';
    errorCode?: string;
    errorMessage?: string;
    smtpResponse?: string;
    mailboxName?: string;
    smtpHost?: string;
    configSource?: string;
    messageId?: string;
    attemptCount?: number;
  }
) {
  try {
    await supabase.from('email_logs').insert({
      mailbox_id: params.mailboxId,
      recipient_email: params.recipientEmail,
      subject: params.subject,
      status: params.status,
      error_code: params.errorCode || null,
      error_message: params.errorMessage || null,
      smtp_response: params.smtpResponse || null,
      mailbox_name: params.mailboxName || null,
      smtp_host: params.smtpHost || null,
      config_source: params.configSource || null,
      message_id: params.messageId || null,
      attempt_count: params.attemptCount || 1,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
      failed_at: params.status === 'failed' || params.status === 'bounced' ? new Date().toISOString() : null
    });
    console.log(`[send-test-email] Logged email attempt: ${params.status}`);
  } catch (logError) {
    console.error(`[send-test-email] Failed to log email attempt:`, logError);
  }
}

// Mark mailbox as unhealthy
async function markMailboxUnhealthy(supabase: ReturnType<typeof getSupabaseClient>, mailboxId: string, error: string) {
  try {
    await supabase.from('mailboxes').update({
      last_error: error,
      last_error_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', mailboxId);
    console.log(`[send-test-email] Marked mailbox ${mailboxId} as unhealthy`);
  } catch (err) {
    console.warn(`[send-test-email] Failed to mark mailbox unhealthy:`, err);
  }
}

// Get next available mailbox
async function getNextMailbox(supabase: ReturnType<typeof getSupabaseClient>, excludeMailboxIds: string[] = []): Promise<MailboxInfo | null> {
  try {
    let query = supabase
      .from('mailboxes')
      .select('id, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from, priority, emails_sent_this_hour, hourly_limit, emails_sent_today, daily_limit, last_error_at')
      .eq('is_active', true)
      .not('smtp_host', 'is', null)
      .not('smtp_user', 'is', null)
      .not('smtp_password', 'is', null)
      .order('priority', { ascending: true })
      .limit(10);
    
    const { data, error } = await query;
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    // Filter out excluded mailboxes and those with recent errors or over limits
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    
    for (const mb of data) {
      // Skip excluded
      if (excludeMailboxIds.includes(mb.id)) continue;
      
      // Skip if recent error (within 30 min)
      if (mb.last_error_at && new Date(mb.last_error_at) > thirtyMinutesAgo) continue;
      
      // Skip if over limits
      const hourlyLimit = mb.hourly_limit || 100;
      const dailyLimit = mb.daily_limit || 1000;
      if ((mb.emails_sent_this_hour || 0) >= hourlyLimit) continue;
      if ((mb.emails_sent_today || 0) >= dailyLimit) continue;
      
      return {
        mailbox_id: mb.id,
        smtp_host: mb.smtp_host,
        smtp_port: mb.smtp_port || 587,
        smtp_user: mb.smtp_user,
        smtp_password: mb.smtp_password,
        smtp_from: mb.smtp_from || mb.smtp_user
      };
    }
    
    return null;
  } catch (err) {
    console.error(`[send-test-email] Error getting next mailbox:`, err);
    return null;
  }
}

// Increment mailbox usage
async function incrementMailboxUsage(supabase: ReturnType<typeof getSupabaseClient>, mailboxId: string) {
  try {
    const { data: current } = await supabase
      .from('mailboxes')
      .select('emails_sent_this_hour, emails_sent_today')
      .eq('id', mailboxId)
      .single();
    
    await supabase.from('mailboxes').update({
      emails_sent_this_hour: (current?.emails_sent_this_hour || 0) + 1,
      emails_sent_today: (current?.emails_sent_today || 0) + 1,
      last_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', mailboxId);
  } catch (err) {
    console.warn(`[send-test-email] Failed to increment mailbox usage:`, err);
  }
}

// Send email with a specific configuration
async function sendEmailWithConfig(
  recipientEmail: string,
  subject: string,
  config: {
    host: string;
    port: number;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
    useTls: boolean;
  },
  messageId: string,
  configSource: string
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
  
  const client = new SMTPClient({
    connection: {
      hostname: config.host,
      port: config.port,
      tls: config.useTls,
      auth: {
        username: config.username,
        password: config.password,
      },
    },
  });

  const timestamp = new Date().toISOString();
  
  const plainTextBody = `
Test Email Successful!

This is a test email from your Nullsto installation.
Your SMTP configuration is working correctly.

---
Sent at: ${timestamp}
SMTP Server: ${config.host}:${config.port}
Config Source: ${configSource}
Message-ID: ${messageId}
  `.trim();
  
  const emailBody = `
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
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;"><strong>SMTP Server:</strong> ${config.host}:${config.port}</p>
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

  try {
    await client.send({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: recipientEmail,
      replyTo: config.fromEmail,
      subject: subject,
      content: plainTextBody,
      html: emailBody,
      headers: {
        "Message-ID": messageId,
        "X-Mailer": "Nullsto Mail System",
        "X-Priority": "3",
        "X-Auto-Response-Suppress": "All",
        "List-Unsubscribe": `<mailto:${config.fromEmail}?subject=unsubscribe>`,
      },
    });

    await client.close();
    return { success: true };
  } catch (error: unknown) {
    try { await client.close(); } catch {}
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Extract error code
    let errorCode = 'UNKNOWN';
    if (errorMessage.includes('535')) errorCode = '535';
    else if (errorMessage.includes('550')) errorCode = '550';
    else if (errorMessage.includes('421')) errorCode = '421';
    else if (errorMessage.includes('451')) errorCode = '451';
    else if (errorMessage.includes('452')) errorCode = '452';
    
    return { 
      success: false, 
      error: errorMessage,
      errorCode 
    };
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseClient();

  try {
    const { recipientEmail, subject, smtpConfig }: TestEmailRequest = await req.json();

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Recipient email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailSubject = subject || "Test Email from Nullsto";
    const maxFailovers = 3;
    let attemptCount = 0;
    let lastError = "";
    let lastErrorCode = "";
    const triedMailboxIds: string[] = [];

    // Priority 1: Use smtpConfig from request if provided
    if (smtpConfig?.host && smtpConfig?.username && smtpConfig?.password) {
      const domain = getDomainFromEmail(smtpConfig.fromEmail || smtpConfig.username);
      const messageId = generateMessageId(domain);
      const useTls = smtpConfig.encryption === 'ssl' || smtpConfig.port === 465;
      
      console.log(`[send-test-email] Using SMTP config from request`);
      
      const result = await sendEmailWithConfig(
        recipientEmail,
        emailSubject,
        {
          host: smtpConfig.host,
          port: smtpConfig.port || 587,
          username: smtpConfig.username,
          password: String(smtpConfig.password),
          fromEmail: smtpConfig.fromEmail || smtpConfig.username,
          fromName: smtpConfig.fromName || "Nullsto",
          useTls
        },
        messageId,
        "REQUEST"
      );

      // Log the attempt
      await logEmailAttempt(supabase, {
        mailboxId: null,
        recipientEmail,
        subject: emailSubject,
        status: result.success ? 'sent' : 'failed',
        errorCode: result.errorCode,
        errorMessage: result.error,
        smtpResponse: result.error,
        mailboxName: smtpConfig.fromName,
        smtpHost: smtpConfig.host,
        configSource: 'REQUEST',
        messageId,
        attemptCount: 1
      });

      if (result.success) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Test email sent successfully to ${recipientEmail}`,
            details: {
              recipient: recipientEmail,
              smtpServer: `${smtpConfig.host}:${smtpConfig.port}`,
              configSource: "REQUEST",
              messageId
            },
            deliverabilityInfo: {
              checkSpam: true,
              spamHint: "If you don't see the email in your inbox, check your Spam/Junk folder.",
              spfDkimHint: "For better deliverability, ensure SPF and DKIM records are configured.",
              testTools: ["mail-tester.com", "mxtoolbox.com/deliverability"]
            }
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      lastError = result.error || "Failed to send email";
      lastErrorCode = result.errorCode || "";
    } else {
      // Priority 2: Database mailboxes with automatic failover
      console.log(`[send-test-email] Using database mailboxes with failover`);

      while (attemptCount < maxFailovers) {
        attemptCount++;
        
        // Get next available mailbox (excluding already tried ones)
        const mailbox = await getNextMailbox(supabase, triedMailboxIds);

        if (!mailbox) {
          console.log(`[send-test-email] No more mailboxes available for failover`);
          break;
        }

        triedMailboxIds.push(mailbox.mailbox_id);
        
        const domain = getDomainFromEmail(mailbox.smtp_from);
        const messageId = generateMessageId(domain);
        const useTls = mailbox.smtp_port === 465;

        console.log(`[send-test-email] Attempt ${attemptCount}/${maxFailovers} with mailbox ${mailbox.mailbox_id}`);

        const result = await sendEmailWithConfig(
          recipientEmail,
          emailSubject,
          {
            host: mailbox.smtp_host,
            port: mailbox.smtp_port,
            username: mailbox.smtp_user,
            password: String(mailbox.smtp_password),
            fromEmail: mailbox.smtp_from,
            fromName: "Nullsto",
            useTls
          },
          messageId,
          "DATABASE_MAILBOX"
        );

        // Log the attempt
        await logEmailAttempt(supabase, {
          mailboxId: mailbox.mailbox_id,
          recipientEmail,
          subject: emailSubject,
          status: result.success ? 'sent' : 'failed',
          errorCode: result.errorCode,
          errorMessage: result.error,
          smtpResponse: result.error,
          mailboxName: mailbox.smtp_from,
          smtpHost: mailbox.smtp_host,
          configSource: 'DATABASE_MAILBOX',
          messageId,
          attemptCount
        });

        if (result.success) {
          // Increment usage on success
          await incrementMailboxUsage(supabase, mailbox.mailbox_id);

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: `Test email sent successfully to ${recipientEmail}`,
              details: {
                recipient: recipientEmail,
                smtpServer: `${mailbox.smtp_host}:${mailbox.smtp_port}`,
                configSource: "DATABASE_MAILBOX",
                messageId,
                attemptCount,
                mailboxId: mailbox.mailbox_id
              },
              deliverabilityInfo: {
                checkSpam: true,
                spamHint: "If you don't see the email in your inbox, check your Spam/Junk folder.",
                spfDkimHint: "For better deliverability, ensure SPF and DKIM records are configured.",
                testTools: ["mail-tester.com", "mxtoolbox.com/deliverability"]
              }
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Handle failure - check if we should failover
        lastError = result.error || "Failed to send email";
        lastErrorCode = result.errorCode || "";

        // Mark mailbox as unhealthy for 550/rate limit errors
        if (result.errorCode === '550' || result.error?.includes('suspicious') || result.error?.includes('rate')) {
          console.log(`[send-test-email] Mailbox ${mailbox.mailbox_id} marked unhealthy, attempting failover...`);
          await markMailboxUnhealthy(supabase, mailbox.mailbox_id, result.error || 'Rate limited');
          continue; // Try next mailbox
        }

        // For auth errors (535) or other permanent failures, don't failover
        if (result.errorCode === '535') {
          console.log(`[send-test-email] Authentication error - not retrying`);
          break;
        }

        // For temporary errors, try once more with same mailbox before failover
        if (attemptCount < maxFailovers) {
          await sleep(2000);
        }
      }

      // Fallback to environment variables if no database mailboxes worked
      const envHost = Deno.env.get("SMTP_HOST");
      const envUser = Deno.env.get("SMTP_USER");
      const envPass = Deno.env.get("SMTP_PASSWORD");

      if (envHost && envUser && envPass && triedMailboxIds.length > 0) {
        console.log(`[send-test-email] Attempting fallback to environment variables`);
        
        const envPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
        const envFrom = Deno.env.get("SMTP_FROM") || envUser;
        const domain = getDomainFromEmail(envFrom);
        const messageId = generateMessageId(domain);
        
        const result = await sendEmailWithConfig(
          recipientEmail,
          emailSubject,
          {
            host: envHost,
            port: envPort,
            username: envUser,
            password: String(envPass),
            fromEmail: envFrom,
            fromName: "Nullsto",
            useTls: envPort === 465
          },
          messageId,
          "ENV_VARIABLES"
        );

        await logEmailAttempt(supabase, {
          mailboxId: null,
          recipientEmail,
          subject: emailSubject,
          status: result.success ? 'sent' : 'failed',
          errorCode: result.errorCode,
          errorMessage: result.error,
          smtpResponse: result.error,
          mailboxName: envFrom,
          smtpHost: envHost,
          configSource: 'ENV_VARIABLES',
          messageId,
          attemptCount: attemptCount + 1
        });

        if (result.success) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: `Test email sent successfully to ${recipientEmail}`,
              details: {
                recipient: recipientEmail,
                smtpServer: `${envHost}:${envPort}`,
                configSource: "ENV_VARIABLES",
                messageId
              },
              deliverabilityInfo: {
                checkSpam: true,
                spamHint: "If you don't see the email in your inbox, check your Spam/Junk folder."
              }
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        lastError = result.error || lastError;
        lastErrorCode = result.errorCode || lastErrorCode;
      }
    }

    // All attempts failed
    let errorMessage = lastError;
    let hint = "";
    let retryable = true;

    if (lastErrorCode === '535' || lastError.includes("Authentication") || lastError.includes("auth")) {
      errorMessage = "SMTP authentication failed.";
      hint = "Check your username and password are correct. Some providers require app-specific passwords.";
      retryable = false;
    } else if (lastError.includes("Connection") || lastError.includes("connect")) {
      errorMessage = "Could not connect to SMTP server.";
      hint = "Verify the host and port are correct and the server is reachable.";
    } else if (lastError.includes("TLS") || lastError.includes("SSL")) {
      errorMessage = "SSL/TLS connection failed.";
      hint = "Try changing the encryption setting (SSL for port 465, TLS for port 587).";
    } else if (lastErrorCode === '550' || lastError.includes("suspicious") || lastError.includes("rate")) {
      errorMessage = "All mailboxes are rate-limited or blocked.";
      hint = "Wait 1-2 hours for cooldown, or add more mailboxes in Admin → Mailboxes.";
      retryable = false;
    } else if (lastError.includes("lookup") || lastError.includes("DNS")) {
      errorMessage = "Could not resolve SMTP hostname.";
      hint = "Check that the SMTP host is correct.";
    }

    console.error(`[send-test-email] All ${attemptCount} attempts failed. Last error: ${lastError}`);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: hint ? `${errorMessage} ${hint}` : errorMessage,
        details: lastError,
        retryable,
        attemptsMade: attemptCount,
        mailboxesTried: triedMailboxIds.length,
        deliverabilityInfo: {
          checkSpam: true,
          spamHint: "If emails are being sent but not received, check your Spam/Junk folder.",
          commonIssues: [
            "All configured mailboxes are rate-limited",
            "Missing SPF/DKIM records",
            "Sending domain not verified",
            "Add more mailboxes for load balancing"
          ]
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[send-test-email] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage || "An unexpected error occurred",
        retryable: true
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});