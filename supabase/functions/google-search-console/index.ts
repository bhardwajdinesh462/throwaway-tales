import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GSCTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  site_url?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();

  try {
    const body = req.method === 'POST' ? await req.json() : {};

    switch (action) {
      case 'authorize': {
        if (!clientId) {
          return new Response(
            JSON.stringify({ error: 'Google OAuth not configured. Please add GOOGLE_CLIENT_ID secret.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const redirectUri = body.redirectUri || `${url.origin}/google-search-console/callback`;
        const scopes = [
          'https://www.googleapis.com/auth/webmasters.readonly',
          'https://www.googleapis.com/auth/webmasters',
          'https://www.googleapis.com/auth/indexing'
        ];

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', scopes.join(' '));
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('state', body.state || crypto.randomUUID());

        return new Response(
          JSON.stringify({ authUrl: authUrl.toString() }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'callback': {
        if (!clientId || !clientSecret) {
          return new Response(
            JSON.stringify({ error: 'Google OAuth not configured' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { code, redirectUri } = body;
        if (!code) {
          return new Response(
            JSON.stringify({ error: 'Authorization code required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri || `${url.origin}/google-search-console/callback`,
          }),
        });

        const tokens = await tokenResponse.json();
        if (tokens.error) {
          console.error('Token exchange error:', tokens);
          return new Response(
            JSON.stringify({ error: tokens.error_description || 'Token exchange failed' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Store tokens
        const gscTokens: GSCTokens = {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: Date.now() + (tokens.expires_in * 1000),
        };

        await supabase
          .from('app_settings')
          .upsert({
            key: 'gsc_tokens',
            value: gscTokens,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'key' });

        console.log('GSC tokens stored successfully');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'status': {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'gsc_tokens')
          .maybeSingle();

        if (!data?.value) {
          return new Response(
            JSON.stringify({ connected: false }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tokens = data.value as GSCTokens;
        return new Response(
          JSON.stringify({
            connected: true,
            siteUrl: tokens.site_url,
            expiresAt: tokens.expires_at,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'disconnect': {
        await supabase
          .from('app_settings')
          .delete()
          .eq('key', 'gsc_tokens');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sites': {
        const accessToken = await getValidAccessToken(supabase, clientId!, clientSecret!);
        if (!accessToken) {
          return new Response(
            JSON.stringify({ error: 'Not connected to Google Search Console' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const sites = await response.json();
        return new Response(
          JSON.stringify(sites),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'select-site': {
        const { siteUrl } = body;
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'gsc_tokens')
          .maybeSingle();

        if (!data?.value) {
          return new Response(
            JSON.stringify({ error: 'Not connected' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tokens = data.value as GSCTokens;
        tokens.site_url = siteUrl;

        await supabase
          .from('app_settings')
          .update({ value: tokens, updated_at: new Date().toISOString() })
          .eq('key', 'gsc_tokens');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'submit-sitemap': {
        const accessToken = await getValidAccessToken(supabase, clientId!, clientSecret!);
        if (!accessToken) {
          return new Response(
            JSON.stringify({ error: 'Not connected to Google Search Console' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'gsc_tokens')
          .maybeSingle();

        const tokens = data?.value as GSCTokens;
        const siteUrl = body.siteUrl || tokens?.site_url;
        const sitemapUrl = body.sitemapUrl || `${siteUrl}/sitemap.xml`;

        if (!siteUrl) {
          return new Response(
            JSON.stringify({ error: 'No site URL configured' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error('Sitemap submission error:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to submit sitemap' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Sitemap submitted successfully:', sitemapUrl);

        return new Response(
          JSON.stringify({ success: true, sitemapUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'request-indexing': {
        const accessToken = await getValidAccessToken(supabase, clientId!, clientSecret!);
        if (!accessToken) {
          return new Response(
            JSON.stringify({ error: 'Not connected to Google Search Console' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { urlToIndex } = body;
        if (!urlToIndex) {
          return new Response(
            JSON.stringify({ error: 'URL to index required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Use URL Inspection API to request indexing
        const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: urlToIndex,
            type: 'URL_UPDATED',
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          console.error('Indexing request error:', result);
          return new Response(
            JSON.stringify({ success: false, error: result.error?.message || 'Indexing request failed' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Indexing requested for:', urlToIndex);

        return new Response(
          JSON.stringify({ success: true, result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'performance': {
        const accessToken = await getValidAccessToken(supabase, clientId!, clientSecret!);
        if (!accessToken) {
          return new Response(
            JSON.stringify({ error: 'Not connected to Google Search Console' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'gsc_tokens')
          .maybeSingle();

        const tokens = data?.value as GSCTokens;
        const siteUrl = body.siteUrl || tokens?.site_url;

        if (!siteUrl) {
          return new Response(
            JSON.stringify({ error: 'No site URL configured' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get last 28 days of data
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const response = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              startDate,
              endDate,
              dimensions: ['date'],
              rowLimit: 28,
            }),
          }
        );

        const result = await response.json();
        if (!response.ok) {
          console.error('Performance data error:', result);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch performance data' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Calculate totals
        const totals = {
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
        };

        if (result.rows) {
          result.rows.forEach((row: any) => {
            totals.clicks += row.clicks || 0;
            totals.impressions += row.impressions || 0;
          });

          if (totals.impressions > 0) {
            totals.ctr = (totals.clicks / totals.impressions) * 100;
          }

          const positionSum = result.rows.reduce((sum: number, row: any) => sum + (row.position || 0), 0);
          totals.position = result.rows.length > 0 ? positionSum / result.rows.length : 0;
        }

        return new Response(
          JSON.stringify({
            ...totals,
            ctr: totals.ctr.toFixed(2),
            position: totals.position.toFixed(1),
            rows: result.rows || [],
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('GSC function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getValidAccessToken(
  supabase: any,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'gsc_tokens')
    .maybeSingle();

  if (!data?.value) return null;

  const tokens = data.value as GSCTokens;

  // Check if token needs refresh (5 min buffer)
  if (Date.now() >= tokens.expires_at - 300000) {
    console.log('Refreshing GSC access token...');

    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const refreshData = await refreshResponse.json();
    if (refreshData.error) {
      console.error('Token refresh error:', refreshData);
      return null;
    }

    tokens.access_token = refreshData.access_token;
    tokens.expires_at = Date.now() + (refreshData.expires_in * 1000);

    await supabase
      .from('app_settings')
      .update({ value: tokens, updated_at: new Date().toISOString() })
      .eq('key', 'gsc_tokens');

    console.log('GSC token refreshed successfully');
  }

  return tokens.access_token;
}
