-- Add default payment settings to app_settings table
INSERT INTO app_settings (key, value)
VALUES ('payment_settings', '{
  "stripeEnabled": false,
  "stripePublishableKey": "",
  "paypalEnabled": true,
  "paypalClientId": "",
  "paypalMode": "sandbox",
  "telegramUpgradeEnabled": true,
  "telegramLink": "https://t.me/digitalselling023",
  "defaultPaymentMethod": "telegram",
  "testMode": true,
  "currency": "usd"
}'::jsonb)
ON CONFLICT (key) DO NOTHING;