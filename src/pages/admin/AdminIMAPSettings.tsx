import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
import { Mail, Save, Eye, EyeOff, RefreshCw, CheckCircle, XCircle, Download, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const IMAP_SETTINGS_KEY = 'trashmails_imap_settings';

interface IMAPSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  useTLS: boolean;
  useSSL: boolean;
  mailbox: string;
  pollingInterval: number;
  deleteAfterFetch: boolean;
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

const defaultSettings: IMAPSettings = {
  host: 'imap.example.com',
  port: 993,
  username: '',
  password: '',
  useTLS: true,
  useSSL: true,
  mailbox: 'INBOX',
  pollingInterval: 60,
  deleteAfterFetch: false,
  enabled: false,
};

const AdminIMAPSettings = () => {
  const [settings, setSettings] = useState<IMAPSettings>(() =>
    storage.get(IMAP_SETTINGS_KEY, defaultSettings)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [fetchResult, setFetchResult] = useState<{ 
    success: boolean; 
    message: string; 
    stats?: { totalMessages: number; unseenMessages: number; stored: number; failed: number } 
  } | null>(null);
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
    storage.set(IMAP_SETTINGS_KEY, settings);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("IMAP settings saved locally!");
    }, 500);
  };

  const handleTestConnection = async () => {
    if (!backendConfig?.imap.configured) {
      toast.error("Backend IMAP secrets are not configured. Please configure them first.");
      return;
    }
    
    setIsTesting(true);
    setConnectionStatus('idle');
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-imap-emails', {});

      if (error) throw error;

      if (data.success) {
        setConnectionStatus('success');
        toast.success("IMAP connection successful!");
      } else {
        setConnectionStatus('error');
        toast.error(data.error || "Connection failed");
      }
    } catch (error: any) {
      setConnectionStatus('error');
      toast.error(error.message || "Connection test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleFetchEmails = async () => {
    if (!backendConfig?.imap.configured) {
      toast.error("Backend IMAP secrets are not configured. Please configure them first.");
      return;
    }

    setIsFetching(true);
    setFetchResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-imap-emails', {});

      if (error) throw error;

      if (data.success) {
        setFetchResult({
          success: true,
          message: data.message,
          stats: data.stats
        });
        toast.success(`Fetched ${data.stats.stored} new emails!`);
      } else {
        setFetchResult({ success: false, message: data.error });
        toast.error(data.error || "Failed to fetch emails");
      }
    } catch (error: any) {
      const errorMessage = error.message || "Failed to fetch emails";
      setFetchResult({ success: false, message: errorMessage });
      toast.error(errorMessage);
    } finally {
      setIsFetching(false);
    }
  };

  const updateSetting = <K extends keyof IMAPSettings>(key: K, value: IMAPSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setConnectionStatus('idle');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="w-8 h-8 text-primary" />
            IMAP Settings
          </h1>
          <p className="text-muted-foreground">Configure incoming email server to receive emails</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestConnection} disabled={isTesting || !backendConfig?.imap.configured}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button variant="outline" onClick={handleFetchEmails} disabled={isFetching || !backendConfig?.imap.configured}>
            {isFetching ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {isFetching ? 'Fetching...' : 'Fetch Emails Now'}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Backend Configuration Status */}
      <Card className={backendConfig?.imap.configured ? 'border-green-500/50' : 'border-yellow-500/50'}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              Backend Configuration Status
              {isLoadingConfig ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : backendConfig?.imap.configured ? (
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
            The backend edge functions use these secrets to fetch emails. Configure them in the Lovable Cloud backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {backendConfig?.imap.secrets.map((secret) => (
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
          
          {!backendConfig?.imap.configured && (
            <div className="bg-yellow-500/10 border border-yellow-500/50 p-3 rounded-lg mb-4">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-500">Backend secrets not configured</p>
                  <p className="text-muted-foreground">
                    The "Test Connection" and "Fetch Emails" buttons use backend secrets. Configure them in the backend panel first.
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
              ? 'Connection successful! IMAP server is reachable.'
              : 'Connection failed. Please verify your credentials and server settings.'}
          </span>
        </div>
      )}

      {fetchResult && (
        <Card className={fetchResult.success ? 'border-green-500/50' : 'border-destructive/50'}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {fetchResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium">{fetchResult.message}</p>
                {fetchResult.stats && (
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{fetchResult.stats.totalMessages}</p>
                      <p className="text-xs text-muted-foreground">Total Messages</p>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{fetchResult.stats.unseenMessages}</p>
                      <p className="text-xs text-muted-foreground">Unseen</p>
                    </div>
                    <div className="text-center p-3 bg-green-500/10 rounded-lg">
                      <p className="text-2xl font-bold text-green-500">{fetchResult.stats.stored}</p>
                      <p className="text-xs text-muted-foreground">Stored</p>
                    </div>
                    <div className="text-center p-3 bg-destructive/10 rounded-lg">
                      <p className="text-2xl font-bold text-destructive">{fetchResult.stats.failed}</p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>IMAP Configuration (Reference)</span>
            <div className="flex items-center gap-2">
              <Label htmlFor="imap-enabled">Enable IMAP</Label>
              <Switch
                id="imap-enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => updateSetting('enabled', checked)}
              />
            </div>
          </CardTitle>
          <CardDescription>
            Reference form showing typical IMAP settings. Actual configuration is done via backend secrets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">IMAP Host *</Label>
              <Input
                id="host"
                value={settings.host}
                onChange={(e) => updateSetting('host', e.target.value)}
                placeholder="imap.example.com"
              />
              <p className="text-xs text-muted-foreground">e.g., imap.gmail.com, imap.mailserver.com</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port *</Label>
              <Input
                id="port"
                type="number"
                value={settings.port}
                onChange={(e) => updateSetting('port', parseInt(e.target.value) || 993)}
              />
              <p className="text-xs text-muted-foreground">Common ports: 993 (SSL), 143 (non-SSL)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={settings.username}
                onChange={(e) => updateSetting('username', e.target.value)}
                placeholder="user@example.com"
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
                  placeholder="••••••••"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mailbox">Mailbox</Label>
              <Input
                id="mailbox"
                value={settings.mailbox}
                onChange={(e) => updateSetting('mailbox', e.target.value)}
                placeholder="INBOX"
              />
              <p className="text-xs text-muted-foreground">Usually INBOX for main mailbox</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pollingInterval">Polling Interval (seconds)</Label>
              <Input
                id="pollingInterval"
                type="number"
                min="10"
                max="300"
                value={settings.pollingInterval}
                onChange={(e) => updateSetting('pollingInterval', parseInt(e.target.value) || 60)}
              />
              <p className="text-xs text-muted-foreground">How often to check for new emails (10-300 seconds)</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Use SSL</Label>
                <p className="text-sm text-muted-foreground">Enable SSL encryption (recommended for port 993)</p>
              </div>
              <Switch
                checked={settings.useSSL}
                onCheckedChange={(checked) => updateSetting('useSSL', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Use TLS</Label>
                <p className="text-sm text-muted-foreground">Enable STARTTLS encryption</p>
              </div>
              <Switch
                checked={settings.useTLS}
                onCheckedChange={(checked) => updateSetting('useTLS', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Delete After Fetch</Label>
                <p className="text-sm text-muted-foreground">Remove emails from server after storing locally</p>
              </div>
              <Switch
                checked={settings.deleteAfterFetch}
                onCheckedChange={(checked) => updateSetting('deleteAfterFetch', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
          <CardDescription>How to configure your mail server for receiving emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. Configure MX Records</h4>
            <p className="text-sm text-muted-foreground">
              Point your domain's MX records to your mail server. This tells other mail servers where to deliver emails for your domain.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">2. Create Catch-All Mailbox</h4>
            <p className="text-sm text-muted-foreground">
              Set up a catch-all email address on your mail server to receive emails sent to any address at your domain.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">3. Configure Backend Secrets</h4>
            <p className="text-sm text-muted-foreground">
              Add IMAP_HOST, IMAP_PORT, IMAP_USER, and IMAP_PASSWORD as secrets in the Lovable Cloud backend panel.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">4. Test Connection</h4>
            <p className="text-sm text-muted-foreground">
              Click "Test Connection" to verify your backend secrets are correct before enabling.
            </p>
          </div>
          
          <Button variant="outline" onClick={() => window.location.href = '/admin/email-setup'}>
            <ExternalLink className="w-4 h-4 mr-2" />
            View Full Setup Guide
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminIMAPSettings;
