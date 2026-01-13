import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImapCandidate {
  id: string | null;
  host: string;
  port: number;
  username: string;
  password: string;
  source: "database" | "environment";
  name: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[IMAP CRON] Starting scheduled IMAP poll at ${new Date().toISOString()}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build candidates from database and environment
    const candidates: ImapCandidate[] = [];

    // 1. Get mailboxes from database (prioritize these)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    const { data: mailboxes, error: mailboxError } = await supabase
      .from("mailboxes")
      .select("id, name, imap_host, imap_port, imap_user, is_primary, priority, last_error_at")
      .eq("is_active", true)
      .not("imap_host", "is", null)
      .not("imap_user", "is", null)
      .order("is_primary", { ascending: false })
      .order("priority", { ascending: false });

    if (mailboxError) {
      console.error("[IMAP CRON] Error fetching mailboxes:", mailboxError);
    } else if (mailboxes && mailboxes.length > 0) {
      console.log(`[IMAP CRON] Found ${mailboxes.length} mailboxes in database`);
      
      for (const mb of mailboxes) {
        // Skip mailboxes with recent errors (15-minute cooldown)
        if (mb.last_error_at && new Date(mb.last_error_at) > new Date(fifteenMinutesAgo)) {
          console.log(`[IMAP CRON] Skipping mailbox ${mb.name} - recent error at ${mb.last_error_at}`);
          continue;
        }

        // Get decrypted password via RPC
        try {
          const { data: password, error: pwError } = await supabase.rpc(
            "get_mailbox_imap_password",
            { p_mailbox_id: mb.id }
          );

          if (pwError || !password) {
            console.error(`[IMAP CRON] Failed to get password for mailbox ${mb.name}:`, pwError);
            continue;
          }

          candidates.push({
            id: mb.id,
            host: mb.imap_host,
            port: mb.imap_port || 993,
            username: mb.imap_user,
            password: password,
            source: "database",
            name: mb.name,
          });
        } catch (e) {
          console.error(`[IMAP CRON] Error getting password for ${mb.name}:`, e);
        }
      }
    }

    // 2. Add environment fallback
    const envHost = Deno.env.get("IMAP_HOST");
    const envUser = Deno.env.get("IMAP_USER");
    const envPassword = Deno.env.get("IMAP_PASSWORD");
    
    if (envHost && envUser && envPassword) {
      candidates.push({
        id: null,
        host: envHost,
        port: parseInt(Deno.env.get("IMAP_PORT") || "993"),
        username: envUser,
        password: envPassword,
        source: "environment",
        name: "Environment Config",
      });
    }

    if (candidates.length === 0) {
      console.log("[IMAP CRON] No IMAP configurations available, skipping poll");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No IMAP configuration available",
          skipped: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[IMAP CRON] Will try ${candidates.length} IMAP candidates`);

    let successfulCandidate: ImapCandidate | null = null;
    let lastError: string | null = null;
    let stats = { stored: 0, failed: 0, skipped: 0 };
    let messageCount = 0;
    let unseenCount = 0;

    // Try each candidate until one succeeds
    for (const candidate of candidates) {
      console.log(`[IMAP CRON] Trying ${candidate.source} mailbox: ${candidate.name} (${candidate.host}:${candidate.port})`);
      
      try {
        const conn = await Deno.connect({
          hostname: candidate.host,
          port: candidate.port,
        });

        let secureConn: Deno.TlsConn | Deno.Conn = conn;
        if (candidate.port === 993) {
          secureConn = await Deno.startTls(conn, { hostname: candidate.host });
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const sendCommand = async (command: string, tagNum: number): Promise<string> => {
          const tag = `A${tagNum.toString().padStart(4, '0')}`;
          const fullCommand = `${tag} ${command}\r\n`;
          
          await secureConn.write(encoder.encode(fullCommand));
          
          const buffer = new Uint8Array(65536);
          let response = "";
          
          while (true) {
            const bytesRead = await secureConn.read(buffer);
            if (bytesRead === null) break;
            
            const chunk = decoder.decode(buffer.subarray(0, bytesRead));
            response += chunk;
            
            if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) {
              break;
            }
          }
          
          return response;
        };

        // Read server greeting
        const greeting = new Uint8Array(1024);
        await secureConn.read(greeting);

        let tagNum = 1;

        // Login
        const loginResponse = await sendCommand(`LOGIN "${candidate.username}" "${candidate.password}"`, tagNum++);
        if (!loginResponse.includes("OK")) {
          throw new Error("IMAP login failed");
        }

        // Select INBOX
        const selectResponse = await sendCommand("SELECT INBOX", tagNum++);
        if (!selectResponse.includes("OK")) {
          throw new Error("Failed to select INBOX");
        }

        // Extract message count
        const existsMatch = selectResponse.match(/\* (\d+) EXISTS/);
        messageCount = existsMatch ? parseInt(existsMatch[1]) : 0;

        // Search for unseen messages
        const searchResponse = await sendCommand("SEARCH UNSEEN", tagNum++);
        const unseenMatch = searchResponse.match(/\* SEARCH ([\d\s]+)/);
        const unseenIds = unseenMatch ? unseenMatch[1].trim().split(/\s+/).filter(id => id) : [];
        unseenCount = unseenIds.length;

        console.log(`[IMAP CRON] Found ${messageCount} total, ${unseenCount} unseen messages`);

        // Fetch the NEWEST unseen messages first (reverse and take last 20)
        const newestUnseenIds = unseenIds.slice(-20).reverse();
        console.log(`[IMAP CRON] Processing ${newestUnseenIds.length} newest unseen messages`);
        
        for (const msgId of newestUnseenIds) {
          try {
            const fetchResponse = await sendCommand(`FETCH ${msgId} (BODY[HEADER.FIELDS (FROM TO SUBJECT DATE)] BODY[TEXT])`, tagNum++);
            
            const fromMatch = fetchResponse.match(/From:\s*([^\r\n]+)/i);
            const toMatch = fetchResponse.match(/To:\s*([^\r\n]+)/i);
            const subjectMatch = fetchResponse.match(/Subject:\s*([^\r\n]+)/i);
            const dateMatch = fetchResponse.match(/Date:\s*([^\r\n]+)/i);
            
            const toAddress = toMatch?.[1]?.trim() || "";
            const toEmailMatch = toAddress.match(/<([^>]+)>/) || [null, toAddress];
            const recipientEmail = (toEmailMatch[1] || toAddress).toLowerCase().trim();

            console.log(`[IMAP CRON] Processing email to: ${recipientEmail}`);

            // Use case-insensitive matching with ilike
            const { data: tempEmail, error: tempEmailError } = await supabase
              .from("temp_emails")
              .select("id")
              .ilike("address", recipientEmail)
              .eq("is_active", true)
              .single();

            if (tempEmailError && tempEmailError.code !== 'PGRST116') {
              console.error(`[IMAP CRON] Error finding temp email:`, tempEmailError);
            }

            if (tempEmail) {
              const bodyStart = fetchResponse.indexOf("\r\n\r\n");
              const body = bodyStart > -1 ? fetchResponse.substring(bodyStart + 4) : "";

              const { error: insertError } = await supabase
                .from("received_emails")
                .insert({
                  temp_email_id: tempEmail.id,
                  from_address: fromMatch?.[1]?.trim() || "unknown@unknown.com",
                  subject: subjectMatch?.[1]?.trim() || "(No Subject)",
                  body: body.substring(0, 10000),
                  html_body: body.includes("<html") ? body.substring(0, 50000) : null,
                  is_read: false,
                  received_at: dateMatch?.[1] ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
                });

              if (insertError) {
                console.error(`[IMAP CRON] Error storing email:`, insertError);
                stats.failed++;
              } else {
                stats.stored++;
                await sendCommand(`STORE ${msgId} +FLAGS (\\Seen)`, tagNum++);
              }
            } else {
              stats.skipped++;
            }
          } catch (emailError) {
            console.error(`[IMAP CRON] Error processing message ${msgId}:`, emailError);
            stats.failed++;
          }
        }

        // Logout
        await sendCommand("LOGOUT", tagNum++);
        secureConn.close();

        // Success! Update mailbox status
        successfulCandidate = candidate;
        
        if (candidate.id) {
          await supabase
            .from("mailboxes")
            .update({ 
              last_polled_at: new Date().toISOString(),
              last_error: null,
              last_error_at: null 
            })
            .eq("id", candidate.id);
        }
        
        break; // Exit loop on success

      } catch (error: any) {
        lastError = error.message || String(error);
        console.error(`[IMAP CRON] Failed with ${candidate.name}:`, lastError);
        
        // Record error for database mailboxes
        if (candidate.id) {
          await supabase.rpc("record_mailbox_error", {
            p_mailbox_id: candidate.id,
            p_error: (lastError || "Unknown error").substring(0, 500)
          });
        }
        
        // Continue to next candidate
      }
    }

    const duration = Date.now() - startTime;

    if (!successfulCandidate) {
      console.error(`[IMAP CRON] All ${candidates.length} candidates failed. Last error: ${lastError}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `All IMAP candidates failed. Last error: ${lastError}`,
          candidatesTried: candidates.length,
          timestamp: new Date().toISOString()
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[IMAP CRON] Complete using ${successfulCandidate.name}: ${stats.stored} stored, ${stats.failed} failed, ${stats.skipped} skipped in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "IMAP poll complete",
        mailboxUsed: successfulCandidate.name,
        mailboxSource: successfulCandidate.source,
        stats: {
          totalMessages: messageCount,
          unseenMessages: unseenCount,
          processed: Math.min(unseenCount, 20),
          stored: stats.stored,
          failed: stats.failed,
          skipped: stats.skipped,
          durationMs: duration,
          timestamp: new Date().toISOString()
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[IMAP CRON] Error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "IMAP poll failed",
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
