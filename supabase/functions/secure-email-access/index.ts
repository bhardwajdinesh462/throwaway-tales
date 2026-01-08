import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple encryption/decryption using Web Crypto API
const ENCRYPTION_KEY = Deno.env.get('EMAIL_ENCRYPTION_KEY') || 'default-key-change-in-production';

// Cache the derived key to avoid repeated PBKDF2 calls (expensive)
let cachedKey: CryptoKey | null = null;
let keyPromise: Promise<CryptoKey> | null = null;

// HARD TIMEOUT - fail fast, don't wait 80+ seconds
const REQUEST_TIMEOUT_MS = 8000; // 8 seconds max per DB call

async function getEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  if (keyPromise) return keyPromise;
  
  keyPromise = (async () => {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('temp-email-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    cachedKey = key;
    return key;
  })();
  
  return keyPromise;
}

async function decryptText(encrypted: string, ivBase64: string): Promise<string> {
  if (!encrypted || !ivBase64) return '';
  
  try {
    const key = await getEncryptionKey();
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    const data = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '[Decryption failed]';
  }
}

// Best-effort cleanup for older records that accidentally stored IMAP/MIME artifacts
function stripImapArtifacts(raw: string): string {
  return raw
    .replace(/^\s*BODY\[TEXT\]\s*\{\d+\}\s*\r?\n?/gmi, '')
    .replace(/\r?\n\)\r?\nA\d{4}\s+(OK|NO|BAD)[\s\S]*$/i, '')
    .trim();
}

function decodeQuotedPrintableInline(str: string): string {
  return str
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeBase64Inline(str: string): string {
  try {
    const cleaned = str.replace(/\r?\n/g, '');
    return atob(cleaned);
  } catch {
    return str;
  }
}

function extractTextFromHtmlInline(html: string): string {
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

function tryParseMultipartFromBody(rawBody: string): { text: string; html: string } {
  const cleaned = stripImapArtifacts(rawBody);
  const boundaryFromBody = cleaned.match(/^\s*--([^\r\n]+)\r?\n/)?.[1]?.trim();
  const boundary = boundaryFromBody;

  if (!boundary) {
    return { text: cleaned, html: '' };
  }

  const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = cleaned.split(new RegExp(`--${escapedBoundary}`));

  let text = '';
  let html = '';

  const parseSinglePart = (content: string) => {
    const headerEndCrLf = content.indexOf('\r\n\r\n');
    const headerEndLf = headerEndCrLf === -1 ? content.indexOf('\n\n') : -1;
    const headerEnd = headerEndCrLf !== -1 ? headerEndCrLf : headerEndLf;
    const sepLen = headerEndCrLf !== -1 ? 4 : 2;

    if (headerEnd === -1) return { headers: '', body: content };
    return {
      headers: content.substring(0, headerEnd),
      body: content.substring(headerEnd + sepLen),
    };
  };

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === '--') continue;

    const normalizedPart = part.replace(/^\r?\n/, '');
    const { headers, body } = parseSinglePart(normalizedPart);
    const headersLower = headers.toLowerCase();

    let decodedBody = body;
    if (headersLower.includes('quoted-printable')) decodedBody = decodeQuotedPrintableInline(decodedBody);
    if (headersLower.includes('base64')) decodedBody = decodeBase64Inline(decodedBody);
    decodedBody = decodedBody.trim();

    if (!decodedBody) continue;

    if (headersLower.includes('text/html') && !html) html = decodedBody;
    if (headersLower.includes('text/plain') && !text) text = decodedBody;
  }

  if (!text && html) text = extractTextFromHtmlInline(html);

  return { text: text.trim(), html: html.trim() };
}

function normalizeEmailBodies(body: string | null, htmlBody: string | null): { body: string | null; html_body: string | null } | null {
  if (!body) return null;
  if (htmlBody) return null;

  const looksRaw = /BODY\[TEXT\]|\r?\nA\d{4}\s+(OK|NO|BAD)\b|\r?\n--[\w-]{8,}/i.test(body) || /Content-Type:\s*text\/(plain|html)/i.test(body);
  if (!looksRaw) return null;

  const parsed = tryParseMultipartFromBody(body);

  return {
    body: parsed.text || stripImapArtifacts(body) || null,
    html_body: parsed.html || null,
  };
}

