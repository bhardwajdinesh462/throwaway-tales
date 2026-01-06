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

type ImapCandidate = {
  source: "db" | "env" | "test";
  mailboxId?: string;
  mailboxName?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  last_error_at?: string | null;
};

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

// Decode quoted-printable encoding
function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "") // Remove soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Decode base64 encoding with UTF-8 support
function decodeBase64(str: string): string {
  try {
    const cleaned = str.replace(/[\r\n\s]/g, "");
    // Handle potential padding issues
    const padded = cleaned + "=".repeat((4 - (cleaned.length % 4)) % 4);
    const binaryStr = atob(padded);

    // Try to decode as UTF-8
    try {
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return new TextDecoder("utf-8").decode(bytes);
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
  let text = "";
  let html = "";

  // Strip IMAP protocol artifacts if they leaked into storage
  const cleaned = rawContent
    .replace(/^\s*BODY\[TEXT\]\s*\{\d+\}\s*\r?\n?/gim, "")
    .replace(/\r?\n\)\r?\nA\d{4}\s+(OK|NO|BAD)[\s\S]*$/i, "")
    .trim();

  const boundaryParam = cleaned.match(/boundary[=\s]*"?([^"\r\n;]+)"?/i)?.[1];
  const boundaryFromBody = cleaned.match(/^\s*--([^\r\n]+)\r?\n/)?.[1]?.trim();
  const boundary = boundaryParam || boundaryFromBody;

  const parseSinglePart = (content: string) => {
    const headerEndCrLf = content.indexOf("\r\n\r\n");
    const headerEndLf = headerEndCrLf === -1 ? content.indexOf("\n\n") : -1;
    const headerEnd = headerEndCrLf !== -1 ? headerEndCrLf : headerEndLf;
    const sepLen = headerEndCrLf !== -1 ? 4 : 2;

    if (headerEnd === -1) {
      return { headers: "", body: content };
    }

    return {
      headers: content.substring(0, headerEnd),
      body: content.substring(headerEnd + sepLen),
    };
  };

  const decodePart = (headersLower: string, body: string): string => {
    let decoded = body;

    // Detect and decode base64 content
    if (headersLower.includes("base64")) {
      const cleanBase64 = body.replace(/[\r\n\s]/g, "");
      decoded = decodeBase64(cleanBase64);
    } else if (headersLower.includes("quoted-printable")) {
      decoded = decodeQuotedPrintable(body);
    }

    // Clean up any remaining MIME boundary artifacts from decoded content
    decoded = decoded
      .replace(/--b\d+=_[^\r\n]+/g, "")
      .replace(/Content-Type:\s*[^\r\n]+/gi, "")
      .replace(/Content-Transfer-Encoding:\s*[^\r\n]+/gi, "")
      .replace(/boundary="?[^"\r\n]+"?/gi, "")
      .replace(/^\s*[\r\n]+/, "")
      .trim();

    return decoded;
  };

  if (!boundary) {
    const { headers, body } = parseSinglePart(cleaned);
    const headersLower = headers.toLowerCase();
    const decoded = decodePart(headersLower, body).trim();

    if (headersLower.includes("text/html")) html = decoded;
    else text = decoded;

    return { text, html };
  }

  const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = cleaned.split(new RegExp(`--${escapedBoundary}`));

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === "--") continue;

    const normalizedPart = part.replace(/^\r?\n/, "");
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

    if (headersLower.includes("text/html")) {
      if (!html) html = decoded;
    } else if (headersLower.includes("text/plain")) {
      if (!text) text = decoded;
    }
  }

  return { text: text.trim(), html: html.trim() };
}

// Extract clean text from HTML
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function withinMinutes(iso: string, minutes: number): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < minutes * 60_000;
}

