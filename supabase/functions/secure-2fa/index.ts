import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Encryption utilities
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get("EMAIL_ENCRYPTION_KEY") || "default-key-change-me";
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString.padEnd(32, '0').slice(0, 32));
  
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(text: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encryptedText: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );
    
    return new TextDecoder().decode(decrypted);
  } catch {
    // Return original if decryption fails (might be unencrypted)
    return encryptedText;
  }
}

// Hash function for tokens
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

interface TwoFARequest {
  action: 'setup' | 'enable' | 'disable' | 'verify' | 'get-secret';
  code?: string;
  secret?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, code, secret }: TwoFARequest = await req.json();
    console.log("2FA action:", action, "for user:", user.id);

    switch (action) {
      case 'setup': {
        // Generate secret and backup codes
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let newSecret = '';
        const randomBytes = new Uint8Array(20);
        crypto.getRandomValues(randomBytes);
        for (let i = 0; i < 20; i++) {
          newSecret += chars[randomBytes[i] % 32];
        }

        const backupCodes: string[] = [];
        for (let i = 0; i < 10; i++) {
          const codeBytes = crypto.getRandomValues(new Uint8Array(4));
          const backupCode = Array.from(codeBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
          backupCodes.push(backupCode);
        }

        // Encrypt secret and backup codes before storing
        const encryptedSecret = await encrypt(newSecret);
        const encryptedBackupCodes = await Promise.all(
          backupCodes.map(code => encrypt(code))
        );

        // Check if existing record
        const { data: existing } = await supabase
          .from('user_2fa')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('user_2fa')
            .update({
              totp_secret: encryptedSecret,
              backup_codes: encryptedBackupCodes,
              is_enabled: false,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('user_2fa')
            .insert([{
              user_id: user.id,
              totp_secret: encryptedSecret,
              backup_codes: encryptedBackupCodes,
              is_enabled: false,
            }]);

          if (error) throw error;
        }

        return new Response(
          JSON.stringify({ success: true, secret: newSecret, backupCodes }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'enable': {
        if (!code || !secret) {
          return new Response(
            JSON.stringify({ error: "Code and secret required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify the TOTP code
        const isValid = verifyTOTP(secret, code);
        if (!isValid) {
          return new Response(
            JSON.stringify({ error: "Invalid verification code" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase
          .from('user_2fa')
          .update({ is_enabled: true, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'disable': {
        const { error } = await supabase
          .from('user_2fa')
          .delete()
          .eq('user_id', user.id);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'verify': {
        if (!code) {
          return new Response(
            JSON.stringify({ error: "Code required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await supabase
          .from('user_2fa')
          .select('totp_secret, backup_codes')
          .eq('user_id', user.id)
          .eq('is_enabled', true)
          .maybeSingle();

        if (error || !data) {
          return new Response(
            JSON.stringify({ error: "2FA not configured" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Decrypt the secret
        const decryptedSecret = await decrypt(data.totp_secret);
        
        // Check TOTP first
        if (verifyTOTP(decryptedSecret, code)) {
          return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check backup codes
        const backupCodes = data.backup_codes as string[];
        for (let i = 0; i < backupCodes.length; i++) {
          const decryptedCode = await decrypt(backupCodes[i]);
          if (decryptedCode === code.toUpperCase()) {
            // Remove used backup code
            const newCodes = [...backupCodes];
            newCodes.splice(i, 1);
            await supabase
              .from('user_2fa')
              .update({ backup_codes: newCodes })
              .eq('user_id', user.id);
            
            return new Response(
              JSON.stringify({ success: true, usedBackupCode: true }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        return new Response(
          JSON.stringify({ error: "Invalid code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'get-secret': {
        const { data, error } = await supabase
          .from('user_2fa')
          .select('totp_secret')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error || !data) {
          return new Response(
            JSON.stringify({ error: "2FA not configured" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const decryptedSecret = await decrypt(data.totp_secret);
        return new Response(
          JSON.stringify({ success: true, secret: decryptedSecret }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: any) {
    console.error("Error in secure-2fa:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// TOTP verification
function verifyTOTP(secret: string, code: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  const step = 30;
  
  for (let i = -1; i <= 1; i++) {
    const timeCounter = Math.floor((now + i * step) / step);
    const generatedCode = generateTOTP(secret, timeCounter);
    if (generatedCode === code) {
      return true;
    }
  }
  return false;
}

function generateTOTP(secret: string, counter: number): string {
  const keyBytes = base32ToBytes(secret);
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }
  
  const hash = simpleHash(keyBytes, counterBytes);
  const offset = hash[hash.length - 1] & 0x0f;
  const code = (
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  ) % 1000000;
  
  return code.toString().padStart(6, '0');
}

function base32ToBytes(base32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanInput = base32.replace(/=+$/, '').toUpperCase();
  const output: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of cleanInput) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

function simpleHash(key: Uint8Array, data: Uint8Array): Uint8Array {
  const combined = new Uint8Array(key.length + data.length);
  combined.set(key);
  combined.set(data, key.length);
  
  const result = new Uint8Array(20);
  for (let i = 0; i < 20; i++) {
    let val = 0;
    for (let j = 0; j < combined.length; j++) {
      val = ((val * 31) + combined[j] + i) & 0xff;
    }
    result[i] = val;
  }
  return result;
}
