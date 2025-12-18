import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
  htmlBody: string;
  receivedAt: Date;
}

// Decode quoted-printable encoding
function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '') // Remove soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Decode base64 encoding
function decodeBase64(str: string): string {
  try {
    const cleaned = str.replace(/\r?\n/g, '');
    return atob(cleaned);
  } catch {
    return str;
  }
}

// Parse MIME multipart content to extract text and HTML parts
function parseMimeContent(rawContent: string): { text: string; html: string } {
  let text = '';
  let html = '';
  
  // Check if it's multipart
  const boundaryMatch = rawContent.match(/boundary[=\s]*"?([^"\r\n;]+)"?/i);
  
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = rawContent.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    
    for (const part of parts) {
      if (part.trim() === '' || part.trim() === '--') continue;
      
      const headerEndIndex = part.indexOf('\r\n\r\n');
      if (headerEndIndex === -1) continue;
      
      const headers = part.substring(0, headerEndIndex).toLowerCase();
      let content = part.substring(headerEndIndex + 4);
      
      // Remove trailing boundary markers
      const nextBoundaryIndex = content.indexOf('--');
      if (nextBoundaryIndex > 0) {
        content = content.substring(0, nextBoundaryIndex);
      }
      
      // Check content transfer encoding
      const isQuotedPrintable = headers.includes('quoted-printable');
      const isBase64 = headers.includes('base64');
      
      if (isQuotedPrintable) {
        content = decodeQuotedPrintable(content);
      } else if (isBase64) {
        content = decodeBase64(content);
      }
      
      // Determine content type
      if (headers.includes('text/html')) {
        html = content.trim();
      } else if (headers.includes('text/plain')) {
        text = content.trim();
      }
    }
  } else {
    // Not multipart - check for encoding in the content itself
    const headerEndIndex = rawContent.indexOf('\r\n\r\n');
    if (headerEndIndex > -1) {
      const headers = rawContent.substring(0, headerEndIndex).toLowerCase();
      let content = rawContent.substring(headerEndIndex + 4);
      
      const isQuotedPrintable = headers.includes('quoted-printable');
      const isBase64 = headers.includes('base64');
      
      if (isQuotedPrintable) {
        content = decodeQuotedPrintable(content);
      } else if (isBase64) {
        content = decodeBase64(content);
      }
      
      if (headers.includes('text/html')) {
        html = content.trim();
      } else {
        text = content.trim();
      }
    } else {
      text = rawContent.trim();
    }
  }
  
  // Clean up any remaining IMAP artifacts
  text = text.replace(/^BODY\[TEXT\]\s*\{\d+\}/gm, '').trim();
  html = html.replace(/^BODY\[TEXT\]\s*\{\d+\}/gm, '').trim();
  
  // Remove IMAP command suffixes
  text = text.replace(/\)\s*A\d{4}\s+OK\s+.*$/s, '').trim();
  html = html.replace(/\)\s*A\d{4}\s+OK\s+.*$/s, '').trim();
  
  return { text, html };
}

