import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IMAPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  useTLS: boolean;
  useSSL: boolean;
  mailbox: string;
  deleteAfterFetch: boolean;
}

interface ParsedEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
  htmlBody: string;
  receivedAt: Date;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      console.log("IMAP configuration incomplete");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "IMAP configuration is incomplete. Please configure IMAP settings in the admin panel.",
          configured: false
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Connecting to IMAP server: ${host}:${port}`);

    // Note: Deno doesn't have native IMAP support, so we'll implement a basic
    // IMAP client using Deno's TCP connections
    // For production, you might want to use a more robust solution

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
      console.log(`> ${fullCommand.trim()}`);
      
      await secureConn.write(encoder.encode(fullCommand));
      
      const buffer = new Uint8Array(65536);
      let response = "";
      
      while (true) {
        const bytesRead = await secureConn.read(buffer);
        if (bytesRead === null) break;
        
        const chunk = decoder.decode(buffer.subarray(0, bytesRead));
        response += chunk;
        
        // Check if we've received the complete response
        if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) {
          break;
        }
      }
      
      console.log(`< ${response.substring(0, 200)}...`);
      return response;
    };

    // Read server greeting
    const greeting = new Uint8Array(1024);
    await secureConn.read(greeting);
    console.log("Server greeting:", decoder.decode(greeting));

    let tagNum = 1;

    // Login
    const loginResponse = await sendCommand(`LOGIN "${username}" "${password}"`, tagNum++);
    if (!loginResponse.includes("OK")) {
      throw new Error("IMAP login failed: " + loginResponse);
    }

    // Select INBOX
    const selectResponse = await sendCommand("SELECT INBOX", tagNum++);
    if (!selectResponse.includes("OK")) {
      throw new Error("Failed to select INBOX: " + selectResponse);
    }

    // Extract message count
    const existsMatch = selectResponse.match(/\* (\d+) EXISTS/);
    const messageCount = existsMatch ? parseInt(existsMatch[1]) : 0;
    console.log(`Found ${messageCount} messages in INBOX`);

    // Search for unseen messages
    const searchResponse = await sendCommand("SEARCH UNSEEN", tagNum++);
    const unseenMatch = searchResponse.match(/\* SEARCH ([\d\s]+)/);
    const unseenIds = unseenMatch ? unseenMatch[1].trim().split(/\s+/).filter(id => id) : [];
    console.log(`Found ${unseenIds.length} unseen messages`);

    const fetchedEmails: ParsedEmail[] = [];
    const storedCount = { success: 0, failed: 0 };

    // Fetch the NEWEST unseen messages first (reverse the array and take last 50)
    const newestUnseenIds = unseenIds.slice(-50).reverse();
    console.log(`Processing ${newestUnseenIds.length} newest unseen messages`);
    
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
        const recipientEmail = toEmailMatch[1] || toAddress;

        // Find the matching temp_email in our database
        const { data: tempEmail } = await supabase
          .from("temp_emails")
          .select("id")
          .eq("address", recipientEmail.toLowerCase())
          .eq("is_active", true)
          .single();

        if (tempEmail) {
          // Extract body content (simplified - real implementation would need MIME parsing)
          const bodyStart = fetchResponse.indexOf("\r\n\r\n");
          const body = bodyStart > -1 ? fetchResponse.substring(bodyStart + 4) : "";

          // Store the email
          const { error: insertError } = await supabase
            .from("received_emails")
            .insert({
              temp_email_id: tempEmail.id,
              from_address: fromMatch?.[1]?.trim() || "unknown@unknown.com",
              subject: subjectMatch?.[1]?.trim() || "(No Subject)",
              body: body.substring(0, 10000), // Limit body size
              html_body: body.includes("<html") ? body.substring(0, 50000) : null,
              is_read: false,
              received_at: dateMatch?.[1] ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
            });

          if (insertError) {
            console.error("Error storing email:", insertError);
            storedCount.failed++;
          } else {
            storedCount.success++;
            console.log(`Stored email for ${recipientEmail}`);
            
            // Mark as seen in IMAP
            await sendCommand(`STORE ${msgId} +FLAGS (\\Seen)`, tagNum++);
          }
        } else {
          console.log(`No matching temp email found for ${recipientEmail}`);
        }

        fetchedEmails.push({
          from: fromMatch?.[1]?.trim() || "unknown",
          to: recipientEmail,
          subject: subjectMatch?.[1]?.trim() || "(No Subject)",
          body: "",
          htmlBody: "",
          receivedAt: new Date(),
        });

      } catch (emailError) {
        console.error(`Error processing message ${msgId}:`, emailError);
        storedCount.failed++;
      }
    }

    // Logout
    await sendCommand("LOGOUT", tagNum++);
    secureConn.close();

    console.log(`Fetch complete: ${storedCount.success} stored, ${storedCount.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Fetched and processed ${unseenIds.length} emails`,
        stats: {
          totalMessages: messageCount,
          unseenMessages: unseenIds.length,
          stored: storedCount.success,
          failed: storedCount.failed,
          fetchedAt: new Date().toISOString()
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("IMAP fetch error:", error);
    
    let errorMessage = error.message || "Failed to fetch emails";
    
    if (errorMessage.includes("Connection refused")) {
      errorMessage = "Could not connect to IMAP server. Please check the host and port.";
    } else if (errorMessage.includes("login failed") || errorMessage.includes("authentication")) {
      errorMessage = "IMAP authentication failed. Please check your username and password.";
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
