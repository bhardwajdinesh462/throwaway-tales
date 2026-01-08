import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// HARD TIMEOUT - fail fast, don't wait forever
const REQUEST_TIMEOUT_MS = 6000; // 6 seconds max

// Timeout wrapper for fail-fast behavior
async function withTimeout<T>(promiseFn: () => Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), ms);
  });
  return Promise.race([promiseFn(), timeout]);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tempEmailId, token, emailIds } = await req.json();

    if (!tempEmailId && !emailIds) {
      console.error('[validate-temp-email] Missing tempEmailId or emailIds');
      return new Response(
        JSON.stringify({ valid: false, error: 'Missing tempEmailId or emailIds', code: 'MISSING_PARAMS' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create service role client to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // If emailIds array provided, validate multiple emails at once
    if (emailIds && Array.isArray(emailIds) && emailIds.length > 0) {
      const limitedIds = emailIds.slice(0, 20);
      console.log(`[validate-temp-email] Validating ${limitedIds.length} emails`);
      
      const result = await withTimeout(
        async () => supabase
          .from('temp_emails')
          .select('id, address, domain_id, user_id, expires_at, is_active, created_at')
          .in('id', limitedIds)
          .eq('is_active', true)
          .gt('expires_at', now)
          .order('created_at', { ascending: false }),
        REQUEST_TIMEOUT_MS
      );

      if (result.error) {
        console.error('[validate-temp-email] Database error:', result.error);
        return new Response(
          JSON.stringify({ 
            valid: false, 
            error: 'Database error', 
            code: 'DB_ERROR',
            retryable: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
        );
      }

      const emails = result.data;
      if (!emails || emails.length === 0) {
        console.log('[validate-temp-email] No valid emails found from provided IDs');
        return new Response(
          JSON.stringify({ valid: false, error: 'No valid emails found', code: 'NO_VALID_EMAILS' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      console.log(`[validate-temp-email] Found ${emails.length} valid emails`);
      
      const mostRecent = emails[0];
      return new Response(
        JSON.stringify({
          valid: true,
          email: {
            id: mostRecent.id,
            address: mostRecent.address,
            domain_id: mostRecent.domain_id,
            user_id: mostRecent.user_id,
            expires_at: mostRecent.expires_at,
            is_active: mostRecent.is_active,
            created_at: mostRecent.created_at,
          },
          validEmailIds: emails.map((e: { id: string }) => e.id),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Single email validation with token
    if (!token) {
      console.error('[validate-temp-email] Missing token for single email validation');
      return new Response(
        JSON.stringify({ valid: false, error: 'Missing token', code: 'MISSING_TOKEN' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[validate-temp-email] Validating single email: ${tempEmailId}`);

    const result = await withTimeout(
      async () => supabase
        .from('temp_emails')
        .select('id, address, domain_id, user_id, expires_at, is_active, created_at, secret_token')
        .eq('id', tempEmailId)
        .single(),
      REQUEST_TIMEOUT_MS
    );

    if (result.error || !result.data) {
      console.log('[validate-temp-email] Email not found:', result.error?.message);
      return new Response(
        JSON.stringify({ valid: false, error: 'Email not found', code: 'EMAIL_NOT_FOUND' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const tempEmail = result.data;

    // Validate token
    if (tempEmail.secret_token !== token) {
      console.log('[validate-temp-email] Invalid token');
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid token', code: 'INVALID_TOKEN' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if expired
    if (new Date(tempEmail.expires_at) < new Date(now)) {
      console.log('[validate-temp-email] Email expired');
      return new Response(
        JSON.stringify({ valid: false, error: 'Email expired', code: 'EMAIL_EXPIRED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if active
    if (!tempEmail.is_active) {
      console.log('[validate-temp-email] Email inactive');
      return new Response(
        JSON.stringify({ valid: false, error: 'Email inactive', code: 'EMAIL_INACTIVE' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('[validate-temp-email] Email validated successfully:', tempEmail.address);

    return new Response(
      JSON.stringify({
        valid: true,
        email: {
          id: tempEmail.id,
          address: tempEmail.address,
          domain_id: tempEmail.domain_id,
          user_id: tempEmail.user_id,
          expires_at: tempEmail.expires_at,
          is_active: tempEmail.is_active,
          created_at: tempEmail.created_at,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (err) {
    const error = err as Error;
    console.error('[validate-temp-email] Error:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: 'Request timeout or connection error',
        code: 'TIMEOUT',
        retryable: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
    );
  }
});