// Extract clean text from HTML
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const conn = await Deno.connect({
      hostname: host,
      port: port,
    });

    let secureConn: Deno.TlsConn | Deno.Conn = conn;
    if (port === 993) {
      secureConn = await Deno.startTls(conn, { hostname: host });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const sendCommand = async (command: string, tagNum: number): Promise<string> => {
      const tag = `A${tagNum.toString().padStart(4, '0')}`;
      const fullCommand = `${tag} ${command}\r\n`;
      console.log(`> ${fullCommand.trim()}`);
      
      await secureConn.write(encoder.encode(fullCommand));
      
      const buffer = new Uint8Array(131072); // 128KB buffer for larger emails
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
      
      console.log(`< Response length: ${response.length} chars`);
      return response;
    };

    const greeting = new Uint8Array(1024);
    await secureConn.read(greeting);
    console.log("Server greeting received");

    let tagNum = 1;

    const loginResponse = await sendCommand(`LOGIN "${username}" "${password}"`, tagNum++);
    if (!loginResponse.includes("OK")) {
      throw new Error("IMAP login failed: " + loginResponse);
    }

    const selectResponse = await sendCommand("SELECT INBOX", tagNum++);
    if (!selectResponse.includes("OK")) {
      throw new Error("Failed to select INBOX: " + selectResponse);
    }

    const existsMatch = selectResponse.match(/\* (\d+) EXISTS/);
    const messageCount = existsMatch ? parseInt(existsMatch[1]) : 0;
    console.log(`Found ${messageCount} messages in INBOX`);

    const searchResponse = await sendCommand("SEARCH UNSEEN", tagNum++);
    const unseenMatch = searchResponse.match(/\* SEARCH ([\d\s]+)/);
    const unseenIds = unseenMatch ? unseenMatch[1].trim().split(/\s+/).filter(id => id) : [];
    console.log(`Found ${unseenIds.length} unseen messages`);

    const storedCount = { success: 0, failed: 0, skipped: 0 };

    // Fetch the NEWEST unseen messages first
    const newestUnseenIds = unseenIds.slice(-50).reverse();
    console.log(`Processing ${newestUnseenIds.length} newest unseen messages`);
    
    for (const msgId of newestUnseenIds) {
      try {
        // Fetch full message including body
        const fetchResponse = await sendCommand(`FETCH ${msgId} (BODY[HEADER] BODY[TEXT])`, tagNum++);
        
        // Parse headers
        const fromMatch = fetchResponse.match(/From:\s*([^\r\n]+)/i);
        const toMatch = fetchResponse.match(/To:\s*([^\r\n]+)/i);
        const subjectMatch = fetchResponse.match(/Subject:\s*([^\r\n]+)/i);
        const dateMatch = fetchResponse.match(/Date:\s*([^\r\n]+)/i);
        const contentTypeMatch = fetchResponse.match(/Content-Type:\s*([^\r\n]+)/i);
        
        // Extract recipient email
        const toAddress = toMatch?.[1]?.trim() || "";
        const toEmailMatch = toAddress.match(/<([^>]+)>/) || [null, toAddress];
        const recipientEmail = (toEmailMatch[1] || toAddress).toLowerCase().trim();

        // Extract sender email (clean it up)
        let fromAddress = fromMatch?.[1]?.trim() || "unknown@unknown.com";
        const fromEmailMatch = fromAddress.match(/<([^>]+)>/);
        if (fromEmailMatch) {
          const displayName = fromAddress.replace(/<[^>]+>/, '').trim().replace(/^"|"$/g, '');
          fromAddress = displayName ? `${displayName} <${fromEmailMatch[1]}>` : fromEmailMatch[1];
        }

        // Decode subject if encoded
        let subject = subjectMatch?.[1]?.trim() || "(No Subject)";
        const encodedSubjectMatch = subject.match(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/i);
        if (encodedSubjectMatch) {
          const [, charset, encoding, encodedText] = encodedSubjectMatch;
          if (encoding.toUpperCase() === 'B') {
            try {
              subject = decodeBase64(encodedText);
            } catch {}
          } else if (encoding.toUpperCase() === 'Q') {
            subject = decodeQuotedPrintable(encodedText.replace(/_/g, ' '));
          }
        }

        // Find the matching temp_email
        const { data: tempEmail } = await supabase
          .from("temp_emails")
          .select("id")
          .eq("address", recipientEmail)
          .eq("is_active", true)
          .single();

        if (tempEmail) {
          // Extract body content from BODY[TEXT]
          const bodyTextMatch = fetchResponse.match(/BODY\[TEXT\]\s*\{(\d+)\}/);
          let rawBody = '';
          
          if (bodyTextMatch) {
            const bodyLength = parseInt(bodyTextMatch[1]);
            const bodyStartIndex = fetchResponse.indexOf(bodyTextMatch[0]) + bodyTextMatch[0].length + 2;
            rawBody = fetchResponse.substring(bodyStartIndex, bodyStartIndex + bodyLength);
          } else {
            // Fallback: try to extract after double CRLF
            const bodyStart = fetchResponse.lastIndexOf('\r\n\r\n');
            if (bodyStart > -1) {
              rawBody = fetchResponse.substring(bodyStart + 4);
            }
          }

          // Include content-type header for MIME parsing
          const contentType = contentTypeMatch?.[1] || '';
          const fullContent = contentType.includes('multipart') 
            ? `Content-Type: ${contentType}\r\n\r\n${rawBody}`
            : rawBody;

          // Parse MIME content
          const { text, html } = parseMimeContent(fullContent);
          
          // Use text body or extract from HTML
          let finalTextBody = text;
          let finalHtmlBody = html;
          
          if (!finalTextBody && finalHtmlBody) {
            finalTextBody = extractTextFromHtml(finalHtmlBody);
          }
          
          if (!finalTextBody && !finalHtmlBody) {
            // Last resort: clean up raw body
            finalTextBody = rawBody
              .replace(/--[^\r\n]+/g, '')
              .replace(/Content-[^\r\n]+/gi, '')
              .replace(/\r?\n/g, '\n')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
          }

          // Store the email
          const { error: insertError } = await supabase
            .from("received_emails")
            .insert({
              temp_email_id: tempEmail.id,
              from_address: fromAddress,
              subject: subject,
              body: finalTextBody.substring(0, 10000),
              html_body: finalHtmlBody ? finalHtmlBody.substring(0, 50000) : null,
              is_read: false,
              received_at: dateMatch?.[1] ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
            });

          if (insertError) {
            if (insertError.code === '23505') {
              console.log(`Email already exists for ${recipientEmail}`);
              storedCount.skipped++;
            } else {
              console.error("Error storing email:", insertError);
              storedCount.failed++;
            }
          } else {
            storedCount.success++;
            console.log(`Stored email for ${recipientEmail}: "${subject}"`);
            
            // Mark as seen in IMAP
            await sendCommand(`STORE ${msgId} +FLAGS (\\Seen)`, tagNum++);
          }
        } else {
          console.log(`No matching temp email found for ${recipientEmail}`);
          storedCount.skipped++;
        }

      } catch (emailError) {
        console.error(`Error processing message ${msgId}:`, emailError);
        storedCount.failed++;
      }
    }

    await sendCommand("LOGOUT", tagNum++);
    secureConn.close();

    console.log(`Fetch complete: ${storedCount.success} stored, ${storedCount.failed} failed, ${storedCount.skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Fetched and processed ${newestUnseenIds.length} emails`,
        stats: {
          totalMessages: messageCount,
          unseenMessages: unseenIds.length,
          stored: storedCount.success,
          failed: storedCount.failed,
          skipped: storedCount.skipped,
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
