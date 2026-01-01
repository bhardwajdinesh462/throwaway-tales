import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
import { api } from "@/lib/api";
import { Mail, Save, Eye, EyeOff, RefreshCw, CheckCircle, XCircle, Download, Loader2, AlertCircle, Server } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

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

interface Mailbox {
  id: string;
  name: string;
  imap_host: string | null;
  imap_port: number | null;
  imap_user: string | null;
  imap_password?: string | null;
  is_active: boolean | null;
  last_polled_at: string | null;
  last_error: string | null;
}

const defaultSettings: IMAPSettings = {
  host: '',
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

  // Mailbox state
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const [isLoadingMailboxes, setIsLoadingMailboxes] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [syncSource, setSyncSource] = useState<'local' | 'database'>('local');

  useEffect(() => {
    fetchMailboxes();
  }, []);

  const fetchMailboxes = async () => {
    setIsLoadingMailboxes(true);
    try {
      const response = await api.admin('mailboxes', {});
      const data = response.mailboxes || [];
      setMailboxes(data);
      
      if (data.length > 0 && !selectedMailboxId) {
        const firstActive = data.find((m: Mailbox) => m.is_active);
        if (firstActive) {
          setSelectedMailboxId(firstActive.id);
          loadMailboxToForm(firstActive);
        }
      }
    } catch (error: any) {
      console.error("Error fetching mailboxes:", error);
    } finally {
      setIsLoadingMailboxes(false);
    }
  };

  const loadMailboxToForm = (mailbox: Mailbox) => {
    setSettings({
      host: mailbox.imap_host || '',
      port: mailbox.imap_port || 993,
      username: mailbox.imap_user || '',
      password: mailbox.imap_password || '',
      useTLS: true,
      useSSL: (mailbox.imap_port || 993) === 993,
      mailbox: 'INBOX',
      pollingInterval: 60,
      deleteAfterFetch: false,
      enabled: mailbox.is_active ?? false,
    });
    setSyncSource('database');
    setConnectionStatus('idle');
    toast.success(`Loaded mailbox: ${mailbox.name}`);
  };

  const handleSelectMailbox = (mailboxId: string) => {
    setSelectedMailboxId(mailboxId);
    const mailbox = mailboxes.find(m => m.id === mailboxId);
    if (mailbox) {
      loadMailboxToForm(mailbox);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    storage.set(IMAP_SETTINGS_KEY, settings);
    setSyncSource('local');
    setTimeout(() => {
      setIsSaving(false);
      toast.success("IMAP settings saved locally!");
    }, 500);
  };

  const handleSaveToDatabase = async () => {
    if (!settings.host || !settings.username || !settings.password) {
      toast.error("Please fill in host, username, and password");
      return;
    }

    setIsSavingToDb(true);
    try {
      const mailboxData = {
        imap_host: settings.host,
        imap_port: settings.port,
        imap_user: settings.username,
        imap_password: settings.password,
        is_active: settings.enabled,
      };

      if (selectedMailboxId) {
        await api.admin('mailbox-update', { id: selectedMailboxId, ...mailboxData });
        toast.success("IMAP settings updated in database!");
      } else {
        toast.error("Please select or create a mailbox first in SMTP Settings");
      }
      
      setSyncSource('database');
      await fetchMailboxes();
    } catch (error: any) {
      console.error("Error saving to database:", error);
      toast.error(error.message || "Failed to save settings");
    } finally {
      setIsSavingToDb(false);
    }
  };

  const handleTestConnection = async () => {
    if (!settings.host || !settings.username || !settings.password) {
      toast.error("Please enter IMAP credentials first");
      return;
    }
    
    setIsTesting(true);
    setConnectionStatus('idle');
    
    try {
      const data = await api.admin('mailbox-test-imap', {
        host: settings.host,
        port: settings.port,
        user: settings.username,
        password: settings.password,
        ssl: settings.useSSL,
      });

      if (data.success) {
        setConnectionStatus('success');
        toast.success(`IMAP connection successful! Found ${data.message_count || 0} messages.`);
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
    if (!selectedMailboxId && (!settings.host || !settings.username || !settings.password)) {
      toast.error("Please configure IMAP settings first");
      return;
    }

    setIsFetching(true);
    setFetchResult(null);

    try {
      const data = await api.admin('mailbox-fetch-emails', {
        mailbox_id: selectedMailboxId,
        host: settings.host,
        port: settings.port,
        user: settings.username,
        password: settings.password,
      });

      if (data.success) {
        setFetchResult({
          success: true,
          message: data.message,
          stats: data.stats
        });
        toast.success(`Fetched ${data.stats?.stored || 0} new emails!`);
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
    setSyncSource('local');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="w-8 h-8 text-primary" />
            IMAP Settings
          </h1>
          <p className="text-muted-foreground">Configure your cPanel email for receiving emails</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button variant="outline" onClick={handleFetchEmails} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {isFetching ? 'Fetching...' : 'Fetch Emails Now'}
          </Button>
        </div>
      </div>

      {/* Mailbox Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Select Mailbox
            </span>
            <div className="flex items-center gap-2">
              {isLoadingMailboxes && <Loader2 className="w-4 h-4 animate-spin" />}
              <Badge variant={syncSource === 'database' ? 'default' : 'secondary'}>
                {syncSource === 'database' ? 'From Database' : 'Local'}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            IMAP settings are stored per mailbox. Create mailboxes in SMTP Settings first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedMailboxId || ''} onValueChange={handleSelectMailbox}>
            <SelectTrigger>
              <SelectValue placeholder="Select a mailbox..." />
            </SelectTrigger>
            <SelectContent>
              {mailboxes.map((mb) => (
                <SelectItem key={mb.id} value={mb.id}>
                  <div className="flex items-center gap-2">
                    {mb.is_active ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-muted-foreground" />
                    )}
                    {mb.name} {mb.imap_host ? `- ${mb.imap_host}` : '(IMAP not configured)'}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {connectionStatus !== 'idle' && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          connectionStatus === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'
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
                      <p className="text-2xl font-bold text-green-600">{fetchResult.stats.stored}</p>
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
            <span>IMAP Configuration</span>
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
            Enter your cPanel email credentials. Find these in cPanel → Email Accounts → Connect Devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>cPanel IMAP Settings</AlertTitle>
            <AlertDescription>
              For cPanel hosting, typical settings are:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>Host:</strong> mail.yourdomain.com or your server hostname</li>
                <li><strong>Port:</strong> 993 (SSL) or 143 (non-SSL)</li>
                <li><strong>Username:</strong> Your full email address</li>
                <li><strong>Password:</strong> Your email account password</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">IMAP Host *</Label>
              <Input
                id="host"
                value={settings.host}
                onChange={(e) => updateSetting('host', e.target.value)}
                placeholder="mail.yourdomain.com"
              />
              <p className="text-xs text-muted-foreground">e.g., mail.yourdomain.com, imap.yourdomain.com</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port *</Label>
              <Select 
                value={settings.port.toString()} 
                onValueChange={(v) => {
                  const port = parseInt(v);
                  updateSetting('port', port);
                  updateSetting('useSSL', port === 993);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="993">993 (SSL - Recommended)</SelectItem>
                  <SelectItem value="143">143 (Non-SSL)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username (Email Address) *</Label>
              <Input
                id="username"
                value={settings.username}
                onChange={(e) => updateSetting('username', e.target.value)}
                placeholder="catchall@yourdomain.com"
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
                <Label>Delete After Fetch</Label>
                <p className="text-sm text-muted-foreground">Remove emails from server after storing locally</p>
              </div>
              <Switch
                checked={settings.deleteAfterFetch}
                onCheckedChange={(checked) => updateSetting('deleteAfterFetch', checked)}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button onClick={handleSave} disabled={isSaving} variant="outline">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Locally'}
            </Button>
            <Button onClick={handleSaveToDatabase} disabled={isSavingToDb || !selectedMailboxId}>
              {isSavingToDb ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Update Mailbox
            </Button>
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
              In cPanel → Email Accounts, create an email account. Then in Email Routing or Default Address, set up a catch-all to receive emails sent to any address at your domain.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">3. Set Up Cron Job</h4>
            <p className="text-sm text-muted-foreground">
              The IMAP polling script runs periodically to fetch new emails. Set up a cron job in cPanel → Cron Jobs to run every minute:
            </p>
            <code className="block p-2 bg-muted rounded text-sm">
              * * * * * php /home/username/public_html/api/cron/imap-poll.php
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminIMAPSettings;
