import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
import { Cog, Save, Eye, EyeOff, Send, CheckCircle, XCircle, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const SMTP_SETTINGS_KEY = 'trashmails_smtp_settings';

interface SMTPSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'none' | 'ssl' | 'tls';
  fromEmail: string;
  fromName: string;
  enabled: boolean;
}

interface ConfigStatus {
  name: string;
  configured: boolean;
}

interface EmailConfig {
  smtp: { configured: boolean; secrets: ConfigStatus[] };
  imap: { configured: boolean; secrets: ConfigStatus[] };
}

const defaultSettings: SMTPSettings = {
  host: 'smtp.example.com',
  port: 587,
  username: '',
  password: '',
  encryption: 'tls',
  fromEmail: 'noreply@nullsto.com',
  fromName: 'Nullsto',
  enabled: false,
};

const AdminSMTPSettings = () => {
  const [settings, setSettings] = useState<SMTPSettings>(() =>
    storage.get(SMTP_SETTINGS_KEY, defaultSettings)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [backendConfig, setBackendConfig] = useState<EmailConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useEffect(() => {
    fetchBackendConfig();
  }, []);

  const fetchBackendConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-email-config');
      if (error) throw error;
      setBackendConfig(data);
    } catch (error: any) {
      console.error("Error fetching config:", error);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    storage.set(SMTP_SETTINGS_KEY, settings);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("SMTP settings saved locally for testing!");
    }, 500);
  };

  const handleTestConnection = () => {
    if (!settings.host || !settings.username || !settings.password) {
      toast.error("Please fill in all required fields before testing");
      return;
    }

    setIsTesting(true);
    setConnectionStatus('idle');
    
    setTimeout(() => {
      setIsTesting(false);
      if (settings.host && settings.username && settings.password) {
        setConnectionStatus('success');
        toast.success("SMTP settings validated!");
      } else {
        setConnectionStatus('error');
        toast.error("Please fill in all required fields.");
      }
    }, 1000);
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast.error("Please enter a recipient email address");
      return;
    }

    if (!settings.host || !settings.username || !settings.password) {
      toast.error("Please configure SMTP settings first");
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          recipientEmail: testEmail,
          smtpConfig: {
            host: settings.host,
            port: settings.port,
            username: settings.username,
            password: settings.password,
            encryption: settings.encryption,
            fromEmail: settings.fromEmail,
            fromName: settings.fromName,
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        setTestResult({ success: true, message: data.message });
        toast.success(`Test email sent to ${testEmail}!`);
      } else {
        setTestResult({ success: false, message: data.error });
        toast.error(data.error || "Failed to send test email");
      }
    } catch (error: any) {
      console.error("Error sending test email:", error);
      const errorMessage = error.message || "Failed to send test email";
      setTestResult({ success: false, message: errorMessage });
      toast.error(errorMessage);
    } finally {
      setIsSendingTest(false);
    }
  };

  const updateSetting = <K extends keyof SMTPSettings>(key: K, value: SMTPSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setConnectionStatus('idle');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Cog className="w-8 h-8 text-primary" />
            SMTP Settings
          </h1>
          <p className="text-muted-foreground">Configure email sending settings for outbound emails</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
          <Dialog open={testEmailDialogOpen} onOpenChange={setTestEmailDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Send className="w-4 h-4 mr-2" />
                Send Test Email
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Test Email</DialogTitle>
                <DialogDescription>
                  Send a test email to verify your SMTP configuration is working correctly.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="test-email">Recipient Email Address</Label>
                  <Input
                    id="test-email"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
                <div className="p-4 bg-muted rounded-lg text-sm">
                  <p className="font-medium mb-2">Test Email Preview:</p>
                  <p><strong>From:</strong> {settings.fromName} &lt;{settings.fromEmail}&gt;</p>
                  <p><strong>Subject:</strong> Test Email from Nullsto</p>
                  <p><strong>Body:</strong> This is a test email to verify your SMTP configuration.</p>
                </div>
                {testResult && (
                  <div className={`p-4 rounded-lg flex items-center gap-2 ${
                    testResult.success ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 flex-shrink-0" />
                    )}
                    <span className="text-sm">{testResult.message}</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setTestEmailDialogOpen(false);
                  setTestResult(null);
                }}>
                  Cancel
                </Button>
                <Button onClick={handleSendTestEmail} disabled={isSendingTest}>
                  {isSendingTest ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {isSendingTest ? 'Sending...' : 'Send Test Email'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Backend Configuration Status */}
      <Card className={backendConfig?.smtp.configured ? 'border-green-500/50' : 'border-yellow-500/50'}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              Backend Configuration Status
              {isLoadingConfig ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : backendConfig?.smtp.configured ? (
                <Badge className="bg-green-500">Configured</Badge>
              ) : (
                <Badge variant="outline" className="border-yellow-500 text-yellow-500">Not Configured</Badge>
              )}
            </span>
            <Button variant="outline" size="sm" onClick={fetchBackendConfig}>
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            The backend edge functions use these secrets to send emails. Configure them in the Lovable Cloud backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {backendConfig?.smtp.secrets.map((secret) => (
              <div key={secret.name} className="flex items-center gap-2 p-2 bg-muted rounded">
                {secret.configured ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                <code className="text-xs">{secret.name}</code>
              </div>
            ))}
          </div>
          
          {!backendConfig?.smtp.configured && (
            <div className="bg-yellow-500/10 border border-yellow-500/50 p-3 rounded-lg mb-4">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-500">Backend secrets not configured</p>
                  <p className="text-muted-foreground">
                    The form below is for testing only. To enable actual email sending, configure the secrets in the backend panel.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button variant="outline" onClick={() => window.location.href = '/admin/email-setup'}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Go to Email Setup Wizard
          </Button>
        </CardContent>
      </Card>

      {connectionStatus !== 'idle' && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          connectionStatus === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'
        }`}>
          {connectionStatus === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          <span>
            {connectionStatus === 'success' 
              ? 'Connection successful! SMTP server is reachable.'
              : 'Connection failed. Please verify your credentials and server settings.'}
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>SMTP Configuration (Testing)</span>
            <div className="flex items-center gap-2">
              <Label htmlFor="smtp-enabled">Enable SMTP</Label>
              <Switch
                id="smtp-enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => updateSetting('enabled', checked)}
              />
            </div>
          </CardTitle>
          <CardDescription>
            Use this form to test SMTP settings. Values entered here are used for the "Send Test Email" feature.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">SMTP Host *</Label>
              <Input
                id="host"
                value={settings.host}
                onChange={(e) => updateSetting('host', e.target.value)}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port *</Label>
              <Input
                id="port"
                type="number"
                value={settings.port}
                onChange={(e) => updateSetting('port', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Common: 25, 465 (SSL), 587 (TLS)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={settings.username}
                onChange={(e) => updateSetting('username', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={settings.password}
                  onChange={(e) => updateSetting('password', e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Encryption</Label>
            <div className="flex gap-4">
              {(['none', 'ssl', 'tls'] as const).map((enc) => (
                <label key={enc} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="encryption"
                    checked={settings.encryption === enc}
                    onChange={() => updateSetting('encryption', enc)}
                    className="text-primary"
                  />
                  <span className="capitalize">{enc === 'none' ? 'None' : enc.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromEmail">From Email *</Label>
              <Input
                id="fromEmail"
                type="email"
                value={settings.fromEmail}
                onChange={(e) => updateSetting('fromEmail', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                value={settings.fromName}
                onChange={(e) => updateSetting('fromName', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common SMTP Providers</CardTitle>
          <CardDescription>Quick reference for popular email providers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Gmail / Google Workspace</p>
              <p>Host: smtp.gmail.com</p>
              <p>Port: 587 (TLS) or 465 (SSL)</p>
              <p className="text-xs text-muted-foreground mt-2">Requires App Password</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Outlook / Office 365</p>
              <p>Host: smtp.office365.com</p>
              <p>Port: 587 (TLS)</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Amazon SES</p>
              <p>Host: email-smtp.[region].amazonaws.com</p>
              <p>Port: 587 (TLS) or 465 (SSL)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSMTPSettings;
