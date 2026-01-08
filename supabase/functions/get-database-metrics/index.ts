import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[get-database-metrics] Fetching database metrics...');

    // Fetch table row counts in parallel
    const [
      receivedEmailsRes,
      tempEmailsRes,
      attachmentsRes,
      profilesRes,
      rateLimitsRes,
      emailStatsRes,
      cleanupSettingsRes,
    ] = await Promise.all([
      supabase.from('received_emails').select('id', { count: 'exact', head: true }),
      supabase.from('temp_emails').select('id', { count: 'exact', head: true }),
      supabase.from('email_attachments').select('id, file_size', { count: 'exact' }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('rate_limits').select('id', { count: 'exact', head: true }),
      supabase.from('email_stats').select('stat_key, stat_value'),
      supabase.from('app_settings').select('key, value').in('key', ['cache_settings', 'cleanup_stats']),
    ]);

    // Calculate attachment storage
    let totalAttachmentBytes = 0;
    if (attachmentsRes.data) {
      totalAttachmentBytes = attachmentsRes.data.reduce((sum, att) => sum + (att.file_size || 0), 0);
    }

    // Parse email stats
    const statsMap: Record<string, number> = {};
    if (emailStatsRes.data) {
      emailStatsRes.data.forEach(stat => {
        statsMap[stat.stat_key] = stat.stat_value || 0;
      });
    }

    // Parse cleanup settings
    let lastCleanup: string | null = null;
    let cleanupStats: any = null;
    if (cleanupSettingsRes.data) {
      const cleanupData = cleanupSettingsRes.data.find(s => s.key === 'cleanup_stats');
      if (cleanupData?.value) {
        cleanupStats = cleanupData.value;
        lastCleanup = cleanupStats.last_run || null;
      }
    }

    // Estimate row sizes (rough estimates in bytes)
    const estimatedRowSizes = {
      received_emails: 2000, // ~2KB per email (subject, body, metadata)
      temp_emails: 200, // ~200B per temp email
      profiles: 500, // ~500B per profile
      rate_limits: 100, // ~100B per rate limit entry
    };

    const metrics = {
      tables: {
        received_emails: {
          count: receivedEmailsRes.count || 0,
          size_estimate_mb: ((receivedEmailsRes.count || 0) * estimatedRowSizes.received_emails) / (1024 * 1024),
        },
        temp_emails: {
          count: tempEmailsRes.count || 0,
          size_estimate_mb: ((tempEmailsRes.count || 0) * estimatedRowSizes.temp_emails) / (1024 * 1024),
        },
        email_attachments: {
          count: attachmentsRes.count || 0,
          storage_mb: totalAttachmentBytes / (1024 * 1024),
        },
        profiles: {
          count: profilesRes.count || 0,
          size_estimate_mb: ((profilesRes.count || 0) * estimatedRowSizes.profiles) / (1024 * 1024),
        },
        rate_limits: {
          count: rateLimitsRes.count || 0,
          size_estimate_mb: ((rateLimitsRes.count || 0) * estimatedRowSizes.rate_limits) / (1024 * 1024),
        },
      },
      stats: {
        total_emails_generated: statsMap.total_emails_generated || 0,
        emails_today: statsMap.emails_today || 0,
        inboxes_today: statsMap.inboxes_today || 0,
      },
      cleanup: {
        last_run: lastCleanup,
        stats: cleanupStats,
      },
      total_estimated_size_mb: 0,
      fetched_at: new Date().toISOString(),
    };

    // Calculate total estimated size
    metrics.total_estimated_size_mb = 
      metrics.tables.received_emails.size_estimate_mb +
      metrics.tables.temp_emails.size_estimate_mb +
      metrics.tables.email_attachments.storage_mb +
      metrics.tables.profiles.size_estimate_mb +
      metrics.tables.rate_limits.size_estimate_mb;

    console.log('[get-database-metrics] Metrics fetched successfully');

    return new Response(JSON.stringify(metrics), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[get-database-metrics] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
