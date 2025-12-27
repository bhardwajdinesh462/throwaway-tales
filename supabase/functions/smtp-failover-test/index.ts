import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MailboxResult {
  mailbox_id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
}

interface AttemptResult {
  attemptNumber: number;
  mailboxId: string;
  smtpHost: string;
  smtpFrom: string;
  success: boolean;
  error?: string;
  forcedFailure?: boolean;
}

async function trySendEmail(
  mailbox: MailboxResult,
  recipientEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    
    const client = new SMTPClient({
      connection: {
        hostname: mailbox.smtp_host,
        port: mailbox.smtp_port,
        tls: mailbox.smtp_port === 465,
        auth: {
          username: mailbox.smtp_user,
          password: mailbox.smtp_password,
        },
      },
    });

    await client.send({
      from: mailbox.smtp_from,
      to: recipientEmail,
      subject: "SMTP Failover Test - Success",
      content: "This email confirms that SMTP failover is working correctly.",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>✅ SMTP Failover Test Successful</h2>
          <p>This email was sent after the failover mechanism worked correctly.</p>
          <p><strong>Mailbox used:</strong> ${mailbox.smtp_from}</p>
          <p><strong>SMTP Host:</strong> ${mailbox.smtp_host}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
      `,
    });

    await client.close();
    return { success: true };
  } catch (error: any) {
    console.error(`Send failed for ${mailbox.smtp_host}:`, error.message);
    return { success: false, error: error.message || "Unknown error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail, forceFirstFailure = true } = await req.json();

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "recipientEmail is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const attempts: AttemptResult[] = [];
    const MAX_ATTEMPTS = 5;
    let succeeded = false;
    let successMailboxId: string | null = null;
    let successFrom: string | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !succeeded; attempt++) {
      console.log(`[Failover Test] Attempt ${attempt}/${MAX_ATTEMPTS}`);

      // Select the next available mailbox
      const { data: mailboxData, error: mailboxError } = await supabase.rpc("select_available_mailbox");

      if (mailboxError || !mailboxData || mailboxData.length === 0) {
        console.log(`[Failover Test] No mailbox available on attempt ${attempt}`);
        attempts.push({
          attemptNumber: attempt,
          mailboxId: "none",
          smtpHost: "N/A",
          smtpFrom: "N/A",
          success: false,
          error: mailboxError?.message || "No available mailbox",
        });
        break;
      }

      const mailbox = mailboxData[0] as MailboxResult;
      console.log(`[Failover Test] Selected mailbox: ${mailbox.mailbox_id} (${mailbox.smtp_host})`);

      // On the first attempt, optionally force a failure to test the failover
      if (attempt === 1 && forceFirstFailure) {
        console.log(`[Failover Test] Forcing failure on attempt 1 to test failover`);
        
        // Record error for this mailbox so it gets excluded on next selection
        await supabase.rpc("record_mailbox_error", {
          p_mailbox_id: mailbox.mailbox_id,
          p_error: "Forced failure for failover test",
        });

        attempts.push({
          attemptNumber: attempt,
          mailboxId: mailbox.mailbox_id,
          smtpHost: mailbox.smtp_host,
          smtpFrom: mailbox.smtp_from,
          success: false,
          error: "Forced failure for failover test",
          forcedFailure: true,
        });

        continue;
      }

      // Actually try to send
      const sendResult = await trySendEmail(mailbox, recipientEmail);

      if (sendResult.success) {
        console.log(`[Failover Test] Success on attempt ${attempt} with mailbox ${mailbox.mailbox_id}`);
        attempts.push({
          attemptNumber: attempt,
          mailboxId: mailbox.mailbox_id,
          smtpHost: mailbox.smtp_host,
          smtpFrom: mailbox.smtp_from,
          success: true,
        });
        succeeded = true;
        successMailboxId = mailbox.mailbox_id;
        successFrom = mailbox.smtp_from;

        // Increment usage counter
        await supabase.rpc("increment_mailbox_usage", { p_mailbox_id: mailbox.mailbox_id });
      } else {
        console.log(`[Failover Test] Failed on attempt ${attempt}: ${sendResult.error}`);
        
        // Record error so this mailbox is excluded from next selection
        await supabase.rpc("record_mailbox_error", {
          p_mailbox_id: mailbox.mailbox_id,
          p_error: sendResult.error || "Send failed",
        });

        attempts.push({
          attemptNumber: attempt,
          mailboxId: mailbox.mailbox_id,
          smtpHost: mailbox.smtp_host,
          smtpFrom: mailbox.smtp_from,
          success: false,
          error: sendResult.error,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: succeeded,
        attempts,
        totalAttempts: attempts.length,
        succeededMailboxId: successMailboxId,
        succeededFrom: successFrom,
        message: succeeded
          ? `Email sent successfully on attempt ${attempts.length} via ${successFrom}`
          : `All ${attempts.length} attempts failed`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Failover Test] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
