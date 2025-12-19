import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  userId: string;
}

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

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the calling user
    const { data: { user: callingUser }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !callingUser) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller is admin using the is_admin function
    const { data: isAdmin, error: adminCheckError } = await supabaseAdmin.rpc('is_admin', {
      _user_id: callingUser.id
    });

    if (adminCheckError || !isAdmin) {
      console.error("Admin check error:", adminCheckError);
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId }: DeleteUserRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${callingUser.id} deleting user ${userId}`);

    // Prevent self-deletion
    if (userId === callingUser.id) {
      return new Response(
        JSON.stringify({ error: "Cannot delete your own account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete related data first (cascade might not cover everything)
    const tablesToClean = [
      'user_roles',
      'profiles',
      'user_subscriptions',
      'user_suspensions',
      'user_2fa',
      'user_usage',
      'user_invoices',
      'email_verifications',
      'push_subscriptions',
      'saved_emails',
      'email_forwarding'
    ];

    for (const table of tablesToClean) {
      try {
        await supabaseAdmin.from(table).delete().eq('user_id', userId);
        console.log(`Cleaned ${table} for user ${userId}`);
      } catch (err) {
        console.log(`Note: Could not clean ${table} - may not exist or no records`);
      }
    }

    // Delete temp_emails belonging to this user
    const { data: tempEmails } = await supabaseAdmin
      .from('temp_emails')
      .select('id')
      .eq('user_id', userId);

    if (tempEmails && tempEmails.length > 0) {
      const tempEmailIds = tempEmails.map(te => te.id);
      
      // Delete received_emails for these temp_emails
      for (const tempEmailId of tempEmailIds) {
        await supabaseAdmin.from('received_emails').delete().eq('temp_email_id', tempEmailId);
      }
      
      // Delete temp_emails
      await supabaseAdmin.from('temp_emails').delete().eq('user_id', userId);
      console.log(`Deleted ${tempEmails.length} temp emails for user ${userId}`);
    }

    // Finally, delete from auth.users using the admin API
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Error deleting user from auth:", deleteError);
      return new Response(
        JSON.stringify({ error: `Failed to delete user: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the admin action
    await supabaseAdmin.rpc('log_admin_access', {
      p_action: 'delete_user',
      p_table_name: 'auth.users',
      p_record_id: userId,
      p_details: { deleted_by: callingUser.id }
    });

    console.log(`Successfully deleted user ${userId}`);

    return new Response(
      JSON.stringify({ success: true, message: "User deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in delete-user-complete:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
