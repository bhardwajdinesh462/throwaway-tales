import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[DELETE-DUPLICATES] Starting duplicate email cleanup");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First, get the count of duplicates
    const { data: allEmails, error: fetchError } = await supabase
      .from("received_emails")
      .select("id, temp_email_id, from_address, subject, received_at")
      .order("id", { ascending: true });

    if (fetchError) {
      console.error("[DELETE-DUPLICATES] Error fetching emails:", fetchError);
      throw fetchError;
    }

    console.log(`[DELETE-DUPLICATES] Found ${allEmails?.length || 0} total emails`);

    // Find duplicates by grouping
    const emailMap = new Map<string, string[]>();
    
    for (const email of allEmails || []) {
      const key = `${email.temp_email_id}|${email.from_address}|${email.subject}|${email.received_at}`.toLowerCase();
      if (!emailMap.has(key)) {
        emailMap.set(key, []);
      }
      emailMap.get(key)!.push(email.id);
    }

    // Collect IDs to delete (all but the first in each group)
    const idsToDelete: string[] = [];
    let duplicateGroups = 0;

    for (const [key, ids] of emailMap.entries()) {
      if (ids.length > 1) {
        duplicateGroups++;
        // Keep the first one (oldest by id), delete the rest
        const [keep, ...remove] = ids;
        idsToDelete.push(...remove);
        console.log(`[DELETE-DUPLICATES] Group: keeping ${keep}, removing ${remove.length} duplicates`);
      }
    }

    console.log(`[DELETE-DUPLICATES] Found ${duplicateGroups} duplicate groups, ${idsToDelete.length} emails to delete`);

    if (idsToDelete.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No duplicate emails found",
          deleted: 0,
          duplicateGroups: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete in batches of 100 to avoid issues
    let totalDeleted = 0;
    const batchSize = 100;

    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);
      
      // First delete related attachments
      const { error: attachmentError } = await supabase
        .from("email_attachments")
        .delete()
        .in("received_email_id", batch);

      if (attachmentError) {
        console.error(`[DELETE-DUPLICATES] Error deleting attachments:`, attachmentError);
      }

      // Then delete the emails
      const { error: deleteError, count } = await supabase
        .from("received_emails")
        .delete()
        .in("id", batch);

      if (deleteError) {
        console.error(`[DELETE-DUPLICATES] Error deleting batch ${i / batchSize + 1}:`, deleteError);
      } else {
        totalDeleted += batch.length;
        console.log(`[DELETE-DUPLICATES] Deleted batch ${i / batchSize + 1}: ${batch.length} emails`);
      }
    }

    console.log(`[DELETE-DUPLICATES] Complete: deleted ${totalDeleted} duplicate emails`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${totalDeleted} duplicate emails from ${duplicateGroups} groups`,
        deleted: totalDeleted,
        duplicateGroups,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[DELETE-DUPLICATES] Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to delete duplicate emails",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
