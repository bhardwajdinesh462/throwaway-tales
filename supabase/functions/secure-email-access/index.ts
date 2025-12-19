import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple encryption/decryption using Web Crypto API
const ENCRYPTION_KEY = Deno.env.get('EMAIL_ENCRYPTION_KEY') || 'default-key-change-in-production';

async function getEncryptionKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
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
}

async function encryptText(text: string): Promise<{ encrypted: string; iv: string }> {
  if (!text) return { encrypted: '', iv: '' };
  
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text)
  );
  
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  };
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

  // Only attempt normalization for obvious raw IMAP/MIME payloads
  const looksRaw = /BODY\[TEXT\]|\r?\nA\d{4}\s+(OK|NO|BAD)\b|\r?\n--[\w-]{8,}/i.test(body) || /Content-Type:\s*text\/(plain|html)/i.test(body);
  if (!looksRaw) return null;

  const parsed = tryParseMultipartFromBody(body);

  return {
    body: parsed.text || stripImapArtifacts(body) || null,
    html_body: parsed.html || null,
  };
}

// Retry helper for transient network errors
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRetryable = errorMessage.includes('connection reset') || 
                          errorMessage.includes('connection error') ||
                          errorMessage.includes('SendRequest');
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      console.log(`[secure-email-access] Retry ${attempt}/${maxRetries} after error: ${errorMessage}`);
      await new Promise(r => setTimeout(r, delay * attempt));
    }
  }
  throw lastError;
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

    const { action, tempEmailId, token, emailId } = await req.json();
    console.log(`[secure-email-access] Action: ${action}, TempEmailId: ${tempEmailId}`);

    // Verify token for all actions
    if (!tempEmailId || !token) {
      console.log('[secure-email-access] Missing tempEmailId or token');
      return new Response(
        JSON.stringify({ error: 'Missing tempEmailId or token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the token matches - use maybeSingle to avoid error when not found, with retry
    let tempEmail: { id: string; secret_token: string; address: string; domain_id: string; expires_at: string; is_active: boolean } | null = null;
    let verifyError: Error | null = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await supabase
        .from('temp_emails')
        .select('id, secret_token, address, domain_id, expires_at, is_active')
        .eq('id', tempEmailId)
        .maybeSingle();
      
      if (result.error) {
        const errorMessage = result.error.message || '';
        const isRetryable = errorMessage.includes('connection reset') || 
                            errorMessage.includes('connection error') ||
                            errorMessage.includes('SendRequest');
        
        if (isRetryable && attempt < 3) {
          console.log(`[secure-email-access] Retry ${attempt}/3 after error: ${errorMessage}`);
          await new Promise(r => setTimeout(r, 500 * attempt));
          continue;
        }
        verifyError = new Error(result.error.message);
        break;
      }
      
      tempEmail = result.data;
      break;
    }

    if (verifyError) {
      console.log('[secure-email-access] Error fetching temp email:', verifyError);
      return new Response(
        JSON.stringify({ error: 'Database error', details: verifyError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Handle different actions
    switch (action) {
      case 'get_emails': {
        console.log('[secure-email-access] Fetching emails for temp email:', tempEmailId);
        
        const { data: emails, error: emailsError } = await supabase
          .from('received_emails')
          .select('*')
          .eq('temp_email_id', tempEmailId)
          .order('received_at', { ascending: false });

        if (emailsError) {
          console.error('[secure-email-access] Error fetching emails:', emailsError);
          throw emailsError;
        }

        // Decrypt emails if encrypted
        const decryptedEmails = await Promise.all(
          (emails || []).map(async (email) => {
            if (email.is_encrypted && email.encryption_key_id) {
              const [subjectIv, bodyIv, htmlIv] = email.encryption_key_id.split('|');
              return {
                ...email,
                subject: await decryptText(email.subject || '', subjectIv),
                body: await decryptText(email.body || '', bodyIv),
                html_body: await decryptText(email.html_body || '', htmlIv)
              };
            }
            return email;
          })
        );

        const normalizedEmails = decryptedEmails.map((email) => {
          const normalized = normalizeEmailBodies(email.body || null, email.html_body || null);
          return normalized ? { ...email, ...normalized } : email;
        });

        console.log(`[secure-email-access] Returning ${normalizedEmails.length} emails`);
        return new Response(
          JSON.stringify({ emails: normalizedEmails, tempEmail }),
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

        const { data: email, error: emailError } = await supabase
          .from('received_emails')
          .select('*')
          .eq('id', emailId)
          .eq('temp_email_id', tempEmailId)
          .single();

        if (emailError || !email) {
          return new Response(
            JSON.stringify({ error: 'Email not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Decrypt if encrypted
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

        const { error: updateError } = await supabase
          .from('received_emails')
          .update({ is_read: true })
          .eq('id', emailId)
          .eq('temp_email_id', tempEmailId);

        if (updateError) throw updateError;

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
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
