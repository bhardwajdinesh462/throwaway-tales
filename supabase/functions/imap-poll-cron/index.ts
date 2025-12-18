import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[IMAP CRON] Starting scheduled IMAP poll at ${new Date().toISOString()}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get IMAP settings from environment
    const host = Deno.env.get("IMAP_HOST");
    const port = parseInt(Deno.env.get("IMAP_PORT") || "993");
    const username = Deno.env.get("IMAP_USER");
    const password = Deno.env.get("IMAP_PASSWORD");

    if (!host || !username || !password) {
      console.log("[IMAP CRON] IMAP configuration incomplete, skipping poll");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "IMAP configuration incomplete",
          skipped: true
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[IMAP CRON] Connecting to IMAP server: ${host}:${port}`);

    const conn = await Deno.connect({
      hostname: host,
      port: port,
    });

    // For TLS/SSL connections
    let secureConn: Deno.TlsConn | Deno.Conn = conn;
    if (port === 993) {
      secureConn = await Deno.startTls(conn, { hostname: host });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Helper to send commands and read responses
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
    const loginResponse = await sendCommand(`LOGIN "${username}" "${password}"`, tagNum++);
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
    const messageCount = existsMatch ? parseInt(existsMatch[1]) : 0;

    // Search for unseen messages
    const searchResponse = await sendCommand("SEARCH UNSEEN", tagNum++);
    const unseenMatch = searchResponse.match(/\* SEARCH ([\d\s]+)/);
    const unseenIds = unseenMatch ? unseenMatch[1].trim().split(/\s+/).filter(id => id) : [];

    console.log(`[IMAP CRON] Found ${messageCount} total, ${unseenIds.length} unseen messages`);

    const stats = { stored: 0, failed: 0, skipped: 0 };

    // Fetch the NEWEST unseen messages first (reverse and take last 20)
    const newestUnseenIds = unseenIds.slice(-20).reverse();
    console.log(`[IMAP CRON] Processing ${newestUnseenIds.length} newest unseen messages`);
    
    for (const msgId of newestUnseenIds) {
      try {
        const fetchResponse = await sendCommand(`FETCH ${msgId} (BODY[HEADER.FIELDS (FROM TO SUBJECT DATE)] BODY[TEXT])`, tagNum++);
        
        // Parse the email
        const fromMatch = fetchResponse.match(/From:\s*([^\r\n]+)/i);
        const toMatch = fetchResponse.match(/To:\s*([^\r\n]+)/i);
        const subjectMatch = fetchResponse.match(/Subject:\s*([^\r\n]+)/i);
        const dateMatch = fetchResponse.match(/Date:\s*([^\r\n]+)/i);
        
        // Extract email address from the To field
        const toAddress = toMatch?.[1]?.trim() || "";
        const toEmailMatch = toAddress.match(/<([^>]+)>/) || [null, toAddress];
        const recipientEmail = (toEmailMatch[1] || toAddress).toLowerCase();

        // Find the matching temp_email in our database
        const { data: tempEmail } = await supabase
          .from("temp_emails")
          .select("id")
          .eq("address", recipientEmail)
          .eq("is_active", true)
          .single();

        if (tempEmail) {
          // Extract body content
          const bodyStart = fetchResponse.indexOf("\r\n\r\n");
          const body = bodyStart > -1 ? fetchResponse.substring(bodyStart + 4) : "";

          // Store the email
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
            // Mark as seen in IMAP
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

    const duration = Date.now() - startTime;
    console.log(`[IMAP CRON] Complete: ${stats.stored} stored, ${stats.failed} failed, ${stats.skipped} skipped in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "IMAP poll complete",
        stats: {
          totalMessages: messageCount,
          unseenMessages: unseenIds.length,
          processed: unseenIds.slice(0, 20).length,
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
