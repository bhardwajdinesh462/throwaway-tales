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
import { 
  Cog, Save, Eye, EyeOff, Send, CheckCircle, XCircle, Loader2, AlertTriangle, 
  RefreshCw, Plus, Trash2, AlertCircle, Server
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const SMTP_SETTINGS_KEY = 'smtp_settings';

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

interface Mailbox {
  id: string;
  name: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password?: string | null;
  smtp_from: string | null;
  is_active: boolean | null;
  emails_sent_today: number | null;
  emails_sent_this_hour: number | null;
  daily_limit: number | null;
  hourly_limit: number | null;
  last_error: string | null;
  last_error_at: string | null;
}

const defaultSettings: SMTPSettings = {
  host: '',
  port: 587,
  username: '',
  password: '',
  encryption: 'tls',
  fromEmail: '',
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
  const [connectivityResult, setConnectivityResult] = useState<{
    dns_resolved: boolean;
    tcp_connected: boolean;
    resolved_ip?: string;
    error?: string;
    message?: string;
  } | null>(null);
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Database mailbox state
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const [isLoadingMailboxes, setIsLoadingMailboxes] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [syncSource, setSyncSource] = useState<'local' | 'database'>('local');

  const fetchMailboxes = async () => {
    setIsLoadingMailboxes(true);
    try {
      const response = await api.admin('mailboxes', {});
      const data = response.mailboxes || [];
      setMailboxes(data);
      
      // If we have mailboxes and none selected, select the first active one
      if (data.length > 0 && !selectedMailboxId) {
        const firstActive = data.find((m: Mailbox) => m.is_active);
        if (firstActive) {
          setSelectedMailboxId(firstActive.id);
          loadMailboxToForm(firstActive);
        }
      }
    } catch (error: any) {
      console.error("Error fetching mailboxes:", error);
      toast.error("Failed to load mailboxes");
    } finally {
      setIsLoadingMailboxes(false);
    }
  };

  const loadMailboxToForm = (mailbox: Mailbox) => {
    setSettings({
      host: mailbox.smtp_host || '',
      port: mailbox.smtp_port || 587,
      username: mailbox.smtp_user || '',
      password: mailbox.smtp_password || '',
      encryption: mailbox.smtp_port === 465 ? 'ssl' : 'tls',
      fromEmail: mailbox.smtp_from || mailbox.smtp_user || '',
      fromName: mailbox.name || 'Nullsto',
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

  const handleSaveLocal = () => {
    setIsSaving(true);
    storage.set(SMTP_SETTINGS_KEY, settings);
    setSyncSource('local');
    setTimeout(() => {
      setIsSaving(false);
      toast.success("SMTP settings saved locally for testing!");
    }, 500);
  };

  const handleSaveToDatabase = async () => {
    if (!settings.host || !settings.username || !settings.password) {
      toast.error("Please fill in host, username, and password");
      return;
    }

    setIsSavingToDb(true);
    try {
      const mailboxData: Record<string, any> = {
        name: settings.fromName || 'Default Mailbox',
        smtp_host: settings.host,
        smtp_port: settings.port,
        smtp_user: settings.username,
        smtp_password: settings.password,
        smtp_from: settings.fromEmail || settings.username,
        is_active: settings.enabled,
      };

      if (selectedMailboxId) {
        mailboxData.id = selectedMailboxId;
        const { error } = await api.admin.saveMailbox(mailboxData);
        if (error) throw new Error(error.message);
        toast.success("Mailbox updated in database!");
      } else {
        const { data, error } = await api.admin.saveMailbox(mailboxData);
        if (error) throw new Error(error.message);
        if (data?.id) setSelectedMailboxId(data.id);
        toast.success("New mailbox created in database!");
      }
      
      setSyncSource('database');
      await fetchMailboxes();
    } catch (error: any) {
      console.error("Error saving to database:", error);
      toast.error(error.message || "Failed to save mailbox to database");
    } finally {
      setIsSavingToDb(false);
    }
  };

  const handleDeleteMailbox = async () => {
    if (!selectedMailboxId) return;
    
    if (mailboxes.length <= 1) {
      toast.error("Cannot delete the last mailbox");
      return;
    }

    try {
      const { error } = await api.admin.deleteMailbox(selectedMailboxId);
      if (error) throw new Error(error.message);
      toast.success("Mailbox deleted");
      setSelectedMailboxId(null);
      setSettings(defaultSettings);
      setSyncSource('local');
      await fetchMailboxes();
    } catch (error: any) {
      console.error("Error deleting mailbox:", error);
      toast.error(error.message || "Failed to delete mailbox");
    }
  };

  const handleTestConnection = async () => {
    if (!settings.host || !settings.port) {
      toast.error("Please enter SMTP host and port before testing");
      return;
    }

    setIsTesting(true);
    setConnectionStatus('idle');
    setConnectivityResult(null);
    
    try {
      const { data, error } = await api.admin.testMailbox('smtp', {
        host: settings.host,
        port: settings.port,
        user: settings.username,
        password: settings.password,
        from: settings.fromEmail || settings.username,
      });

      if (error) throw new Error(error.message);

      setConnectivityResult(data);

      if (data?.success) {
        setConnectionStatus('success');
        toast.success(data.message || `Connection successful!`);
      } else {
        setConnectionStatus('error');
        toast.error(data?.error || "Connection failed");
      }
    } catch (error: any) {
      console.error("Connectivity test error:", error);
      setConnectionStatus('error');
      setConnectivityResult({
        dns_resolved: false,
        tcp_connected: false,
        error: error.message || "Failed to test connectivity",
      });
      toast.error(error.message || "Failed to test connectivity");
    } finally {
      setIsTesting(false);
    }
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
      const data = await api.admin('mailbox-test-smtp', {
        host: settings.host,
        port: settings.port,
        user: settings.username,
        password: settings.password,
        from: settings.fromEmail || settings.username,
        test_email: testEmail,
      });

      if (data.success && data.email_sent) {
        setTestResult({ success: true, message: 'Test email sent successfully!' });
        toast.success(`Test email sent to ${testEmail}!`);
      } else {
        setTestResult({ success: false, message: data.error || "Failed to send test email" });
        toast.error(data.error || "Failed to send test email");
      }
    } catch (error: any) {
      console.error("Error sending test email:", error);
      setTestResult({ success: false, message: error.message || "Failed to send test email" });
      toast.error(error.message || "Failed to send test email");
    } finally {
      setIsSendingTest(false);
    }
  };

  useEffect(() => {
    fetchMailboxes();
  }, []);

  const updateSetting = <K extends keyof SMTPSettings>(key: K, value: SMTPSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setConnectionStatus('idle');
    setSyncSource('local');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Cog className="w-8 h-8 text-primary" />
            SMTP Settings
          </h1>
          <p className="text-muted-foreground">Configure your cPanel email settings for outbound emails</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isTesting ? 'animate-spin' : ''}`} />
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
                  Send a test email to verify your SMTP configuration is working.
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

                {testResult && (
                  <div className={`p-3 rounded-lg ${
                    testResult.success 
                      ? 'bg-green-500/10 border border-green-500/30' 
                      : 'bg-destructive/10 border border-destructive/30'
                  }`}>
                    <p className={testResult.success ? 'text-green-600' : 'text-destructive'}>
                      {testResult.message}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTestEmailDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSendTestEmail} disabled={isSendingTest}>
                  {isSendingTest ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {isSendingTest ? 'Sending...' : 'Send Test'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Mailbox Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Mailboxes
            </span>
            <div className="flex items-center gap-2">
              {isLoadingMailboxes && <Loader2 className="w-4 h-4 animate-spin" />}
              <Badge variant={syncSource === 'database' ? 'default' : 'secondary'}>
                {syncSource === 'database' ? 'From Database' : 'Local'}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            Select an existing mailbox or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
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
                        {mb.name} - {mb.smtp_host}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedMailboxId(null);
                setSettings(defaultSettings);
                setSyncSource('local');
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New
            </Button>
            {selectedMailboxId && mailboxes.length > 1 && (
              <Button variant="destructive" size="icon" onClick={handleDeleteMailbox}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Connection Status */}
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
              ? connectivityResult?.message || 'Connection successful! SMTP server is reachable.'
              : connectivityResult?.error || 'Connection failed. Please verify your credentials and server settings.'}
          </span>
        </div>
      )}

      {/* SMTP Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>SMTP Configuration</span>
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
            Enter your cPanel email credentials. Find these in cPanel → Email Accounts → Connect Devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>cPanel SMTP Settings</AlertTitle>
            <AlertDescription>
              For cPanel hosting, typical settings are:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>Host:</strong> mail.yourdomain.com or your server hostname</li>
                <li><strong>Port:</strong> 465 (SSL) or 587 (TLS/STARTTLS)</li>
                <li><strong>Username:</strong> Your full email address (e.g., noreply@yourdomain.com)</li>
                <li><strong>Password:</strong> Your email account password</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">SMTP Host *</Label>
              <Input
                id="host"
                value={settings.host}
                onChange={(e) => updateSetting('host', e.target.value)}
                placeholder="mail.yourdomain.com"
              />
              <p className="text-xs text-muted-foreground">e.g., mail.yourdomain.com, smtp.yourdomain.com</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port *</Label>
              <Select 
                value={settings.port.toString()} 
                onValueChange={(v) => updateSetting('port', parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="465">465 (SSL)</SelectItem>
                  <SelectItem value="587">587 (TLS/STARTTLS)</SelectItem>
                  <SelectItem value="25">25 (No encryption - not recommended)</SelectItem>
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
                placeholder="noreply@yourdomain.com"
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
              <Label htmlFor="fromEmail">From Email</Label>
              <Input
                id="fromEmail"
                value={settings.fromEmail}
                onChange={(e) => updateSetting('fromEmail', e.target.value)}
                placeholder="noreply@yourdomain.com"
              />
              <p className="text-xs text-muted-foreground">If empty, uses username as from address</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                value={settings.fromName}
                onChange={(e) => updateSetting('fromName', e.target.value)}
                placeholder="Nullsto"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Encryption</Label>
            <Select 
              value={settings.encryption} 
              onValueChange={(v) => updateSetting('encryption', v as SMTPSettings['encryption'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ssl">SSL (Port 465)</SelectItem>
                <SelectItem value="tls">TLS/STARTTLS (Port 587)</SelectItem>
                <SelectItem value="none">None (Not recommended)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-4 pt-4">
            <Button onClick={handleSaveLocal} disabled={isSaving} variant="outline">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Locally'}
            </Button>
            <Button onClick={handleSaveToDatabase} disabled={isSavingToDb}>
              {isSavingToDb ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {selectedMailboxId ? 'Update Mailbox' : 'Create Mailbox'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>cPanel Setup Instructions</CardTitle>
          <CardDescription>How to find your SMTP credentials in cPanel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. Create an Email Account</h4>
            <p className="text-sm text-muted-foreground">
              In cPanel, go to Email → Email Accounts → Create. Create an account like noreply@yourdomain.com
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">2. Get SMTP Settings</h4>
            <p className="text-sm text-muted-foreground">
              Click "Connect Devices" next to your email account. You'll see the SMTP server, port, and authentication details.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">3. Test Your Configuration</h4>
            <p className="text-sm text-muted-foreground">
              Use the "Test Connection" button above to verify your settings work, then send a test email to yourself.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSMTPSettings;
