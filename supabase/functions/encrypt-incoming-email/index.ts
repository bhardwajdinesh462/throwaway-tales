import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { emailId, subject, body, htmlBody } = await req.json();
    console.log(`[encrypt-incoming-email] Encrypting email: ${emailId}`);

    if (!emailId) {
      return new Response(
        JSON.stringify({ error: 'Missing emailId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Encrypt all content
    const [encryptedSubject, encryptedBody, encryptedHtml] = await Promise.all([
      encryptText(subject || ''),
      encryptText(body || ''),
      encryptText(htmlBody || '')
    ]);

    // Store encryption IVs for decryption
    const encryptionKeyId = `${encryptedSubject.iv}|${encryptedBody.iv}|${encryptedHtml.iv}`;

    // Update the email with encrypted content
    const { error: updateError } = await supabase
      .from('received_emails')
      .update({
        subject: encryptedSubject.encrypted,
        body: encryptedBody.encrypted,
        html_body: encryptedHtml.encrypted,
        is_encrypted: true,
        encryption_key_id: encryptionKeyId
      })
      .eq('id', emailId);

    if (updateError) {
      console.error('[encrypt-incoming-email] Update error:', updateError);
      throw updateError;
    }

    console.log(`[encrypt-incoming-email] Successfully encrypted email: ${emailId}`);
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[encrypt-incoming-email] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
