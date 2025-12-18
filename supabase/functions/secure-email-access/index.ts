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

    // Verify the token matches
    const { data: tempEmail, error: verifyError } = await supabase
      .from('temp_emails')
      .select('id, secret_token, address, domain_id, expires_at, is_active')
      .eq('id', tempEmailId)
      .single();

    if (verifyError || !tempEmail) {
      console.log('[secure-email-access] Temp email not found:', verifyError);
      return new Response(
        JSON.stringify({ error: 'Temp email not found' }),
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

        console.log(`[secure-email-access] Returning ${decryptedEmails.length} emails`);
        return new Response(
          JSON.stringify({ emails: decryptedEmails, tempEmail }),
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
