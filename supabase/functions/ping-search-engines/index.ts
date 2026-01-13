import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PingResult {
  success: boolean;
  message: string;
  timestamp: string;
}

interface PingResults {
  google: PingResult;
  bing: PingResult;
  yandex: PingResult;
  seznam: PingResult;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let siteUrl = "https://nullsto.edu.pl";
    let indexNowKey = "";
    let urlsToIndex: string[] = [];

    try {
      const body = await req.json();
      if (body.siteUrl) siteUrl = body.siteUrl;
      if (body.indexNowKey) indexNowKey = body.indexNowKey;
      if (body.urlsToIndex) urlsToIndex = body.urlsToIndex;
    } catch {
      // No body or invalid JSON
    }

    const sitemapUrl = `${siteUrl}/sitemap.xml`;
    const timestamp = new Date().toISOString();

    const results: PingResults = {
      google: { success: false, message: "", timestamp },
      bing: { success: false, message: "", timestamp },
      yandex: { success: false, message: "", timestamp },
      seznam: { success: false, message: "", timestamp },
    };

    // Ping Google via sitemap submission
    try {
      const googleUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
      console.log(`[ping-search-engines] Pinging Google: ${googleUrl}`);
      
      const googleRes = await fetch(googleUrl, {
        method: "GET",
        headers: { "User-Agent": "Nullsto-SEO-Bot/1.0" }
      });
      
      results.google = {
        success: googleRes.ok,
        message: googleRes.ok ? "Sitemap submitted successfully" : `Error: ${googleRes.status} ${googleRes.statusText}`,
        timestamp,
      };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Unknown error";
      console.error("[ping-search-engines] Google error:", errMsg);
      results.google = { success: false, message: errMsg, timestamp };
    }

    // IndexNow API for Bing, Yandex, Seznam
    if (indexNowKey) {
      // If no specific URLs provided, use main pages
      if (urlsToIndex.length === 0) {
        urlsToIndex = [
          siteUrl,
          `${siteUrl}/dashboard`,
          `${siteUrl}/blog`,
          `${siteUrl}/pricing`,
          `${siteUrl}/about`,
        ];
      }

      const host = new URL(siteUrl).host;
      const indexNowPayload = {
        host,
        key: indexNowKey,
        keyLocation: `${siteUrl}/${indexNowKey}.txt`,
        urlList: urlsToIndex,
      };

      const indexNowEndpoints = [
        { name: "bing" as const, url: "https://www.bing.com/indexnow" },
        { name: "yandex" as const, url: "https://yandex.com/indexnow" },
        { name: "seznam" as const, url: "https://search.seznam.cz/indexnow" },
      ];

      for (const endpoint of indexNowEndpoints) {
        try {
          console.log(`[ping-search-engines] Pinging ${endpoint.name} IndexNow`);
          
          const res = await fetch(endpoint.url, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json; charset=utf-8",
              "User-Agent": "Nullsto-SEO-Bot/1.0"
            },
            body: JSON.stringify(indexNowPayload),
          });

          // IndexNow returns 200, 202, or 204 for success
          const isSuccess = [200, 202, 204].includes(res.status);
          
          results[endpoint.name] = {
            success: isSuccess,
            message: isSuccess 
              ? `${urlsToIndex.length} URLs submitted` 
              : `Error: ${res.status} - ${await res.text()}`,
            timestamp,
          };
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : "Unknown error";
          console.error(`[ping-search-engines] ${endpoint.name} error:`, errMsg);
          results[endpoint.name] = { success: false, message: errMsg, timestamp };
        }
      }
    } else {
      // No IndexNow key - skip Bing/Yandex/Seznam
      const noKeyMessage = "IndexNow API key not configured";
      results.bing = { success: false, message: noKeyMessage, timestamp };
      results.yandex = { success: false, message: noKeyMessage, timestamp };
      results.seznam = { success: false, message: noKeyMessage, timestamp };
    }

    // Save ping status to SEO settings
    try {
      const { data: seoSettings } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "seo")
        .maybeSingle();

      if (seoSettings?.value) {
        const updatedSettings = {
          ...seoSettings.value,
          lastPingStatus: results,
        };
        await supabase
          .from("app_settings")
          .update({ value: updatedSettings, updated_at: new Date().toISOString() })
          .eq("key", "seo");
      }
    } catch (e) {
      console.error("[ping-search-engines] Failed to save ping status:", e);
    }

    console.log("[ping-search-engines] Results:", results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[ping-search-engines] Error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
