import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hash function to match the one used in create-verification-and-send
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    console.log(`[verify-email-token] Verifying token`);

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Hash the provided token to compare with stored hash
    const hashedToken = await hashToken(token);

    // Find the verification record using the HASHED token
    const { data: verification, error: findError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('token', hashedToken)
      .is('verified_at', null)
      .single();

    if (findError || !verification) {
      console.error('[verify-email-token] Token not found or already used:', findError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired verification token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token has expired
    if (new Date(verification.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Verification token has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark the verification as complete
    const { error: updateVerificationError } = await supabase
      .from('email_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', verification.id);

    if (updateVerificationError) {
      console.error('[verify-email-token] Failed to update verification:', updateVerificationError);
    }

    // UPSERT the user's profile to ensure it exists and mark email as verified
    // This fixes the bug where UPDATE on non-existent row silently does nothing
    const { error: upsertProfileError } = await supabase
      .from('profiles')
      .upsert(
        { 
          user_id: verification.user_id, 
          email: verification.email,
          email_verified: true,
          updated_at: new Date().toISOString()
        },
        { 
          onConflict: 'user_id',
          ignoreDuplicates: false
        }
      );

    if (upsertProfileError) {
      console.error('[verify-email-token] Failed to upsert profile:', upsertProfileError);
      // Don't fail the verification - the email_verifications table is updated
      // The profile might be created by handle_new_user trigger
    } else {
      console.log(`[verify-email-token] Profile upserted with email_verified=true for user ${verification.user_id}`);
    }

    console.log(`[verify-email-token] Email verified successfully for user ${verification.user_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email verified successfully",
        email: verification.email
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[verify-email-token] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Verification failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
