import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin", { _user_id: user.id });

    if (adminError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { autoConfirmEmail } = await req.json();

    // Save the setting to app_settings for application-level enforcement
    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .eq('key', 'registration_settings')
      .maybeSingle();

    if (existing) {
      // Get current settings and update
      const { data: currentData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'registration_settings')
        .single();

      const currentSettings = currentData?.value as Record<string, unknown> || {};
      
      await supabase
        .from('app_settings')
        .update({
          value: { ...currentSettings, requireEmailConfirmation: !autoConfirmEmail },
          updated_at: new Date().toISOString()
        })
        .eq('key', 'registration_settings');
    }

    console.log(`Auth configuration updated: autoConfirmEmail=${autoConfirmEmail}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email confirmation setting saved successfully",
        requireEmailConfirmation: !autoConfirmEmail
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error configuring auth:", error);
    const message = error instanceof Error ? error.message : "Failed to configure auth";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
