import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Connection pooling optimization (Edge Functions):
// Create the client once per warm runtime instance so subsequent requests reuse keep-alive connections.
// Let the platform handle timeouts naturally - do NOT use custom AbortController.
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
  db: { schema: "public" },
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tempEmailId, token, emailIds } = await req.json();

    if (!tempEmailId && !emailIds) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing tempEmailId or emailIds", code: "MISSING_PARAMS" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const now = new Date().toISOString();

    // Validate multiple emails at once
    if (emailIds && Array.isArray(emailIds) && emailIds.length > 0) {
      const limitedIds = emailIds.slice(0, 20);

      const result = await supabase
        .from("temp_emails")
        .select("id, address, domain_id, user_id, expires_at, is_active, created_at")
        .in("id", limitedIds)
        .eq("is_active", true)
        .gt("expires_at", now)
        .order("created_at", { ascending: false });

      if (result.error) {
        console.error("[validate-temp-email] DB error:", result.error);
        // Return 200 to avoid client hard-failing on transient backend issues.
        return new Response(
          JSON.stringify({ valid: false, error: "Database error", code: "DB_ERROR", retryable: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }

      const emails = result.data ?? [];
      if (emails.length === 0) {
        return new Response(
          JSON.stringify({ valid: false, error: "No valid emails found", code: "NO_VALID_EMAILS" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Single email validation
    if (!token) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing token", code: "MISSING_TOKEN" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const result = await supabase
      .from("temp_emails")
      .select("id, address, domain_id, user_id, expires_at, is_active, created_at, secret_token")
      .eq("id", tempEmailId)
      .maybeSingle();

    if (result.error) {
      // If fetch timed out, our custom fetch aborts and this typically comes back as a generic error.
      console.error("[validate-temp-email] DB error:", result.error);
      return new Response(
        JSON.stringify({ valid: false, error: "Request timeout", code: "TIMEOUT", retryable: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const tempEmail = result.data;
    if (!tempEmail) {
      return new Response(
        JSON.stringify({ valid: false, error: "Email not found", code: "EMAIL_NOT_FOUND" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (tempEmail.secret_token !== token) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid token", code: "INVALID_TOKEN" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (new Date(tempEmail.expires_at) < new Date(now)) {
      return new Response(
        JSON.stringify({ valid: false, error: "Email expired", code: "EMAIL_EXPIRED" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (!tempEmail.is_active) {
      return new Response(
        JSON.stringify({ valid: false, error: "Email inactive", code: "EMAIL_INACTIVE" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error("[validate-temp-email] Error:", error);

    // Avoid crashing the app; caller can retry.
    return new Response(
      JSON.stringify({ valid: false, error: "Server error", code: "SERVER_ERROR", retryable: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});


