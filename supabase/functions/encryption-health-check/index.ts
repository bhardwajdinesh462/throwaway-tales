import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[encryption-health-check] Starting health check...');

    const results = {
      encryption_key: {
        configured: false,
        status: 'unconfigured' as 'healthy' | 'unhealthy' | 'unconfigured',
        message: '',
      },
      database_encryption: {
        encrypt_function: false,
        decrypt_function: false,
        round_trip_test: false,
        status: 'unhealthy' as 'healthy' | 'unhealthy' | 'unconfigured',
        message: '',
      },
      encrypted_data: {
        mailboxes_smtp: { total: 0, encrypted: 0, plaintext: 0 },
        mailboxes_imap: { total: 0, encrypted: 0, plaintext: 0 },
        user_2fa: { total: 0, encrypted: 0, plaintext: 0 },
      },
      overall: 'unhealthy' as 'healthy' | 'degraded' | 'unhealthy',
      checked_at: new Date().toISOString(),
    };

    // Check if DB_ENCRYPTION_KEY is set
    const dbEncryptionKey = Deno.env.get('DB_ENCRYPTION_KEY');
    if (dbEncryptionKey && dbEncryptionKey.length >= 16) {
      results.encryption_key.configured = true;
      results.encryption_key.status = 'healthy';
      results.encryption_key.message = 'Custom encryption key is configured';
    } else {
      results.encryption_key.configured = false;
      results.encryption_key.status = 'unconfigured';
      results.encryption_key.message = 'Using default encryption key (not recommended for production)';
    }

    // Test database encryption functions
    try {
      // Test encrypt function
      const testValue = `test_${Date.now()}`;
      const { data: encryptData, error: encryptError } = await supabase.rpc('encrypt_sensitive', {
        p_plaintext: testValue,
      });

      if (encryptError) {
        console.error('[encryption-health-check] Encrypt function error:', encryptError);
        results.database_encryption.message = `Encrypt function failed: ${encryptError.message}`;
      } else {
        results.database_encryption.encrypt_function = true;

        // Test decrypt function
        const { data: decryptData, error: decryptError } = await supabase.rpc('decrypt_sensitive', {
          p_ciphertext: encryptData,
        });

        if (decryptError) {
          console.error('[encryption-health-check] Decrypt function error:', decryptError);
          results.database_encryption.message = `Decrypt function failed: ${decryptError.message}`;
        } else {
          results.database_encryption.decrypt_function = true;

          // Verify round-trip
          if (decryptData === testValue) {
            results.database_encryption.round_trip_test = true;
            results.database_encryption.status = 'healthy';
            results.database_encryption.message = 'Encryption functions working correctly';
          } else {
            results.database_encryption.message = 'Round-trip test failed: decrypted value does not match';
          }
        }
      }
    } catch (err) {
      console.error('[encryption-health-check] Database encryption test error:', err);
      results.database_encryption.message = `Error testing encryption: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }

    // Check encrypted data status in mailboxes
    try {
      const { data: mailboxes, error: mailboxError } = await supabase
        .from('mailboxes')
        .select('id, smtp_password, smtp_password_encrypted, imap_password, imap_password_encrypted');

      if (!mailboxError && mailboxes) {
        results.encrypted_data.mailboxes_smtp.total = mailboxes.length;
        results.encrypted_data.mailboxes_imap.total = mailboxes.length;

        mailboxes.forEach((mb: any) => {
          // SMTP
          if (mb.smtp_password_encrypted && mb.smtp_password_encrypted !== '') {
            results.encrypted_data.mailboxes_smtp.encrypted++;
          }
          if (mb.smtp_password && mb.smtp_password !== '') {
            results.encrypted_data.mailboxes_smtp.plaintext++;
          }
          // IMAP
          if (mb.imap_password_encrypted && mb.imap_password_encrypted !== '') {
            results.encrypted_data.mailboxes_imap.encrypted++;
          }
          if (mb.imap_password && mb.imap_password !== '') {
            results.encrypted_data.mailboxes_imap.plaintext++;
          }
        });
      }
    } catch (err) {
      console.error('[encryption-health-check] Mailboxes check error:', err);
    }

    // Check encrypted data status in user_2fa
    try {
      const { data: twoFaRecords, error: twoFaError } = await supabase
        .from('user_2fa')
        .select('id, totp_secret, totp_secret_encrypted');

      if (!twoFaError && twoFaRecords) {
        results.encrypted_data.user_2fa.total = twoFaRecords.length;

        twoFaRecords.forEach((record: any) => {
          if (record.totp_secret_encrypted && record.totp_secret_encrypted !== '') {
            results.encrypted_data.user_2fa.encrypted++;
          }
          if (record.totp_secret && record.totp_secret !== '' && record.totp_secret !== '***ENCRYPTED***') {
            results.encrypted_data.user_2fa.plaintext++;
          }
        });
      }
    } catch (err) {
      console.error('[encryption-health-check] 2FA check error:', err);
    }

    // Determine overall status
    const hasPlaintextData = 
      results.encrypted_data.mailboxes_smtp.plaintext > 0 ||
      results.encrypted_data.mailboxes_imap.plaintext > 0 ||
      results.encrypted_data.user_2fa.plaintext > 0;

    if (
      results.encryption_key.status === 'healthy' &&
      results.database_encryption.status === 'healthy' &&
      !hasPlaintextData
    ) {
      results.overall = 'healthy';
    } else if (
      results.database_encryption.status === 'healthy' &&
      !hasPlaintextData
    ) {
      results.overall = 'degraded'; // Working but using default key
    } else {
      results.overall = 'unhealthy';
    }

    console.log('[encryption-health-check] Health check completed:', results.overall);

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[encryption-health-check] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
