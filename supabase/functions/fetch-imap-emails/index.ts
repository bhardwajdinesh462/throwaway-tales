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

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

// Decode quoted-printable encoding
function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '') // Remove soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Decode base64 encoding with UTF-8 support
function decodeBase64(str: string): string {
  try {
    const cleaned = str.replace(/[\r\n\s]/g, '');
    // Handle potential padding issues
    const padded = cleaned + '='.repeat((4 - cleaned.length % 4) % 4);
    const binaryStr = atob(padded);
    
    // Try to decode as UTF-8
    try {
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      // Fallback to raw decoded string
      return binaryStr;
    }
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

  const decodePart = (headersLower: string, body: string): string => {
    let decoded = body;
    
    // Detect and decode base64 content
    if (headersLower.includes('base64')) {
      // Clean base64: remove line breaks and whitespace
      const cleanBase64 = body.replace(/[\r\n\s]/g, '');
      decoded = decodeBase64(cleanBase64);
    } else if (headersLower.includes('quoted-printable')) {
      decoded = decodeQuotedPrintable(body);
    }
    
    // Clean up any remaining MIME boundary artifacts from decoded content
    decoded = decoded
      .replace(/--b\d+=_[^\r\n]+/g, '') // Remove boundary markers like --b1=_xxx
      .replace(/Content-Type:\s*[^\r\n]+/gi, '') // Remove Content-Type headers that leaked
      .replace(/Content-Transfer-Encoding:\s*[^\r\n]+/gi, '') // Remove encoding headers
      .replace(/boundary="?[^"\r\n]+"?/gi, '') // Remove boundary declarations
      .replace(/^\s*[\r\n]+/, '') // Remove leading empty lines
      .trim();
    
    return decoded;
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

    // Recursively handle nested multipart content
    const nestedBoundary = headers.match(/boundary[=\s]*"?([^"\r\n;]+)"?/i)?.[1];
    if (nestedBoundary) {
      const nestedResult = parseMimeContent(body);
      if (nestedResult.text && !text) text = nestedResult.text;
      if (nestedResult.html && !html) html = nestedResult.html;
      continue;
    }

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

  // Request options (defaults keep polling fast)
  let mode: 'latest' | 'unseen' = 'latest';
  let limit = 10;
  try {
    const body = await req.json();
    if (body?.mode === 'unseen' || body?.mode === 'latest') mode = body.mode;
    if (typeof body?.limit === 'number' && Number.isFinite(body.limit)) {
      limit = Math.max(1, Math.min(50, Math.floor(body.limit)));
    }
  } catch {
    // ignore (e.g. empty body)
  }

  console.log(`[IMAP] Starting fetch - mode: ${mode}, limit: ${limit}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const host = Deno.env.get("IMAP_HOST");
    const port = parseInt(Deno.env.get("IMAP_PORT") || "993");
    const username = Deno.env.get("IMAP_USER");
    const password = Deno.env.get("IMAP_PASSWORD");

    if (!host || !username || !password) {
      console.log("[IMAP] Configuration incomplete");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "IMAP configuration is incomplete. Please configure IMAP settings in the admin panel.",
          configured: false
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[IMAP] Connecting to ${host}:${port}`);

    // Load allowed domains so we can reliably match recipient emails
    const { data: activeDomains, error: domainsError } = await supabase
      .from("domains")
      .select("name")
      .eq("is_active", true);

    if (domainsError) {
      console.error("[IMAP] Failed to load domains:", domainsError);
    }

    const allowedDomainSuffixes = (activeDomains || [])
      .map((d: any) => String(d.name || "").toLowerCase())
      .map((name) => (name.startsWith("@") ? name.slice(1) : name))
      .filter(Boolean);

    console.log(`[IMAP] Allowed domains: ${allowedDomainSuffixes.join(', ')}`);

    // Load ALL active temp_emails for matching
    const { data: activeTempEmails, error: tempEmailsError } = await supabase
      .from("temp_emails")
      .select("id, address")
      .eq("is_active", true);

    if (tempEmailsError) {
      console.error("[IMAP] Failed to load temp emails:", tempEmailsError);
    }

    const tempEmailMap = new Map<string, string>();
    (activeTempEmails || []).forEach((te: any) => {
      const addr = String(te.address || "").toLowerCase().trim();
      if (addr) tempEmailMap.set(addr, te.id);
    });

    console.log(`[IMAP] Active temp emails (${tempEmailMap.size}): ${Array.from(tempEmailMap.keys()).slice(0, 5).join(', ')}${tempEmailMap.size > 5 ? '...' : ''}`);

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
      
      // Don't log password
      const logCmd = command.startsWith('LOGIN') 
        ? `LOGIN "${username}" ****` 
        : command;
      console.log(`[IMAP] > ${tag} ${logCmd}`);
      
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
      
      console.log(`[IMAP] < Response: ${response.length} chars`);
      return response;
    };

    const greeting = new Uint8Array(1024);
    await secureConn.read(greeting);
    console.log("[IMAP] Server greeting received");

    let tagNum = 1;

    const loginResponse = await sendCommand(`LOGIN "${username}" "${password}"`, tagNum++);
    if (!loginResponse.includes("OK")) {
      throw new Error("IMAP login failed: " + loginResponse);
    }

    // SELECT INBOX to get fresh message count
    const selectResponse = await sendCommand("SELECT INBOX", tagNum++);
    if (!selectResponse.includes("OK")) {
      throw new Error("Failed to select INBOX: " + selectResponse);
    }

    const existsMatch = selectResponse.match(/\* (\d+) EXISTS/);
    const messageCount = existsMatch ? parseInt(existsMatch[1]) : 0;
    console.log(`[IMAP] Found ${messageCount} total messages in INBOX`);

    const storedCount = { success: 0, failed: 0, skipped: 0, noMatch: 0 };

    let newestMessageIds: string[] = [];

    if (mode === 'unseen') {
      // Search for UNSEEN messages specifically
      const searchResponse = await sendCommand("SEARCH UNSEEN", tagNum++);
      const unseenMatch = searchResponse.match(/\* SEARCH ([\d\s]+)/);
      const unseenIds = unseenMatch ? unseenMatch[1].trim().split(/\s+/).filter(id => id) : [];
      console.log(`[IMAP] Found ${unseenIds.length} UNSEEN messages`);
      newestMessageIds = unseenIds.slice(-limit).reverse();
      console.log(`[IMAP] Processing ${newestMessageIds.length} newest UNSEEN: [${newestMessageIds.join(', ')}]`);
    } else {
      // Latest mode: only scan the last N message sequence numbers.
      // NOTE: Some servers deliver new mail already marked as \Seen. We still want to store those.
      const start = Math.max(1, messageCount - limit + 1);
      newestMessageIds = [];
      for (let i = messageCount; i >= start; i--) newestMessageIds.push(String(i));
      console.log(`[IMAP] Latest mode: processing ${newestMessageIds.length} messages: [${newestMessageIds.join(', ')}]`);
    }

    // Load existing emails to avoid duplicates (check by message-id or from+subject+date combo)
    const { data: existingEmails } = await supabase
      .from("received_emails")
      .select("id, from_address, subject, received_at, temp_email_id");
    
    const existingEmailKeys = new Set(
      (existingEmails || []).map((e: any) => 
        `${e.temp_email_id}|${e.from_address}|${e.subject}|${e.received_at}`.toLowerCase()
      )
    );
    console.log(`[IMAP] Loaded ${existingEmailKeys.size} existing email signatures for dedup`);

    for (const msgId of newestMessageIds) {
      try {
        // Fast pass: fetch flags + headers only (small)
        const headerResponse = await sendCommand(`FETCH ${msgId} (FLAGS BODY[HEADER])`, tagNum++);

        const isSeen = /FLAGS\s*\([^)]*\\Seen/i.test(headerResponse);
        if (isSeen) {
          console.log(`[IMAP] Msg ${msgId}: already seen (will still attempt match/store)`);
        }

        // Build a proper header map to handle multi-line headers
        const headerLines = headerResponse.split(/\r?\n/);
        const headers: Record<string, string> = {};
        let currentHeader = '';
        let currentValue = '';
        
        for (const line of headerLines) {
          // Check if this is a continuation of the previous header (starts with whitespace)
          if (/^\s+/.test(line) && currentHeader) {
            currentValue += ' ' + line.trim();
          } else {
            // Save previous header if exists
            if (currentHeader) {
              headers[currentHeader.toLowerCase()] = currentValue;
            }
            // Parse new header
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
              currentHeader = line.substring(0, colonIndex).trim();
              currentValue = line.substring(colonIndex + 1).trim();
            } else {
              currentHeader = '';
              currentValue = '';
            }
          }
        }
        // Save last header
        if (currentHeader) {
          headers[currentHeader.toLowerCase()] = currentValue;
        }

        const fromRaw = headers['from'] || '';
        const toRaw = headers['to'] || '';
        const subjectRaw = headers['subject'] || '';
        const dateRaw = headers['date'] || '';
        const deliveredTo = headers['delivered-to'] || '';
        const originalTo = headers['x-original-to'] || '';
        const envelopeTo = headers['envelope-to'] || '';
        const messageId = headers['message-id'] || '';

        const toAddress = toRaw.trim();

        const headerCandidates = `${deliveredTo} ${originalTo} ${envelopeTo} ${toAddress}`;
        const headerEmails = (headerCandidates.match(EMAIL_REGEX) || []).map((e) => e.toLowerCase().trim());

        const allEmails: string[] = [
          ...(headerResponse.match(EMAIL_REGEX) ?? []),
          ...headerEmails
        ].map((e) => e.toLowerCase().trim());

        // Find ALL emails that match our allowed domains
        const domainMatchedEmails = allowedDomainSuffixes.length
          ? allEmails.filter((e) => allowedDomainSuffixes.some((suffix) => e.endsWith(suffix)))
          : [];

        console.log(`[IMAP] Msg ${msgId} - To header: "${toAddress}"`);
        console.log(`[IMAP] Msg ${msgId} - Extracted emails: [${allEmails.slice(0, 5).join(', ')}]`);
        console.log(`[IMAP] Msg ${msgId} - Domain-matched emails: [${domainMatchedEmails.join(', ')}]`);

        // Try to find a matching temp_email
        let matchedTempEmailId: string | null = null;
        let matchedRecipient: string | null = null;

        for (const candidateEmail of domainMatchedEmails) {
          const tempId = tempEmailMap.get(candidateEmail);
          if (tempId) {
            matchedTempEmailId = tempId;
            matchedRecipient = candidateEmail;
            console.log(`[IMAP] Msg ${msgId} - MATCHED temp_email: ${candidateEmail} -> ${tempId}`);
            break;
          }
        }

        if (!matchedTempEmailId) {
          // Try header emails as fallback
          for (const candidateEmail of headerEmails) {
            const tempId = tempEmailMap.get(candidateEmail);
            if (tempId) {
              matchedTempEmailId = tempId;
              matchedRecipient = candidateEmail;
              console.log(`[IMAP] Msg ${msgId} - MATCHED (fallback) temp_email: ${candidateEmail} -> ${tempId}`);
              break;
            }
          }
        }

        // Extract sender email (clean it up)
        let fromAddress = fromRaw || "unknown@unknown.com";
        const fromEmailMatch = fromAddress.match(/<([^>]+)>/);
        if (fromEmailMatch) {
          const displayName = fromAddress.replace(/<[^>]+>/, '').trim().replace(/^"|"$/g, '');
          fromAddress = displayName ? `${displayName} <${fromEmailMatch[1]}>` : fromEmailMatch[1];
        }

        // Decode subject if encoded (handle multiple encoded parts)
        let subject = subjectRaw || "(No Subject)";
        // Decode all encoded-word patterns
        subject = subject.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (match, charset, encoding, encodedText) => {
          if (encoding.toUpperCase() === 'B') {
            try {
              return decodeBase64(encodedText);
            } catch {
              return match;
            }
          } else if (encoding.toUpperCase() === 'Q') {
            return decodeQuotedPrintable(encodedText.replace(/_/g, ' '));
          }
          return match;
        });
        // Clean up any remaining artifacts
        subject = subject.trim();

        if (!matchedTempEmailId) {
          console.log(`[IMAP] Msg ${msgId} - NO MATCH found. Subject: "${subject}", From: "${fromAddress}"`);
          console.log(`[IMAP] Msg ${msgId} - Candidates tried: [${domainMatchedEmails.concat(headerEmails).join(', ')}]`);
          storedCount.noMatch++;
          // Mark as seen to avoid re-processing
          await sendCommand(`STORE ${msgId} +FLAGS (\\Seen)`, tagNum++);
          continue;
        }

        // Fetch FULL message body (BODY[] not BODY[TEXT]) to get complete MIME structure including HTML
        const bodyResponse = await sendCommand(`FETCH ${msgId} (BODY[])`, tagNum++);

        // Extract body content from BODY[] {n}\r\n... using the IMAP byte count
        let rawBody = '';
        const bodyMarker = /BODY\[\]\s*\{(\d+)\}\r?\n/i.exec(bodyResponse);

        if (bodyMarker && typeof bodyMarker.index === 'number') {
          const bodyLength = parseInt(bodyMarker[1], 10);
          const bodyStartIndex = bodyMarker.index + bodyMarker[0].length;
          rawBody = bodyResponse.slice(bodyStartIndex, bodyStartIndex + bodyLength);
        } else {
          // Fallback: try to find content after double CRLF
          const bodyStart = bodyResponse.lastIndexOf('\r\n\r\n');
          rawBody = bodyStart > -1 ? bodyResponse.substring(bodyStart + 4) : bodyResponse;
        }

        // Parse MIME content (also strips IMAP protocol artifacts)
        const { text, html } = parseMimeContent(rawBody);

        // Use text body or extract from HTML
        let finalTextBody = text;
        let finalHtmlBody = html;

        // If we have HTML but no text, extract text from HTML
        if (!finalTextBody && finalHtmlBody) {
          finalTextBody = extractTextFromHtml(finalHtmlBody);
        }

        // If we only have plain text, generate a basic HTML version for rich display
        if (finalTextBody && !finalHtmlBody) {
          // Convert plain text to HTML with proper line breaks and link detection
          const escapedText = finalTextBody
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/\n/g, '<br>\n');
          
          // Detect and linkify URLs
          const linkedText = escapedText.replace(
            /(https?:\/\/[^\s<]+)/gi,
            '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">$1</a>'
          );
          
          finalHtmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; padding: 16px; color: #333; }</style></head>
<body>${linkedText}</body>
</html>`;
        }

        if (!finalTextBody && !finalHtmlBody) {
          finalTextBody = rawBody.trim();
        }

        // Store the email
        const receivedAtIso = (() => {
          const fallback = new Date().toISOString();
          const rawDate = dateRaw?.trim();
          if (!rawDate) return fallback;

          const parsed = new Date(rawDate);
          if (Number.isNaN(parsed.getTime())) {
            console.warn(`[IMAP] Msg ${msgId} - Invalid Date header: "${rawDate}" (using now)`);
            return fallback;
          }
          return parsed.toISOString();
        })();

        // Check for duplicates before inserting
        const emailKey = `${matchedTempEmailId}|${fromAddress}|${subject}|${receivedAtIso}`.toLowerCase();
        if (existingEmailKeys.has(emailKey)) {
          console.log(`[IMAP] Msg ${msgId} - DUPLICATE detected (pre-check), skipping: "${subject}"`);
          storedCount.skipped++;
          await sendCommand(`STORE ${msgId} +FLAGS (\\Seen)`, tagNum++);
          continue;
        }

        // Also check by message-id if available
        if (messageId) {
          const msgIdKey = `msgid:${messageId}`.toLowerCase();
          if (existingEmailKeys.has(msgIdKey)) {
            console.log(`[IMAP] Msg ${msgId} - DUPLICATE by Message-ID, skipping`);
            storedCount.skipped++;
            await sendCommand(`STORE ${msgId} +FLAGS (\\Seen)`, tagNum++);
            continue;
          }
        }

        // Use upsert with ON CONFLICT DO NOTHING to prevent duplicate key errors
        const { error: insertError } = await supabase
          .from("received_emails")
          .upsert({
            temp_email_id: matchedTempEmailId,
            from_address: fromAddress,
            subject: subject,
            body: finalTextBody.substring(0, 10000),
            html_body: finalHtmlBody ? finalHtmlBody.substring(0, 50000) : null,
            is_read: false,
            received_at: receivedAtIso,
          }, { 
            onConflict: 'id',
            ignoreDuplicates: true 
          });

        if (insertError) {
          if (insertError.code === '23505') {
            console.log(`[IMAP] Msg ${msgId} - Duplicate (DB constraint), already exists for ${matchedRecipient}`);
            storedCount.skipped++;
          } else {
            console.error(`[IMAP] Msg ${msgId} - Insert error:`, insertError);
            storedCount.failed++;
          }
        } else {
          storedCount.success++;
          // Add to existing keys to prevent duplicates within this batch
          existingEmailKeys.add(emailKey);
          if (messageId) existingEmailKeys.add(`msgid:${messageId}`.toLowerCase());
          console.log(`[IMAP] Msg ${msgId} - STORED for ${matchedRecipient}: "${subject}"`);
        }

        
        // Mark as seen in IMAP
        await sendCommand(`STORE ${msgId} +FLAGS (\\Seen)`, tagNum++);

      } catch (emailError) {
        console.error(`[IMAP] Error processing message ${msgId}:`, emailError);
        storedCount.failed++;
      }
    }

    await sendCommand("LOGOUT", tagNum++);
    secureConn.close();

    console.log(`[IMAP] Complete: ${storedCount.success} stored, ${storedCount.failed} failed, ${storedCount.skipped} skipped, ${storedCount.noMatch} no-match`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${newestMessageIds.length} emails`,
        stats: {
          mode,
          limit,
          totalMessages: messageCount,
          processed: newestMessageIds.length,
          stored: storedCount.success,
          failed: storedCount.failed,
          skipped: storedCount.skipped,
          noMatch: storedCount.noMatch,
          fetchedAt: new Date().toISOString()
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[IMAP] Fetch error:", error);
    
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
