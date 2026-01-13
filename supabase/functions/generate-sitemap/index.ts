import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get site URL from request or use default
    let siteUrl = "https://nullsto.edu.pl";
    try {
      const body = await req.json();
      if (body.siteUrl) siteUrl = body.siteUrl;
    } catch {
      // No body or invalid JSON, use default
    }

    // Fetch SEO settings
    const { data: seoSettings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "seo")
      .maybeSingle();

    // Fetch published blogs
    const { data: blogs } = await supabase
      .from("blogs")
      .select("slug, updated_at, published_at")
      .eq("published", true);

    const today = new Date().toISOString().split("T")[0];

    // Static pages with their priorities
    const staticPages = [
      { path: "/", priority: "1.0", changefreq: "daily" },
      { path: "/dashboard", priority: "0.9", changefreq: "daily" },
      { path: "/blog", priority: "0.8", changefreq: "weekly" },
      { path: "/pricing", priority: "0.8", changefreq: "monthly" },
      { path: "/about", priority: "0.7", changefreq: "monthly" },
      { path: "/contact", priority: "0.6", changefreq: "monthly" },
      { path: "/status", priority: "0.7", changefreq: "daily" },
      { path: "/premium-features", priority: "0.7", changefreq: "weekly" },
      { path: "/changelog", priority: "0.5", changefreq: "weekly" },
      { path: "/api-access", priority: "0.5", changefreq: "monthly" },
      { path: "/auth", priority: "0.4", changefreq: "monthly" },
      { path: "/privacy-policy", priority: "0.3", changefreq: "yearly" },
      { path: "/terms-of-service", priority: "0.3", changefreq: "yearly" },
      { path: "/cookie-policy", priority: "0.3", changefreq: "yearly" },
    ];

    // Generate XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Add static pages
    for (const page of staticPages) {
      // Check if page has custom SEO settings with noIndex
      const pageSeo = seoSettings?.value?.pages?.[page.path];
      if (pageSeo?.noIndex) continue;

      xml += `
  <url>
    <loc>${siteUrl}${page.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    }

    // Add blog posts
    if (blogs && blogs.length > 0) {
      for (const blog of blogs) {
        const lastmod = (blog.updated_at || blog.published_at || today).split("T")[0];
        xml += `
  <url>
    <loc>${siteUrl}/blog/${blog.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
      }
    }

    xml += "\n</urlset>";

    // Update last generated timestamp in settings
    if (seoSettings?.value) {
      const updatedSettings = {
        ...seoSettings.value,
        lastSitemapGenerated: new Date().toISOString(),
      };
      await supabase
        .from("app_settings")
        .update({ value: updatedSettings, updated_at: new Date().toISOString() })
        .eq("key", "seo");
    }

    console.log(`[generate-sitemap] Generated sitemap with ${staticPages.length} pages and ${blogs?.length || 0} blog posts`);

    return new Response(xml, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600"
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-sitemap] Error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
