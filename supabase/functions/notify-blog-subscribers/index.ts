import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyRequest {
  blogId: string;
  siteUrl?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { blogId, siteUrl = 'https://nullsto.com' }: NotifyRequest = await req.json();

    if (!blogId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Blog ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the blog post
    const { data: blog, error: blogError } = await supabase
      .from('blogs')
      .select('*')
      .eq('id', blogId)
      .eq('published', true)
      .single();

    if (blogError || !blog) {
      console.error('Blog not found or not published:', blogError);
      return new Response(
        JSON.stringify({ success: false, error: 'Blog post not found or not published' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Fetch active subscribers
    const { data: subscribers, error: subError } = await supabase
      .from('blog_subscribers')
      .select('email')
      .eq('status', 'active');

    if (subError) throw subError;

    if (!subscribers || subscribers.length === 0) {
      console.log('No active subscribers to notify');
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`Notifying ${subscribers.length} subscribers about: ${blog.title}`);

    // Get mailbox for sending
    const { data: mailboxData } = await supabase
      .rpc('select_available_mailbox')
      .single();

    const mailbox = mailboxData as { mailbox_id: string; smtp_from: string; smtp_host: string; smtp_password: string; smtp_port: number; smtp_user: string } | null;

    if (!mailbox) {
      console.warn('No mailbox available for sending notifications');
      return new Response(
        JSON.stringify({ success: false, error: 'No mailbox configured for sending emails' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get site name from settings
    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'general_settings')
      .single();

    const siteName = settings?.value?.site_name || 'NullSto';

    let successCount = 0;
    let failCount = 0;

    // Send emails in batches of 10
    const batchSize = 10;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (subscriber) => {
        try {
          const unsubscribeUrl = `${siteUrl}/blog/unsubscribe?email=${encodeURIComponent(subscriber.email)}`;
          const postUrl = `${siteUrl}/blog/${blog.slug}`;

          const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">New Article Published! 📝</h1>
    
    <h2 style="color: #333; font-size: 20px; margin-bottom: 12px;">${blog.title}</h2>
    
    ${blog.featured_image_url ? `<img src="${blog.featured_image_url}" alt="${blog.title}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin-bottom: 16px;">` : ''}
    
    <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      ${blog.excerpt || blog.content.substring(0, 200).replace(/<[^>]*>/g, '')}...
    </p>
    
    <a href="${postUrl}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
      Read Full Article →
    </a>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
    
    <p style="color: #999; font-size: 12px; text-align: center;">
      You're receiving this because you subscribed to ${siteName} blog updates.<br>
      <a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`;

          // Use send-template-email function to send
          const { error: sendError } = await supabase.functions.invoke('send-template-email', {
            body: {
              to: subscriber.email,
              subject: `New on ${siteName}: ${blog.title}`,
              html: emailBody,
              mailboxId: mailbox.mailbox_id
            }
          });

          if (sendError) {
            console.error(`Failed to send to ${subscriber.email}:`, sendError);
            failCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`Error sending to ${subscriber.email}:`, error);
          failCount++;
        }
      }));
    }

    console.log(`Notification complete: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notified: successCount, 
        failed: failCount,
        total: subscribers.length 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Notify subscribers error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
