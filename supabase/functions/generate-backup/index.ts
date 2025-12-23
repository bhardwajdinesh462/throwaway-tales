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
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[generate-backup] Starting backup generation for admin:', user.email);

    // Define tables to backup
    const tables = [
      'profiles',
      'temp_emails',
      'received_emails',
      'domains',
      'blogs',
      'app_settings',
      'banners',
      'email_templates',
      'subscription_tiers',
      'user_subscriptions',
      'user_roles',
      'email_logs',
      'email_restrictions',
      'blocked_ips',
      'friendly_websites',
      'backup_history',
    ];

    const backup: Record<string, any> = {
      metadata: {
        created_at: new Date().toISOString(),
        created_by: user.email,
        version: '1.0',
        tables: tables,
      },
      data: {},
    };

    const rowCounts: Record<string, number> = {};
    let totalSize = 0;

    // Fetch data from each table
    for (const table of tables) {
      try {
        const { data, error } = await serviceClient
          .from(table)
          .select('*')
          .limit(10000);

        if (error) {
          console.warn(`[generate-backup] Warning: Could not backup table ${table}:`, error.message);
          backup.data[table] = { error: error.message };
          rowCounts[table] = 0;
        } else {
          backup.data[table] = data || [];
          rowCounts[table] = data?.length || 0;
          totalSize += JSON.stringify(data).length;
        }
      } catch (err) {
        console.warn(`[generate-backup] Error backing up table ${table}:`, err);
        backup.data[table] = { error: 'Failed to fetch' };
        rowCounts[table] = 0;
      }
    }

    console.log('[generate-backup] Backup complete. Row counts:', rowCounts);

    // Record backup in history
    await serviceClient
      .from('backup_history')
      .insert({
        backup_type: 'manual',
        status: 'completed',
        file_size_bytes: totalSize,
        tables_included: tables,
        row_counts: rowCounts,
        created_by: user.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        backup,
        rowCounts,
        totalSize,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: unknown) {
    console.error('[generate-backup] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to generate backup', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
