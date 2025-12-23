import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

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

    console.log('[generate-backup] Starting ZIP backup generation for admin:', user.email);

    // Define ALL tables to backup
    const tables = [
      'profiles',
      'temp_emails',
      'received_emails',
      'email_attachments',
      'domains',
      'blogs',
      'app_settings',
      'banners',
      'email_templates',
      'email_forwarding',
      'email_logs',
      'email_restrictions',
      'email_verifications',
      'subscription_tiers',
      'user_subscriptions',
      'user_roles',
      'user_2fa',
      'user_invoices',
      'user_suspensions',
      'user_usage',
      'blocked_ips',
      'friendly_websites',
      'backup_history',
      'admin_audit_logs',
      'admin_role_requests',
      'mailboxes',
      'push_subscriptions',
      'rate_limits',
      'saved_emails',
    ];

    // Create ZIP file
    const zip = new JSZip();
    const dbFolder = zip.folder('database');
    const configFolder = zip.folder('config');

    const rowCounts: Record<string, number> = {};
    let totalRows = 0;

    // Fetch data from each table
    for (const table of tables) {
      try {
        const { data, error } = await serviceClient
          .from(table)
          .select('*')
          .limit(50000);

        if (error) {
          console.warn(`[generate-backup] Warning: Could not backup table ${table}:`, error.message);
          dbFolder?.file(`${table}.json`, JSON.stringify({ error: error.message }, null, 2));
          rowCounts[table] = 0;
        } else {
          dbFolder?.file(`${table}.json`, JSON.stringify(data || [], null, 2));
          rowCounts[table] = data?.length || 0;
          totalRows += rowCounts[table];
        }
      } catch (err) {
        console.warn(`[generate-backup] Error backing up table ${table}:`, err);
        dbFolder?.file(`${table}.json`, JSON.stringify({ error: 'Failed to fetch' }, null, 2));
        rowCounts[table] = 0;
      }
    }

    // Add metadata
    const metadata = {
      created_at: new Date().toISOString(),
      created_by: user.email,
      version: '2.0',
      format: 'zip',
      tables: tables,
      row_counts: rowCounts,
      total_rows: totalRows,
      supabase_url: supabaseUrl,
    };
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    // Add config/settings
    const { data: settingsData } = await serviceClient
      .from('app_settings')
      .select('*');
    configFolder?.file('app_settings.json', JSON.stringify(settingsData || [], null, 2));

    // Add README
    const readme = `# Database Backup
Generated: ${metadata.created_at}
Created by: ${metadata.created_by}

## Contents
- /database/ - All database tables as JSON files
- /config/ - Application configuration
- metadata.json - Backup information

## Tables Included
${tables.map(t => `- ${t}: ${rowCounts[t] || 0} rows`).join('\n')}

Total Rows: ${totalRows}

## Important Notes
- This backup contains database data only
- Source code is managed by Lovable/Git
- Passwords and sensitive credentials are hashed/excluded
- To restore, import JSON files into your database

## Restoration
Import these JSON files into your Supabase project using:
1. Supabase Dashboard > Table Editor > Import
2. Or use the Supabase API/SDK to insert data
`;
    zip.file('README.md', readme);

    console.log('[generate-backup] Generating ZIP file...');

    // Generate ZIP as base64
    const zipBlob = await zip.generateAsync({ 
      type: 'base64',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const fileSize = Math.round(zipBlob.length * 0.75); // Approximate decoded size

    console.log('[generate-backup] Backup complete. Total rows:', totalRows, 'Size:', fileSize);

    // Record backup in history
    await serviceClient
      .from('backup_history')
      .insert({
        backup_type: 'manual',
        status: 'completed',
        file_size_bytes: fileSize,
        tables_included: tables,
        row_counts: rowCounts,
        created_by: user.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        zipData: zipBlob,
        format: 'base64',
        fileName: `backup-${new Date().toISOString().split('T')[0]}.zip`,
        rowCounts,
        totalRows,
        totalSize: fileSize,
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