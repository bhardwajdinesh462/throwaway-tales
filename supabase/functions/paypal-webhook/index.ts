import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  resource: {
    id: string;
    status?: string;
    subscriber?: {
      email_address?: string;
      payer_id?: string;
    };
    billing_agreement_id?: string;
    purchase_units?: Array<{
      reference_id?: string;
      custom_id?: string;
      payments?: {
        captures?: Array<{
          id: string;
          amount: { value: string; currency_code: string };
        }>;
      };
    }>;
    custom_id?: string;
    payer?: {
      email_address?: string;
      payer_id?: string;
    };
    amount?: {
      value: string;
      currency_code: string;
    };
  };
  create_time: string;
  resource_type: string;
  summary: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
    const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      console.error('PayPal credentials not configured');
      return new Response(JSON.stringify({ error: 'PayPal not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse webhook event
    const event: PayPalWebhookEvent = await req.json();
    console.log('[PayPal Webhook] Received event:', event.event_type, event.id);

    // Get payment settings to determine sandbox/live mode
    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'payment_settings')
      .maybeSingle();

    const paypalMode = settings?.value?.paypalMode || 'sandbox';
    const paypalBaseUrl = paypalMode === 'live' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';

    // Verify webhook signature (optional but recommended for production)
    // For now, we'll process the event directly

    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED': {
        // Order approved - capture the payment
        console.log('[PayPal Webhook] Order approved:', event.resource.id);
        
        // Get access token
        const tokenResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)}`,
          },
          body: 'grant_type=client_credentials',
        });

        const { access_token } = await tokenResponse.json();

        // Capture the order
        const captureResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${event.resource.id}/capture`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`,
          },
        });

        const captureData = await captureResponse.json();
        console.log('[PayPal Webhook] Capture response:', captureData.status);

        if (captureData.status === 'COMPLETED') {
          // Extract metadata from custom_id (format: userId:tierId:billingCycle)
          const customId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id 
            || captureData.purchase_units?.[0]?.custom_id
            || event.resource.custom_id;

          if (customId) {
            const [userId, tierId, billingCycle] = customId.split(':');
            
            if (userId && tierId) {
              // Calculate subscription period
              const now = new Date();
              const periodEnd = new Date(now);
              if (billingCycle === 'yearly') {
                periodEnd.setFullYear(periodEnd.getFullYear() + 1);
              } else {
                periodEnd.setMonth(periodEnd.getMonth() + 1);
              }

              // Check if user already has a subscription
              const { data: existingSub } = await supabase
                .from('user_subscriptions')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

              const subscriptionData = {
                user_id: userId,
                tier_id: tierId,
                status: 'active',
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                paypal_subscription_id: event.resource.id,
                payment_provider: 'paypal',
                cancel_at_period_end: false,
              };

              if (existingSub) {
                await supabase
                  .from('user_subscriptions')
                  .update(subscriptionData)
                  .eq('id', existingSub.id);
              } else {
                await supabase
                  .from('user_subscriptions')
                  .insert(subscriptionData);
              }

              // Record invoice
              const amount = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
              await supabase.from('user_invoices').insert({
                user_id: userId,
                amount_paid: parseFloat(amount?.value || '0'),
                currency: amount?.currency_code?.toLowerCase() || 'usd',
                status: 'paid',
                paid_at: now.toISOString(),
                paypal_order_id: event.resource.id,
                payment_provider: 'paypal',
                period_start: now.toISOString(),
                period_end: periodEnd.toISOString(),
                description: `${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} subscription payment`,
              });

              console.log('[PayPal Webhook] Subscription activated for user:', userId);
            }
          }
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        console.log('[PayPal Webhook] Subscription activated:', event.resource.id);
        const customId = event.resource.custom_id;
        
        if (customId) {
          const [userId, tierId, billingCycle] = customId.split(':');
          
          if (userId && tierId) {
            const now = new Date();
            const periodEnd = new Date(now);
            if (billingCycle === 'yearly') {
              periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            } else {
              periodEnd.setMonth(periodEnd.getMonth() + 1);
            }

            await supabase
              .from('user_subscriptions')
              .upsert({
                user_id: userId,
                tier_id: tierId,
                status: 'active',
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                paypal_subscription_id: event.resource.id,
                payment_provider: 'paypal',
                cancel_at_period_end: false,
              }, { onConflict: 'user_id' });

            console.log('[PayPal Webhook] Subscription created for user:', userId);
          }
        }
        break;
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        console.log('[PayPal Webhook] Subscription cancelled/suspended:', event.resource.id);
        
        // Find and update the subscription
        const { data: sub } = await supabase
          .from('user_subscriptions')
          .select('id')
          .eq('paypal_subscription_id', event.resource.id)
          .maybeSingle();

        if (sub) {
          await supabase
            .from('user_subscriptions')
            .update({ 
              status: 'cancelled',
              cancel_at_period_end: true 
            })
            .eq('id', sub.id);
        }
        break;
      }

      case 'PAYMENT.SALE.COMPLETED': {
        console.log('[PayPal Webhook] Payment completed:', event.resource.id);
        
        // Handle recurring payment
        const billingAgreementId = event.resource.billing_agreement_id;
        if (billingAgreementId) {
          const { data: sub } = await supabase
            .from('user_subscriptions')
            .select('id, user_id, tier_id')
            .eq('paypal_subscription_id', billingAgreementId)
            .maybeSingle();

          if (sub) {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            // Extend subscription
            await supabase
              .from('user_subscriptions')
              .update({
                status: 'active',
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
              })
              .eq('id', sub.id);

            // Record invoice
            await supabase.from('user_invoices').insert({
              user_id: sub.user_id,
              amount_paid: parseFloat(event.resource.amount?.value || '0'),
              currency: event.resource.amount?.currency_code?.toLowerCase() || 'usd',
              status: 'paid',
              paid_at: now.toISOString(),
              paypal_order_id: event.resource.id,
              payment_provider: 'paypal',
              period_start: now.toISOString(),
              period_end: periodEnd.toISOString(),
              description: 'Recurring subscription payment',
            });
          }
        }
        break;
      }

      default:
        console.log('[PayPal Webhook] Unhandled event type:', event.event_type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[PayPal Webhook] Error:', error);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
