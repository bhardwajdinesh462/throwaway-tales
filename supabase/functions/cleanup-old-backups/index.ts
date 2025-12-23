import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[cleanup-old-backups] Starting cleanup...');

    // Delete backup records older than 24 hours
    const { data, error } = await serviceClient
      .from('backup_history')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      console.error('[cleanup-old-backups] Error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to cleanup backups', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const deletedCount = data?.length || 0;
    console.log(`[cleanup-old-backups] Deleted ${deletedCount} expired backup records`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deletedCount,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: unknown) {
    console.error('[cleanup-old-backups] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to cleanup backups', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
