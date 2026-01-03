-- Add PayPal-specific columns to user_subscriptions
ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'stripe';

-- Add PayPal-specific columns to user_invoices
ALTER TABLE public.user_invoices
ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'stripe';

-- Enable realtime for instant subscription updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_subscriptions;