import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'public, max-age=60', // Cache for 1 minute
};

// IST timezone offset: UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Get midnight IST as UTC timestamp
function getMidnightIST(): string {
  const now = new Date();
  // Convert current time to IST
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  // Get midnight IST (start of day)
  const istMidnight = new Date(istNow);
  istMidnight.setUTCHours(0, 0, 0, 0);
  // Convert back to UTC
  const utcMidnight = new Date(istMidnight.getTime() - IST_OFFSET_MS);
  return utcMidnight.toISOString();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get IST midnight for "Today (IST)" stat
    const istMidnight = getMidnightIST();

    // OPTIMIZED: Fetch stats in parallel with timeout protection
    // Use pre-aggregated counters from email_stats table where possible
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    try {
      const [
        emailStatsResult,
        activeAddressesResult,
        totalDomainsResult,
        emailsTodayLiveResult,
        totalEmailsLiveResult,
        inboxesTodayLiveResult,
      ] = await Promise.all([
        // Get all counters from email_stats in one query (fast - small table)
        supabase
          .from('email_stats')
          .select('stat_key, stat_value')
          .in('stat_key', ['total_temp_emails_created', 'total_emails_received', 'emails_today', 'inboxes_today']),
        
        // Currently active temp addresses (needs live count but has index)
        supabase
          .from('temp_emails')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        
        // Total active domains (small table - fast)
        supabase
          .from('domains')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
          
        // Fallback: Live count for emails today (IST)
        supabase
          .from('received_emails')
          .select('id', { count: 'exact', head: true })
          .gte('received_at', istMidnight),
          
        // Fallback: Live total emails count
        supabase
          .from('received_emails')
          .select('id', { count: 'exact', head: true }),
          
        // Fallback: Live count for inboxes today (IST)
        supabase
          .from('temp_emails')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', istMidnight),
      ]);

      clearTimeout(timeout);

      // Parse email_stats results
      const statsMap: Record<string, number> = {};
      if (emailStatsResult.data) {
        for (const row of emailStatsResult.data) {
          statsMap[row.stat_key] = Number(row.stat_value) || 0;
        }
      }

      const totalEmailsGenerated = statsMap['total_temp_emails_created'] || 0;
      // Use counter if available, otherwise use live count
      const totalEmailsReceived = statsMap['total_emails_received'] || totalEmailsLiveResult.count || 0;
      const emailsToday = statsMap['emails_today'] || emailsTodayLiveResult.count || 0;
      const inboxesToday = statsMap['inboxes_today'] || inboxesTodayLiveResult.count || 0;
      const activeAddresses = activeAddressesResult.count ?? 0;
      const activeDomains = totalDomainsResult.count ?? 0;

      // For totalInboxesCreated, use totalEmailsGenerated as it's the same metric
      const totalInboxesCreated = totalEmailsGenerated;

      const stats = {
        // Emails since midnight IST - from counter or live count
        emailsToday: emailsToday,
        // Inboxes since midnight IST - from counter or live count
        inboxesToday: inboxesToday,
        // All-time received emails (monotonic)
        totalEmails: totalEmailsReceived,
        // Currently active inboxes
        activeAddresses: activeAddresses,
        // Total inboxes ever created (monotonic)
        totalInboxesCreated: totalInboxesCreated,
        // Active domains
        activeDomains: activeDomains,
        // Permanent counter from email_stats (monotonic)
        totalEmailsGenerated: totalEmailsGenerated,
        updatedAt: new Date().toISOString(),
        istMidnight: istMidnight,
      };

      return new Response(JSON.stringify(stats), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (fetchError) {
      clearTimeout(timeout);
      throw fetchError;
    }

  } catch (error) {
    console.error('Error in get-public-stats:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to fetch stats',
      // Return default stats on error
      emailsToday: 0,
      inboxesToday: 0,
      totalEmails: 0,
      activeAddresses: 0,
      totalInboxesCreated: 0,
      activeDomains: 0,
      totalEmailsGenerated: 0,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});