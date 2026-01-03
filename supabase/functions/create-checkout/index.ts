import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check email verification
    if (!user.email_confirmed_at) {
      return new Response(
        JSON.stringify({ 
          error: "Please verify your email before subscribing to a premium plan.",
          code: "EMAIL_NOT_VERIFIED"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tier_id, billing_cycle, success_url, cancel_url, payment_method } = await req.json();

    if (!tier_id || !billing_cycle) {
      return new Response(
        JSON.stringify({ error: "Missing tier_id or billing_cycle" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch tier details
    const { data: tier, error: tierError } = await supabase
      .from("subscription_tiers")
      .select("*")
      .eq("id", tier_id)
      .single();

    if (tierError || !tier) {
      console.log("Tier not found:", tierError);
      return new Response(
        JSON.stringify({ error: "Subscription tier not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const price = billing_cycle === "yearly" ? tier.price_yearly : tier.price_monthly;
    
    if (price === 0) {
      return new Response(
        JSON.stringify({ error: "Cannot checkout free tier" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get payment settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "payment_settings")
      .maybeSingle();

    const paymentSettings = settings?.value || {};
    const paypalMode = paymentSettings.paypalMode || 'sandbox';

    // Handle PayPal checkout
    if (payment_method === "paypal") {
      if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
        console.log("PayPal credentials not configured");
        return new Response(
          JSON.stringify({ 
            error: "PayPal is not configured. Please add your PayPal API keys in the admin panel.",
            code: "PAYPAL_NOT_CONFIGURED"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const paypalBaseUrl = paypalMode === 'live' 
        ? 'https://api-m.paypal.com' 
        : 'https://api-m.sandbox.paypal.com';

      // Get PayPal access token
      const tokenResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)}`,
        },
        body: 'grant_type=client_credentials',
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) {
        console.error("PayPal token error:", tokenData);
        return new Response(
          JSON.stringify({ error: "Failed to authenticate with PayPal" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = tokenData.access_token;

      // Create PayPal order
      const successRedirect = success_url || `${req.headers.get("origin")}/dashboard?checkout=success`;
      const cancelRedirect = cancel_url || `${req.headers.get("origin")}/pricing?checkout=cancelled`;

      const orderPayload = {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: `${user.id}:${tier_id}:${billing_cycle}`,
          custom_id: `${user.id}:${tier_id}:${billing_cycle}`,
          description: `${tier.name} Plan - ${billing_cycle === 'yearly' ? 'Yearly' : 'Monthly'}`,
          amount: {
            currency_code: 'USD',
            value: price.toFixed(2),
          },
        }],
        application_context: {
          brand_name: 'TempMail Pro',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: successRedirect,
          cancel_url: cancelRedirect,
        },
      };

      const orderResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(orderPayload),
      });

      const orderData = await orderResponse.json();
      
      if (!orderResponse.ok) {
        console.error("PayPal order error:", orderData);
        return new Response(
          JSON.stringify({ error: "Failed to create PayPal order" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find approval URL
      const approvalUrl = orderData.links?.find((link: any) => link.rel === 'approve')?.href;
      
      if (!approvalUrl) {
        return new Response(
          JSON.stringify({ error: "No PayPal approval URL received" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`PayPal order created: ${orderData.id} for user ${user.id}`);

      return new Response(
        JSON.stringify({ 
          approval_url: approvalUrl,
          order_id: orderData.id 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle Stripe checkout (default)
    if (!STRIPE_SECRET_KEY) {
      console.log("Stripe secret key not configured");
      return new Response(
        JSON.stringify({ 
          error: "Stripe is not configured. Please add your Stripe API keys in the admin panel.",
          code: "STRIPE_NOT_CONFIGURED"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating Stripe checkout session for user ${user.id}, tier: ${tier.name}, price: $${price}`);

    // Create Stripe checkout session using fetch
    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "mode": "subscription",
        "customer_email": user.email!,
        "success_url": success_url || `${req.headers.get("origin")}/dashboard?checkout=success`,
        "cancel_url": cancel_url || `${req.headers.get("origin")}/pricing?checkout=cancelled`,
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": `${tier.name} Plan`,
        "line_items[0][price_data][product_data][description]": `${tier.name} subscription - ${billing_cycle}`,
        "line_items[0][price_data][unit_amount]": Math.round(price * 100).toString(),
        "line_items[0][price_data][recurring][interval]": billing_cycle === "yearly" ? "year" : "month",
        "line_items[0][quantity]": "1",
        "metadata[user_id]": user.id,
        "metadata[tier_id]": tier_id,
        "metadata[billing_cycle]": billing_cycle,
        "allow_promotion_codes": "true",
      }).toString(),
    });

    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error("Stripe error:", session);
      return new Response(
        JSON.stringify({ error: session.error?.message || "Failed to create checkout session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Stripe checkout session created: ${session.id}`);

    return new Response(
      JSON.stringify({ 
        checkout_url: session.url,
        session_id: session.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Checkout error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
