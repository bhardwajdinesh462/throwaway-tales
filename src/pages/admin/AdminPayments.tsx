import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Save, AlertTriangle, CheckCircle, ExternalLink, Key, Wallet } from "lucide-react";
import { api } from "@/lib/api";

interface PaymentSettings {
  stripeEnabled: boolean;
  stripePublishableKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  paypalEnabled: boolean;
  paypalClientId: string;
  paypalClientSecret: string;
  paypalWebhookId: string;
  paypalMode: 'sandbox' | 'live';
  testMode: boolean;
  currency: string;
}

const defaultSettings: PaymentSettings = {
  stripeEnabled: false,
  stripePublishableKey: '',
  stripeSecretKey: '',
  stripeWebhookSecret: '',
  paypalEnabled: false,
  paypalClientId: '',
  paypalClientSecret: '',
  paypalWebhookId: '',
  paypalMode: 'sandbox',
  testMode: true,
  currency: 'usd',
};

const AdminPayments = () => {
  const [settings, setSettings] = useState<PaymentSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isPhpBackend = api.isPHP;

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      if (isPhpBackend) {
        const response = await api.admin.getSettings('payment_settings');
        if (response?.data && Array.isArray(response.data) && response.data[0]?.value) {
          setSettings({ ...defaultSettings, ...response.data[0].value });
        } else if (response?.data?.value) {
          setSettings({ ...defaultSettings, ...response.data.value });
        }
      } else {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'payment_settings')
          .maybeSingle();

        if (!error && data?.value) {
          const dbSettings = data.value as unknown as PaymentSettings;
          setSettings({ ...defaultSettings, ...dbSettings });
        }
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settingsJson = JSON.parse(JSON.stringify(settings));

      if (isPhpBackend) {
        await api.admin.updateSettings('payment_settings', settingsJson);
        toast.success("Payment settings saved!");
      } else {
        const { data: existing } = await supabase
          .from('app_settings')
          .select('id')
          .eq('key', 'payment_settings')
          .maybeSingle();

        let error;
        if (existing) {
          const result = await supabase
            .from('app_settings')
            .update({ value: settingsJson, updated_at: new Date().toISOString() })
            .eq('key', 'payment_settings');
          error = result.error;
        } else {
          const result = await supabase
            .from('app_settings')
            .insert([{ key: 'payment_settings', value: settingsJson }]);
          error = result.error;
        }

        if (error) {
          toast.error('Failed to save settings');
        } else {
          toast.success("Payment settings saved!");
        }
      }
    } catch (e) {
      console.error('Error saving settings:', e);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof PaymentSettings>(key: K, value: PaymentSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const webhookUrl = isPhpBackend 
    ? `${window.location.origin}/api/webhook/stripe`
    : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`;

  const paypalWebhookUrl = isPhpBackend
    ? `${window.location.origin}/api/webhook/paypal`
    : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-webhook`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CreditCard className="w-8 h-8 text-primary" />
            Payment Settings
          </h1>
          <p className="text-muted-foreground">Configure payment gateways for premium subscriptions</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs defaultValue="stripe" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stripe" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Stripe
          </TabsTrigger>
          <TabsTrigger value="paypal" className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            PayPal
          </TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <TabsContent value="stripe" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Stripe Integration
              </CardTitle>
              <CardDescription>Configure Stripe for credit card payments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
                <div>
                  <Label className="text-base font-medium">Enable Stripe</Label>
                  <p className="text-sm text-muted-foreground">Accept credit card payments via Stripe</p>
                </div>
                <Switch
                  checked={settings.stripeEnabled}
                  onCheckedChange={(checked) => updateSetting('stripeEnabled', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label>Publishable Key</Label>
                <Input
                  value={settings.stripePublishableKey}
                  onChange={(e) => updateSetting('stripePublishableKey', e.target.value)}
                  placeholder={settings.testMode ? "pk_test_..." : "pk_live_..."}
                />
              </div>

              <div className="space-y-2">
                <Label>Secret Key</Label>
                <Input
                  type="password"
                  value={settings.stripeSecretKey}
                  onChange={(e) => updateSetting('stripeSecretKey', e.target.value)}
                  placeholder={settings.testMode ? "sk_test_..." : "sk_live_..."}
                />
              </div>

              <div className="space-y-2">
                <Label>Webhook Secret</Label>
                <Input
                  type="password"
                  value={settings.stripeWebhookSecret}
                  onChange={(e) => updateSetting('stripeWebhookSecret', e.target.value)}
                  placeholder="whsec_..."
                />
                <p className="text-xs text-muted-foreground">
                  Webhook URL: <code className="bg-muted px-1 rounded">{webhookUrl}</code>
                </p>
              </div>

              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                Get API keys from Stripe Dashboard <ExternalLink className="w-3 h-3" />
              </a>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paypal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                PayPal Integration
              </CardTitle>
              <CardDescription>Configure PayPal as an alternative payment method</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
                <div>
                  <Label className="text-base font-medium">Enable PayPal</Label>
                  <p className="text-sm text-muted-foreground">Accept payments via PayPal</p>
                </div>
                <Switch
                  checked={settings.paypalEnabled}
                  onCheckedChange={(checked) => updateSetting('paypalEnabled', checked)}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
                <div>
                  <Label className="text-base font-medium">Sandbox Mode</Label>
                  <p className="text-sm text-muted-foreground">Use PayPal sandbox for testing</p>
                </div>
                <Switch
                  checked={settings.paypalMode === 'sandbox'}
                  onCheckedChange={(checked) => updateSetting('paypalMode', checked ? 'sandbox' : 'live')}
                />
              </div>

              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input
                  value={settings.paypalClientId}
                  onChange={(e) => updateSetting('paypalClientId', e.target.value)}
                  placeholder="Enter PayPal Client ID"
                />
              </div>

              <div className="space-y-2">
                <Label>Client Secret</Label>
                <Input
                  type="password"
                  value={settings.paypalClientSecret}
                  onChange={(e) => updateSetting('paypalClientSecret', e.target.value)}
                  placeholder="Enter PayPal Client Secret"
                />
              </div>

              <div className="space-y-2">
                <Label>Webhook ID (optional)</Label>
                <Input
                  value={settings.paypalWebhookId}
                  onChange={(e) => updateSetting('paypalWebhookId', e.target.value)}
                  placeholder="Enter PayPal Webhook ID"
                />
                <p className="text-xs text-muted-foreground">
                  Webhook URL: <code className="bg-muted px-1 rounded">{paypalWebhookUrl}</code>
                </p>
              </div>

              <a
                href="https://developer.paypal.com/dashboard/applications"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                Get API credentials from PayPal Developer <ExternalLink className="w-3 h-3" />
              </a>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
                <div>
                  <Label className="text-base font-medium">Test Mode</Label>
                  <p className="text-sm text-muted-foreground">Use test/sandbox keys for development</p>
                </div>
                <Switch
                  checked={settings.testMode}
                  onCheckedChange={(checked) => updateSetting('testMode', checked)}
                />
              </div>

              {settings.testMode && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-600 dark:text-amber-400">
                    Test mode is enabled. Real payments will not be processed.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Input
                  value={settings.currency}
                  onChange={(e) => updateSetting('currency', e.target.value.toLowerCase())}
                  placeholder="usd"
                  maxLength={3}
                  className="uppercase w-32"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integration Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-secondary/30 border border-border text-center">
                  <p className="text-sm text-muted-foreground">Stripe</p>
                  <p className={`font-semibold ${settings.stripeEnabled && settings.stripeSecretKey ? 'text-green-500' : 'text-red-500'}`}>
                    {settings.stripeEnabled && settings.stripeSecretKey ? 'Ready' : 'Not Ready'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/30 border border-border text-center">
                  <p className="text-sm text-muted-foreground">PayPal</p>
                  <p className={`font-semibold ${settings.paypalEnabled && settings.paypalClientSecret ? 'text-green-500' : 'text-red-500'}`}>
                    {settings.paypalEnabled && settings.paypalClientSecret ? 'Ready' : 'Not Ready'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/30 border border-border text-center">
                  <p className="text-sm text-muted-foreground">Mode</p>
                  <p className={`font-semibold ${settings.testMode ? 'text-amber-500' : 'text-green-500'}`}>
                    {settings.testMode ? 'Test' : 'Live'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/30 border border-border text-center">
                  <p className="text-sm text-muted-foreground">Currency</p>
                  <p className="font-semibold uppercase">{settings.currency || 'USD'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPayments;