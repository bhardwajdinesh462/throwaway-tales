import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'public, max-age=60', // Cache for 1 minute
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

    // Get today's date range
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    // Fetch stats in parallel
    const [
      { count: totalEmailsToday },
      { count: totalEmails },
      { count: activeAddresses },
      { count: totalDomains },
      { count: totalEmailsGenerated }
    ] = await Promise.all([
      // Emails received today
      supabase
        .from('received_emails')
        .select('*', { count: 'exact', head: true })
        .gte('received_at', todayStart)
        .lt('received_at', todayEnd),
      
      // Total emails received all time
      supabase
        .from('received_emails')
        .select('*', { count: 'exact', head: true }),
      
      // Active temp addresses
      supabase
        .from('temp_emails')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      
      // Total domains
      supabase
        .from('domains')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      
      // Total temp emails generated all time
      supabase
        .from('temp_emails')
        .select('*', { count: 'exact', head: true }),
    ]);

    const stats = {
      emailsToday: totalEmailsToday || 0,
      totalEmails: totalEmails || 0,
      activeAddresses: activeAddresses || 0,
      activeDomains: totalDomains || 0,
      totalEmailsGenerated: totalEmailsGenerated || 0,
      updatedAt: new Date().toISOString(),
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
      activeDomains: 0,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
