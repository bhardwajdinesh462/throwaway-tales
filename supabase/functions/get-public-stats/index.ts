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
    console.log('[get-public-stats] IST midnight (UTC):', istMidnight);

    // Fetch stats in parallel
    const [
      emailsTodayISTResult,
      totalEmailsReceivedResult,
      activeAddressesResult,
      totalInboxesCreatedResult,
      totalDomainsResult,
      emailStatsDataResult
    ] = await Promise.all([
      // Emails received since midnight IST (not rolling 24h)
      supabase
        .from('received_emails')
        .select('*', { count: 'exact', head: true })
        .gte('received_at', istMidnight),
      
      // Total emails received all time (monotonic)
      supabase
        .from('received_emails')
        .select('*', { count: 'exact', head: true }),
      
      // Currently active temp addresses
      supabase
        .from('temp_emails')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      
      // Total inboxes ever created (monotonic) - all temp_emails regardless of status
      supabase
        .from('temp_emails')
        .select('*', { count: 'exact', head: true }),
      
      // Total active domains
      supabase
        .from('domains')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      
      // Get permanent email generation count from email_stats table
      supabase
        .from('email_stats')
        .select('stat_value')
        .eq('stat_key', 'total_temp_emails_created')
        .maybeSingle(),
    ]);

    // Use ?? to preserve 0 values (|| would treat 0 as falsy)
    const emailsToday = emailsTodayISTResult.count ?? 0;
    const totalEmailsReceived = totalEmailsReceivedResult.count ?? 0;
    const activeAddresses = activeAddressesResult.count ?? 0;
    const totalInboxesCreated = totalInboxesCreatedResult.count ?? 0;
    const activeDomains = totalDomainsResult.count ?? 0;
    const totalEmailsGenerated = emailStatsDataResult.data?.stat_value ?? 0;

    const stats = {
      // Emails since midnight IST - resets at IST midnight
      emailsToday: emailsToday,
      // All-time received emails (monotonic)
      totalEmails: totalEmailsReceived,
      // Currently active inboxes (can go down as they expire)
      activeAddresses: activeAddresses,
      // Total inboxes ever created (monotonic) - for display as "Inboxes Created"
      totalInboxesCreated: totalInboxesCreated,
      // Active domains
      activeDomains: activeDomains,
      // Permanent counter from email_stats (monotonic) - never resets
      totalEmailsGenerated: Number(totalEmailsGenerated),
      updatedAt: new Date().toISOString(),
      // Include IST info for debugging
      istMidnight: istMidnight,
    };

    console.log('[get-public-stats] Returning stats:', stats);

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-public-stats:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to fetch stats',
      // Return default stats on error
      emailsToday: 0,
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