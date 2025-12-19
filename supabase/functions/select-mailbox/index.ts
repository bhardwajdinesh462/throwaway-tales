import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Call the database function to select available mailbox
    const { data: mailboxData, error: selectError } = await supabase.rpc('select_available_mailbox');

    if (selectError) {
      console.error("Error selecting mailbox:", selectError);
      return new Response(
        JSON.stringify({ error: "Failed to select mailbox", details: selectError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If no mailbox available from database, fall back to environment variables
    if (!mailboxData || mailboxData.length === 0) {
      console.log("No mailbox in database, falling back to environment variables");
      
      const smtpHost = Deno.env.get("SMTP_HOST");
      const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
      const smtpUser = Deno.env.get("SMTP_USER");
      const smtpPassword = Deno.env.get("SMTP_PASSWORD");
      const smtpFrom = Deno.env.get("SMTP_FROM") || smtpUser;

      if (!smtpHost || !smtpUser || !smtpPassword) {
        return new Response(
          JSON.stringify({ 
            error: "No available mailbox",
            reason: "All mailboxes are at their sending limit or SMTP not configured"
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          mailbox: {
            mailbox_id: null, // Indicates env var fallback
            smtp_host: smtpHost,
            smtp_port: smtpPort,
            smtp_user: smtpUser,
            smtp_password: smtpPassword,
            smtp_from: smtpFrom
          },
          source: "environment"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mailbox = mailboxData[0];
    console.log(`Selected mailbox ${mailbox.mailbox_id} for sending`);

    return new Response(
      JSON.stringify({
        success: true,
        mailbox: {
          mailbox_id: mailbox.mailbox_id,
          smtp_host: mailbox.smtp_host,
          smtp_port: mailbox.smtp_port,
          smtp_user: mailbox.smtp_user,
          smtp_password: mailbox.smtp_password,
          smtp_from: mailbox.smtp_from || mailbox.smtp_user
        },
        source: "database"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in select-mailbox:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