function toShortError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.length > 800 ? msg.slice(0, 800) + "…" : msg;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Request options (defaults keep polling fast)
  let requestBody: any = {};
  let mode: "latest" | "unseen" = "latest";
  let limit = 10;
  let requestedMailboxId: string | null = null;
  let testOnly = false;

  try {
    requestBody = await req.json();
    if (requestBody?.mode === "unseen" || requestBody?.mode === "latest") mode = requestBody.mode;
    if (typeof requestBody?.limit === "number" && Number.isFinite(requestBody.limit)) {
      limit = Math.max(1, Math.min(50, Math.floor(requestBody.limit)));
    }
    if (typeof requestBody?.mailbox_id === "string" && requestBody.mailbox_id.trim()) {
      requestedMailboxId = requestBody.mailbox_id.trim();
    }
    testOnly = !!requestBody?.test_only;
  } catch {
    // ignore (e.g. empty body)
  }

  console.log(`[IMAP] Starting fetch - mode: ${mode}, limit: ${limit}, testOnly: ${testOnly}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const updateMailboxError = async (mailboxId: string, err: unknown) => {
      const msg = toShortError(err);
      try {
        await supabase
          .from("mailboxes")
          .update({ last_error: msg, last_error_at: new Date().toISOString() })
          .eq("id", mailboxId);
      } catch (e) {
        console.error("[IMAP] Failed updating mailbox error:", e);
      }
    };

    const updateMailboxSuccess = async (mailboxId: string) => {
      try {
        await supabase
          .from("mailboxes")
          .update({
            last_polled_at: new Date().toISOString(),
            last_error: null,
            last_error_at: null,
          })
          .eq("id", mailboxId);
      } catch (e) {
        console.error("[IMAP] Failed updating mailbox success:", e);
      }
    };

    const envHost = Deno.env.get("IMAP_HOST") || "";
    const envPort = parseInt(Deno.env.get("IMAP_PORT") || "993");
    const envUser = Deno.env.get("IMAP_USER") || "";
    const envPass = Deno.env.get("IMAP_PASSWORD") || "";

    const buildCandidates = async (): Promise<ImapCandidate[]> => {
      // 1) Test-only: use provided config and do not hit the database.
      if (testOnly) {
        const host = String(requestBody?.host || "").trim();
        const port = Number.isFinite(Number(requestBody?.port)) ? Number(requestBody.port) : 993;
        const username = String(requestBody?.user || requestBody?.username || "").trim();
        const password = String(requestBody?.password || "");

        if (!host || !username || !password) {
          return [];
        }

        return [
          {
            source: "test",
            host,
            port,
            username,
            password,
          },
        ];
      }

      // 2) DB mailboxes (primary first, then failover)
      const { data: dbMailboxes, error: mailboxesError } = await supabase
        .from("mailboxes")
        .select(
          "id,name,imap_host,imap_port,imap_user,is_active,is_primary,priority,last_error_at,last_error"
        )
        .eq("is_active", true)
        .not("imap_host", "is", null)
        .not("imap_user", "is", null)
        .order("is_primary", { ascending: false })
        .order("priority", { ascending: false });

      if (mailboxesError) {
        console.error("[IMAP] Failed loading mailboxes:", mailboxesError);
      }

      const mailboxes = (dbMailboxes || []) as any[];

      // If mailbox_id is requested, try it first, then the rest.
      let ordered: any[] = mailboxes;
      if (requestedMailboxId) {
        const requested = mailboxes.find((m) => m.id === requestedMailboxId);
        const others = mailboxes.filter((m) => m.id !== requestedMailboxId);
        ordered = requested ? [requested, ...others] : mailboxes;
      }

      const candidates: ImapCandidate[] = [];

      for (const m of ordered) {
        // Skip recently errored mailboxes unless explicitly requested
        const lastErrAt = m.last_error_at as string | null;
        const isRequested = requestedMailboxId && m.id === requestedMailboxId;
        if (!isRequested && lastErrAt && withinMinutes(lastErrAt, 15)) {
          continue;
        }

        const host = String(m.imap_host || "").trim();
        const port = Number.isFinite(Number(m.imap_port)) ? Number(m.imap_port) : 993;
        const username = String(m.imap_user || "").trim();

        if (!host || !username) continue;

        const { data: pw, error: pwError } = await supabase.rpc("get_mailbox_imap_password", {
          p_mailbox_id: m.id,
        });

        if (pwError) {
          console.error(`[IMAP] Failed decrypting IMAP password for mailbox ${m.name}:`, pwError);
          await updateMailboxError(m.id, pwError.message);
          continue;
        }

        const password = String(pw || "");
        if (!password) {
          await updateMailboxError(m.id, "IMAP password not set for this mailbox");
          continue;
        }

        candidates.push({
          source: "db",
          mailboxId: m.id,
          mailboxName: m.name,
          host,
          port,
          username,
          password,
          last_error_at: m.last_error_at,
        });
      }

      // 3) Fallback to env if DB has nothing usable
      if (candidates.length === 0 && envHost && envUser && envPass) {
        candidates.push({
          source: "env",
          host: envHost,
          port: Number.isFinite(envPort) ? envPort : 993,
          username: envUser,
          password: envPass,
        });
      }

      return candidates;
    };

    const candidates = await buildCandidates();

    if (testOnly && candidates.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "IMAP test requires host, port, username, and password.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!testOnly && candidates.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "No IMAP mailbox is configured (or passwords are missing). Please configure IMAP on at least one mailbox and set it as Primary.",
          configured: false,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    console.log(`[IMAP] Allowed domains: ${allowedDomainSuffixes.join(", ")}`);

    // Helper to lookup temp_email by address (with caching within this request)
    const tempEmailCache = new Map<string, string | null>();
    const lookupTempEmail = async (address: string): Promise<string | null> => {
      const normalized = address.toLowerCase().trim();
      if (tempEmailCache.has(normalized)) {
        return tempEmailCache.get(normalized) || null;
      }
      const { data, error } = await supabase
        .from("temp_emails")
        .select("id")
        .eq("address", normalized)
        .eq("is_active", true)
        .maybeSingle();
      const id = !error && data ? (data as any).id : null;
      tempEmailCache.set(normalized, id);
      return id;
    };

    const checkedDuplicates = new Set<string>();
    const isDuplicate = async (
      tempEmailId: string,
      fromAddr: string,
      subj: string,
      receivedAt: string,
      _messageId?: string
    ): Promise<boolean> => {
      const emailKey = `${tempEmailId}|${fromAddr}|${subj}|${receivedAt}`.toLowerCase();
      if (checkedDuplicates.has(emailKey)) return true;

      const { data: existing } = await supabase
        .from("received_emails")
        .select("id")
        .eq("temp_email_id", tempEmailId)
        .eq("from_address", fromAddr)
        .eq("subject", subj)
        .eq("received_at", receivedAt)
        .limit(1);

      if (existing && (existing as any[]).length > 0) {
        return true;
      }

      checkedDuplicates.add(emailKey);
      return false;
    };

    const processMailbox = async (candidate: ImapCandidate) => {
      const { host, port, username, password } = candidate;

      console.log(`[IMAP] Connecting to ${host}:${port}`);

      const conn = await Deno.connect({ hostname: host, port });
      let secureConn: Deno.TlsConn | Deno.Conn = conn;
      if (port === 993) {
        secureConn = await Deno.startTls(conn, { hostname: host });
      }

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const sendCommand = async (command: string, tagNum: number): Promise<string> => {
        const tag = `A${tagNum.toString().padStart(4, "0")}`;
        const fullCommand = `${tag} ${command}\r\n`;

        const logCmd = command.startsWith("LOGIN") ? `LOGIN "${username}" ****` : command;
        console.log(`[IMAP] > ${tag} ${logCmd}`);

        await secureConn.write(encoder.encode(fullCommand));

        const buffer = new Uint8Array(131072);
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

      try {
        const greeting = new Uint8Array(1024);
        await secureConn.read(greeting);
        console.log("[IMAP] Server greeting received");

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

        // Always compute unseen count for UI/diagnostics
        const searchUnseenResponse = await sendCommand("SEARCH UNSEEN", tagNum++);
        const unseenMatch = searchUnseenResponse.match(/\* SEARCH ([\d\s]+)/);
        const unseenIds = unseenMatch ? unseenMatch[1].trim().split(/\s+/).filter((id) => id) : [];
        const unseenCount = unseenIds.length;

        console.log(`[IMAP] Found ${messageCount} total messages in INBOX (${unseenCount} unseen)`);

        if (testOnly) {
          await sendCommand("LOGOUT", tagNum++);
          return {
            success: true,
            message: "IMAP connection successful",
            stats: {
              mode,
              limit,
              totalMessages: messageCount,
              unseenMessages: unseenCount,
              processed: 0,
              stored: 0,
              failed: 0,
              skipped: 0,
              noMatch: 0,
              fetchedAt: new Date().toISOString(),
            },
          };
        }

        const storedCount = { success: 0, failed: 0, skipped: 0, noMatch: 0 };
        let newestMessageIds: string[] = [];

        if (mode === "unseen") {
          newestMessageIds = unseenIds.slice(-limit).reverse();
          console.log(`[IMAP] Processing ${newestMessageIds.length} newest UNSEEN: [${newestMessageIds.join(", ")}]`);
        } else {
          const start = Math.max(1, messageCount - limit + 1);
          newestMessageIds = [];
          for (let i = messageCount; i >= start; i--) newestMessageIds.push(String(i));
          console.log(`[IMAP] Latest mode: processing ${newestMessageIds.length} messages: [${newestMessageIds.join(", ")}]`);
        }

        console.log(`[IMAP] Processing ${newestMessageIds.length} messages (on-demand dedup)`);

        for (const msgId of newestMessageIds) {
          try {
            const headerResponse = await sendCommand(`FETCH ${msgId} (FLAGS BODY[HEADER])`, tagNum++);

            const headerLines = headerResponse.split(/\r?\n/);
            const headers: Record<string, string> = {};
            let currentHeader = "";
            let currentValue = "";

            for (const line of headerLines) {
              if (/^\s+/.test(line) && currentHeader) {
                currentValue += " " + line.trim();
              } else {
                if (currentHeader) {
                  headers[currentHeader.toLowerCase()] = currentValue;
                }
                const colonIndex = line.indexOf(":");
                if (colonIndex > 0) {
                  currentHeader = line.substring(0, colonIndex).trim();
                  currentValue = line.substring(colonIndex + 1).trim();
                } else {
                  currentHeader = "";
                  currentValue = "";
                }
              }
            }
            if (currentHeader) {
              headers[currentHeader.toLowerCase()] = currentValue;
            }

            const fromRaw = headers["from"] || "";
            const toRaw = headers["to"] || "";
            const subjectRaw = headers["subject"] || "";
            const dateRaw = headers["date"] || "";
            const deliveredTo = headers["delivered-to"] || "";
            const originalTo = headers["x-original-to"] || "";
            const envelopeTo = headers["envelope-to"] || "";
            const messageId = headers["message-id"] || "";

            const toAddress = toRaw.trim();

            const headerCandidates = `${deliveredTo} ${originalTo} ${envelopeTo} ${toAddress}`;
            const headerEmails = (headerCandidates.match(EMAIL_REGEX) || []).map((e) => e.toLowerCase().trim());

            const allEmails: string[] = [...(headerResponse.match(EMAIL_REGEX) ?? []), ...headerEmails].map((e) =>
              e.toLowerCase().trim()
            );

            const domainMatchedEmails = allowedDomainSuffixes.length
              ? allEmails.filter((e) => allowedDomainSuffixes.some((suffix) => e.endsWith(suffix)))
              : [];

            let matchedTempEmailId: string | null = null;
            let matchedRecipient: string | null = null;

            for (const candidateEmail of domainMatchedEmails) {
              const tempId = await lookupTempEmail(candidateEmail);
              if (tempId) {
                matchedTempEmailId = tempId;
                matchedRecipient = candidateEmail;
                break;
              }
            }

            if (!matchedTempEmailId) {
              for (const candidateEmail of headerEmails) {
                const tempId = await lookupTempEmail(candidateEmail);
                if (tempId) {
                  matchedTempEmailId = tempId;
                  matchedRecipient = candidateEmail;
                  break;
                }
              }
            }

            let fromAddress = fromRaw || "unknown@unknown.com";
            const fromEmailMatch = fromAddress.match(/<([^>]+)>/);
            if (fromEmailMatch) {
              const displayName = fromAddress.replace(/<[^>]+>/, "").trim().replace(/^"|"$/g, "");
              fromAddress = displayName ? `${displayName} <${fromEmailMatch[1]}>` : fromEmailMatch[1];
            }

            let subject = subjectRaw || "(No Subject)";
            subject = subject.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (match, _charset, encoding, encodedText) => {
              if (String(encoding).toUpperCase() === "B") {
                try {
                  return decodeBase64(encodedText);
                } catch {
                  return match;
                }
              }
              if (String(encoding).toUpperCase() === "Q") {
                return decodeQuotedPrintable(String(encodedText).replace(/_/g, " "));
              }
              return match;
            });
            subject = subject.trim();

            if (!matchedTempEmailId) {
              storedCount.noMatch++;
              await sendCommand(`STORE ${msgId} +FLAGS (\\Seen)`, tagNum++);
              continue;
            }

            const bodyResponse = await sendCommand(`FETCH ${msgId} (BODY[])`, tagNum++);

            let rawBody = "";
            const bodyMarker = /BODY\[\]\s*\{(\d+)\}\r?\n/i.exec(bodyResponse);

            if (bodyMarker && typeof bodyMarker.index === "number") {
              const bodyLength = parseInt(bodyMarker[1], 10);
              const bodyStartIndex = bodyMarker.index + bodyMarker[0].length;
              rawBody = bodyResponse.slice(bodyStartIndex, bodyStartIndex + bodyLength);
            } else {
              const bodyStart = bodyResponse.lastIndexOf("\r\n\r\n");
              rawBody = bodyStart > -1 ? bodyResponse.substring(bodyStart + 4) : bodyResponse;
            }

            const { text, html } = parseMimeContent(rawBody);

            let finalTextBody = text;
            let finalHtmlBody = html;

            if (!finalTextBody && finalHtmlBody) {
              finalTextBody = extractTextFromHtml(finalHtmlBody);
            }

            if (finalTextBody && !finalHtmlBody) {
              const escapedText = finalTextBody
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/\n/g, "<br>\n");

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

            const receivedAtIso = (() => {
              const fallback = new Date().toISOString();
              const rawDate = dateRaw?.trim();
              if (!rawDate) return fallback;

              const parsed = new Date(rawDate);
              if (Number.isNaN(parsed.getTime())) {
                return fallback;
              }
              return parsed.toISOString();
            })();

            const duplicateExists = await isDuplicate(matchedTempEmailId, fromAddress, subject, receivedAtIso, messageId);
            if (duplicateExists) {
              storedCount.skipped++;
              await sendCommand(`STORE ${msgId} +FLAGS (\\Seen)`, tagNum++);
              continue;
            }

            const { error: insertError } = await supabase.from("received_emails").insert({
              temp_email_id: matchedTempEmailId,
              from_address: fromAddress,
              subject: subject,
              body: finalTextBody.substring(0, 10000),
              html_body: finalHtmlBody ? finalHtmlBody.substring(0, 50000) : null,
              is_read: false,
              received_at: receivedAtIso,
            });

            if (insertError) {
              if (insertError.code === "23505") {
                storedCount.skipped++;
              } else {
                storedCount.failed++;
              }
            } else {
              storedCount.success++;
            }

            await sendCommand(`STORE ${msgId} +FLAGS (\\Seen)`, tagNum++);
          } catch (emailError) {
            console.error(`[IMAP] Error processing message ${msgId}:`, emailError);
            storedCount.failed++;
          }
        }

        await sendCommand("LOGOUT", tagNum++);

        return {
          success: true,
          message: `Processed ${newestMessageIds.length} emails`,
          stats: {
            mode,
            limit,
            totalMessages: messageCount,
            unseenMessages: unseenCount,
            processed: newestMessageIds.length,
            stored: storedCount.success,
            failed: storedCount.failed,
            skipped: storedCount.skipped,
            noMatch: storedCount.noMatch,
            fetchedAt: new Date().toISOString(),
          },
        };
      } finally {
        try {
          secureConn.close();
        } catch {
          // ignore
        }
      }
    };

    const tried: Array<{ mailboxId?: string; mailboxName?: string; host: string; error: string }> = [];
    let lastErr: unknown = null;

    for (const candidate of candidates) {
      try {
        const result = await processMailbox(candidate);

        if (candidate.mailboxId) {
          await updateMailboxSuccess(candidate.mailboxId);
        }

        return new Response(
          JSON.stringify({
            ...result,
            mailbox_used: {
              source: candidate.source,
              mailbox_id: candidate.mailboxId || null,
              mailbox_name: candidate.mailboxName || null,
              host: candidate.host,
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        lastErr = err;
        const msg = toShortError(err);
        tried.push({ mailboxId: candidate.mailboxId, mailboxName: candidate.mailboxName, host: candidate.host, error: msg });
        if (candidate.mailboxId) {
          await updateMailboxError(candidate.mailboxId, err);
        }
        continue;
      }
    }

    const rawMessage = lastErr instanceof Error ? lastErr.message : String(lastErr || "Failed to fetch emails");
    let errorMessage = rawMessage || "Failed to fetch emails";

    if (errorMessage.includes("Connection refused")) {
      errorMessage = "Could not connect to IMAP server. Please check the host and port.";
    } else if (errorMessage.toLowerCase().includes("login failed") || errorMessage.toLowerCase().includes("authentication")) {
      errorMessage = "IMAP authentication failed. Please check your username and password.";
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: rawMessage,
        tried,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[IMAP] Fetch error:", error);

    let errorMessage = error?.message || "Failed to fetch emails";

    if (errorMessage.includes("Connection refused")) {
      errorMessage = "Could not connect to IMAP server. Please check the host and port.";
    } else if (errorMessage.toLowerCase().includes("login failed") || errorMessage.toLowerCase().includes("authentication")) {
      errorMessage = "IMAP authentication failed. Please check your username and password.";
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: error?.message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
