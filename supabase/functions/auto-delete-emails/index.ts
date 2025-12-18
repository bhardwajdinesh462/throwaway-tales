import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[AUTO-DELETE CRON] Starting cleanup at ${new Date().toISOString()}`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get cache settings
    const { data: settingsData } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "cache_settings")
      .single();

    const settings = settingsData?.value || {
      autoDeleteEnabled: true,
      autoDeleteHours: 48,
    };

    if (!settings.autoDeleteEnabled) {
      console.log("[AUTO-DELETE CRON] Auto-delete is disabled, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Auto-delete disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cutoffDate = new Date(Date.now() - settings.autoDeleteHours * 60 * 60 * 1000).toISOString();
    console.log(`[AUTO-DELETE CRON] Deleting emails older than ${cutoffDate}`);

    const stats = { deletedEmails: 0, deletedAttachments: 0, deletedTempEmails: 0 };

    // 1. Get old emails
    const { data: oldEmails } = await supabase
      .from("received_emails")
      .select("id")
      .lt("received_at", cutoffDate);

    if (oldEmails && oldEmails.length > 0) {
      const emailIds = oldEmails.map(e => e.id);

      // Get and delete attachments from storage
      const { data: attachments } = await supabase
        .from("email_attachments")
        .select("storage_path")
        .in("received_email_id", emailIds);

      if (attachments && attachments.length > 0) {
        const paths = attachments.map(a => a.storage_path);
        await supabase.storage.from("email-attachments").remove(paths);
        
        // Delete attachment records
        await supabase
          .from("email_attachments")
          .delete()
          .in("received_email_id", emailIds);
        
        stats.deletedAttachments = attachments.length;
      }

      // Delete emails
      const { error: deleteError } = await supabase
        .from("received_emails")
        .delete()
        .lt("received_at", cutoffDate);

      if (!deleteError) {
        stats.deletedEmails = oldEmails.length;
      }
    }

    // 2. Clean up expired temp emails
    const now = new Date().toISOString();
    const { data: expiredTempEmails } = await supabase
      .from("temp_emails")
      .select("id")
      .lt("expires_at", now);

    if (expiredTempEmails && expiredTempEmails.length > 0) {
      const tempEmailIds = expiredTempEmails.map(e => e.id);

      // Get received emails for these temp emails
      const { data: receivedEmails } = await supabase
        .from("received_emails")
        .select("id")
        .in("temp_email_id", tempEmailIds);

      if (receivedEmails && receivedEmails.length > 0) {
        const emailIds = receivedEmails.map(e => e.id);

        // Delete attachments
        const { data: attachments } = await supabase
          .from("email_attachments")
          .select("storage_path")
          .in("received_email_id", emailIds);

        if (attachments && attachments.length > 0) {
          await supabase.storage.from("email-attachments").remove(attachments.map(a => a.storage_path));
          await supabase.from("email_attachments").delete().in("received_email_id", emailIds);
          stats.deletedAttachments += attachments.length;
        }

        // Delete received emails
        await supabase.from("received_emails").delete().in("temp_email_id", tempEmailIds);
        stats.deletedEmails += receivedEmails.length;
      }

      // Delete expired temp emails
      await supabase.from("temp_emails").delete().lt("expires_at", now);
      stats.deletedTempEmails = expiredTempEmails.length;
    }

    const duration = Date.now() - startTime;
    console.log(`[AUTO-DELETE CRON] Complete: ${stats.deletedEmails} emails, ${stats.deletedAttachments} attachments, ${stats.deletedTempEmails} temp emails in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        settings: { hours: settings.autoDeleteHours },
        durationMs: duration,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[AUTO-DELETE CRON] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