// Timeout wrapper - fails fast instead of waiting forever
async function withTimeout<T>(promiseFn: () => Promise<T>, ms: number, errorMsg: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([promiseFn(), timeout]);
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body with error handling
    let action: string, tempEmailId: string, token: string, emailId: string | undefined;
    let limit = 50, offset = 0;
    
    try {
      const body = await req.json();
      action = body.action;
      tempEmailId = body.tempEmailId;
      token = body.token;
      emailId = body.emailId;
      limit = body.limit ?? 50;
      offset = body.offset ?? 0;
    } catch (parseError) {
      console.error('[secure-email-access] Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[secure-email-access] Action: ${action}, TempEmailId: ${tempEmailId}, limit: ${limit}, offset: ${offset}`);

    // Verify token for all actions
    if (!tempEmailId || !token) {
      console.log('[secure-email-access] Missing tempEmailId or token');
      return new Response(
        JSON.stringify({ error: 'Missing tempEmailId or token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the token matches - FAST with timeout
    let tempEmail: { id: string; secret_token: string } | null = null;
    
    try {
      const result = await withTimeout(
        async () => supabase
          .from('temp_emails')
          .select('id, secret_token')
          .eq('id', tempEmailId)
          .maybeSingle(),
        REQUEST_TIMEOUT_MS,
        'Database timeout - please try again'
      );
      
      if (result.error) {
        throw new Error(result.error.message || 'Database error');
      }
      
      tempEmail = result.data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[secure-email-access] Error fetching temp email:', errorMsg);
      
      return new Response(
        JSON.stringify({ 
          error: 'Temporary connection issue', 
          details: errorMsg,
          retryable: true
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tempEmail) {
      console.log('[secure-email-access] Temp email not found for ID:', tempEmailId);
      return new Response(
        JSON.stringify({ error: 'Temp email not found', code: 'EMAIL_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (tempEmail.secret_token !== token) {
      console.log('[secure-email-access] Invalid token provided');
      return new Response(
        JSON.stringify({ error: 'Invalid access token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pre-warm encryption key for decrypt operations
    if (action === 'get_emails' || action === 'get_email') {
      getEncryptionKey().catch(() => {});
    }

    // Handle different actions
    switch (action) {
      case 'get_emails': {
        console.log('[secure-email-access] Fetching emails for temp email:', tempEmailId);
        
        const effectiveLimit = Math.min(Math.max(1, limit), 100);
        
        const result = await withTimeout(
          async () => supabase
            .from('received_emails')
            .select('id, temp_email_id, from_address, subject, received_at, is_read, is_encrypted, encryption_key_id', { count: 'exact' })
            .eq('temp_email_id', tempEmailId)
            .order('received_at', { ascending: false })
            .range(offset, offset + effectiveLimit - 1),
          REQUEST_TIMEOUT_MS,
          'Email fetch timeout'
        );

        if (result.error) {
          console.error('[secure-email-access] Error fetching emails:', result.error);
          throw result.error;
        }

        // Decrypt only subjects for list view
        const decryptedEmails = await Promise.all(
          (result.data || []).map(async (email: { is_encrypted?: boolean; encryption_key_id?: string; subject?: string }) => {
            if (email.is_encrypted && email.encryption_key_id) {
              const [subjectIv] = email.encryption_key_id.split('|');
              return {
                ...email,
                subject: await decryptText(email.subject || '', subjectIv),
              };
            }
            return email;
          })
        );

        console.log(`[secure-email-access] Returning ${decryptedEmails.length} emails (total: ${result.count})`);
        return new Response(
          JSON.stringify({ 
            emails: decryptedEmails, 
            tempEmail: { id: tempEmail.id },
            pagination: {
              total: result.count || 0,
              limit: effectiveLimit,
              offset,
              hasMore: (result.count || 0) > offset + effectiveLimit
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_email': {
        if (!emailId) {
          return new Response(
            JSON.stringify({ error: 'Missing emailId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const result = await withTimeout(
          async () => supabase
            .from('received_emails')
            .select('*')
            .eq('id', emailId)
            .eq('temp_email_id', tempEmailId)
            .single(),
          REQUEST_TIMEOUT_MS,
          'Email fetch timeout'
        );

        if (result.error || !result.data) {
          throw new Error('Email not found');
        }

        const email = result.data;
        let decryptedEmail = email;
        if (email.is_encrypted && email.encryption_key_id) {
          const [subjectIv, bodyIv, htmlIv] = email.encryption_key_id.split('|');
          decryptedEmail = {
            ...email,
            subject: await decryptText(email.subject || '', subjectIv),
            body: await decryptText(email.body || '', bodyIv),
            html_body: await decryptText(email.html_body || '', htmlIv)
          };
        }

        const normalized = normalizeEmailBodies(decryptedEmail.body || null, decryptedEmail.html_body || null);
        if (normalized) {
          decryptedEmail = { ...decryptedEmail, ...normalized };
        }

        return new Response(
          JSON.stringify({ email: decryptedEmail }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'mark_read': {
        if (!emailId) {
          return new Response(
            JSON.stringify({ error: 'Missing emailId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await withTimeout(
          async () => supabase
            .from('received_emails')
            .update({ is_read: true })
            .eq('id', emailId)
            .eq('temp_email_id', tempEmailId),
          REQUEST_TIMEOUT_MS,
          'Update timeout'
        );

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[secure-email-access] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Temporary connection issue', 
        details: errorMessage,
        retryable: true
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});