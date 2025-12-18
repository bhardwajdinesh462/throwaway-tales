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

  // Strip IMAP protocol artifacts if they leaked into storage
  const cleaned = rawContent
    .replace(/^\s*BODY\[TEXT\]\s*\{\d+\}\s*\r?\n?/gmi, '')
    .replace(/\r?\n\)\r?\nA\d{4}\s+(OK|NO|BAD)[\s\S]*$/i, '')
    .trim();

  const boundaryParam = cleaned.match(/boundary[=\s]*"?([^"\r\n;]+)"?/i)?.[1];
  const boundaryFromBody = cleaned.match(/^\s*--([^\r\n]+)\r?\n/)?.[1]?.trim();
  const boundary = boundaryParam || boundaryFromBody;

  const parseSinglePart = (content: string) => {
    const headerEndCrLf = content.indexOf('\r\n\r\n');
    const headerEndLf = headerEndCrLf === -1 ? content.indexOf('\n\n') : -1;
    const headerEnd = headerEndCrLf !== -1 ? headerEndCrLf : headerEndLf;
    const sepLen = headerEndCrLf !== -1 ? 4 : 2;

    if (headerEnd === -1) {
      return { headers: '', body: content };
    }

    return {
      headers: content.substring(0, headerEnd),
      body: content.substring(headerEnd + sepLen),
    };
  };

  const decodePart = (headersLower: string, body: string) => {
    if (headersLower.includes('quoted-printable')) return decodeQuotedPrintable(body);
    if (headersLower.includes('base64')) return decodeBase64(body);
    return body;
  };

  if (!boundary) {
    const { headers, body } = parseSinglePart(cleaned);
    const headersLower = headers.toLowerCase();
    const decoded = decodePart(headersLower, body).trim();

    if (headersLower.includes('text/html')) html = decoded;
    else text = decoded;

    return { text, html };
  }

  const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = cleaned.split(new RegExp(`--${escapedBoundary}`));

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === '--') continue;

    const normalizedPart = part.replace(/^\r?\n/, '');
    const { headers, body } = parseSinglePart(normalizedPart);
    const headersLower = headers.toLowerCase();

    const decoded = decodePart(headersLower, body).trim();

    if (!decoded) continue;

    if (headersLower.includes('text/html')) {
      if (!html) html = decoded;
    } else if (headersLower.includes('text/plain')) {
      if (!text) text = decoded;
    }
  }

  return { text: text.trim(), html: html.trim() };
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

    // Load allowed domains so we can reliably match recipient emails
    const { data: activeDomains, error: domainsError } = await supabase
      .from("domains")
      .select("name")
      .eq("is_active", true);

    if (domainsError) {
      console.error("Failed to load domains:", domainsError);
    }

    const allowedDomainSuffixes = (activeDomains || [])
      .map((d: any) => String(d.name || "").toLowerCase())
      .map((name) => (name.startsWith("@") ? name.slice(1) : name))
      .filter(Boolean);

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
        
        // Extract recipient email (prefer envelope/delivery headers; fall back to any matching domain)
        const toAddress = toMatch?.[1]?.trim() || "";

        const allEmails = (fetchResponse.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [])
          .map((e) => e.toLowerCase().trim());

        const domainMatched = allowedDomainSuffixes.length
          ? allEmails.filter((e) => allowedDomainSuffixes.some((suffix) => e.endsWith(suffix))).pop()
          : undefined;

        // Fallback: parse the To: header specifically
        const toEmailMatch = toAddress.match(/<([^>]+)>/) || [null, toAddress];
        const recipientEmail = (domainMatched || (toEmailMatch[1] || toAddress)).toLowerCase().trim();

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
          // Extract body content from BODY[TEXT] {n}\r\n... using the IMAP byte count
          let rawBody = '';
          const bodyMarker = /BODY\[TEXT\]\s*\{(\d+)\}\r?\n/i.exec(fetchResponse);

          if (bodyMarker && typeof bodyMarker.index === 'number') {
            const bodyLength = parseInt(bodyMarker[1], 10);
            const bodyStartIndex = bodyMarker.index + bodyMarker[0].length;
            rawBody = fetchResponse.slice(bodyStartIndex, bodyStartIndex + bodyLength);
          } else {
            // Fallback: take everything after the last header/body separator
            const bodyStart = fetchResponse.lastIndexOf('\r\n\r\n');
            rawBody = bodyStart > -1 ? fetchResponse.substring(bodyStart + 4) : fetchResponse;
          }

          // Parse MIME content (also strips IMAP protocol artifacts)
          const { text, html } = parseMimeContent(rawBody);

          // Use text body or extract from HTML
          let finalTextBody = text;
          let finalHtmlBody = html;

          if (!finalTextBody && finalHtmlBody) {
            finalTextBody = extractTextFromHtml(finalHtmlBody);
          }

          if (!finalTextBody && !finalHtmlBody) {
            finalTextBody = rawBody.trim();
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
               // Mark as seen to avoid re-processing the same message forever
               await sendCommand(`STORE ${msgId} +FLAGS (\\Seen)`, tagNum++);
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
           // Mark as seen so we can move past irrelevant/old messages and keep polling fast
           await sendCommand(`STORE ${msgId} +FLAGS (\\Seen)`, tagNum++);
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
