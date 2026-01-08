import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Shorter timeout - fail fast for better UX
const REQUEST_TIMEOUT_MS = 4000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const { tempEmailId, token, emailIds } = await req.json();

    if (!tempEmailId && !emailIds) {
      clearTimeout(timeoutId);
      return new Response(
        JSON.stringify({ valid: false, error: 'Missing tempEmailId or emailIds', code: 'MISSING_PARAMS' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      db: { schema: 'public' }
    });

    const now = new Date().toISOString();

    // Batch validation - validate multiple emails at once
    if (emailIds && Array.isArray(emailIds) && emailIds.length > 0) {
      const limitedIds = emailIds.slice(0, 10); // Reduce limit for faster queries
      
      const { data: emails, error } = await supabase
        .from('temp_emails')
        .select('id, address, domain_id, user_id, expires_at, is_active, created_at')
        .in('id', limitedIds)
        .eq('is_active', true)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(10);

      clearTimeout(timeoutId);

      if (error) {
        console.error('[validate-temp-email] DB error:', error.message);
        return new Response(
          JSON.stringify({ valid: false, error: 'Database error', code: 'DB_ERROR', retryable: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
        );
      }

      if (!emails || emails.length === 0) {
        return new Response(
          JSON.stringify({ valid: false, error: 'No valid emails found', code: 'NO_VALID_EMAILS' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

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
      clearTimeout(timeoutId);
      return new Response(
        JSON.stringify({ valid: false, error: 'Missing token', code: 'MISSING_TOKEN' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { data: tempEmail, error } = await supabase
      .from('temp_emails')
      .select('id, address, domain_id, user_id, expires_at, is_active, created_at, secret_token')
      .eq('id', tempEmailId)
      .maybeSingle();

    clearTimeout(timeoutId);

    if (error) {
      console.error('[validate-temp-email] DB error:', error.message);
      return new Response(
        JSON.stringify({ valid: false, error: 'Database error', code: 'DB_ERROR', retryable: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      );
    }

    if (!tempEmail) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Email not found', code: 'EMAIL_NOT_FOUND' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Validate token
    if (tempEmail.secret_token !== token) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid token', code: 'INVALID_TOKEN' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check expiry
    if (new Date(tempEmail.expires_at) < new Date(now)) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Email expired', code: 'EMAIL_EXPIRED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check active
    if (!tempEmail.is_active) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Email inactive', code: 'EMAIL_INACTIVE' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

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
    clearTimeout(timeoutId);
    const error = err as Error;
    
    // Handle abort specifically
    if (error.name === 'AbortError' || error.message?.includes('abort')) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Request timeout', code: 'TIMEOUT', retryable: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
      );
    }
    
    console.error('[validate-temp-email] Error:', error.message);
    return new Response(
      JSON.stringify({ valid: false, error: 'Server error', code: 'SERVER_ERROR', retryable: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
    );
  }
});
