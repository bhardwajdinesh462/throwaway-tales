import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
import { 
  Cog, Save, Eye, EyeOff, Send, CheckCircle, XCircle, Loader2, AlertTriangle, 
  ExternalLink, Wifi, Database, RefreshCw, Plus, Trash2, AlertCircle, Info,
  CheckCircle2, Link as LinkIcon
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
import { supabase } from "@/integrations/supabase/client";

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

interface ConfigStatus {
  name: string;
  configured: boolean;
}

interface EmailConfig {
  smtp: { configured: boolean; secrets: ConfigStatus[] };
  imap: { configured: boolean; secrets: ConfigStatus[] };
}

interface Mailbox {
  id: string;
  name: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_from: string | null;
  is_active: boolean | null;
  emails_sent_today: number | null;
  emails_sent_this_hour: number | null;
  daily_limit: number | null;
  hourly_limit: number | null;
  last_error: string | null;
  last_error_at: string | null;
}

interface DeliverabilityInfo {
  checkSpam: boolean;
  spamHint: string;
  spfDkimHint?: string;
  testTools?: string[];
  commonIssues?: string[];
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
  const [connectivityResult, setConnectivityResult] = useState<{
    dnsResolved: boolean;
    tcpConnected: boolean;
    resolvedIp?: string;
    responseTime?: number;
    error?: string;
  } | null>(null);
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; deliverabilityInfo?: DeliverabilityInfo } | null>(null);
  const [backendConfig, setBackendConfig] = useState<EmailConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  
  // Database mailbox state
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const [isLoadingMailboxes, setIsLoadingMailboxes] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [syncSource, setSyncSource] = useState<'local' | 'database'>('local');

  useEffect(() => {
    fetchBackendConfig();
    fetchMailboxes();
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

  const fetchMailboxes = async () => {
    setIsLoadingMailboxes(true);
    try {
      const { data, error } = await supabase
        .from('mailboxes')
        .select('*')
        .order('priority', { ascending: true });
      
      if (error) throw error;
      setMailboxes(data || []);
      
      // If we have mailboxes and none selected, select the first active one
      if (data && data.length > 0 && !selectedMailboxId) {
        const firstActive = data.find(m => m.is_active);
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
      const mailboxData = {
        name: settings.fromName || 'Default Mailbox',
        smtp_host: settings.host,
        smtp_port: settings.port,
        smtp_user: settings.username,
        smtp_password: settings.password,
        smtp_from: settings.fromEmail || settings.username,
        is_active: settings.enabled,
        updated_at: new Date().toISOString(),
      };

      if (selectedMailboxId) {
        // Update existing mailbox
        const { error } = await supabase
          .from('mailboxes')
          .update(mailboxData)
          .eq('id', selectedMailboxId);
        
        if (error) throw error;
        toast.success("Mailbox updated in database!");
      } else {
        // Insert new mailbox
        const { data, error } = await supabase
          .from('mailboxes')
          .insert(mailboxData)
          .select()
          .single();
        
        if (error) throw error;
        setSelectedMailboxId(data.id);
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
      const { error } = await supabase
        .from('mailboxes')
        .delete()
        .eq('id', selectedMailboxId);
      
      if (error) throw error;
      
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
      const { data, error } = await supabase.functions.invoke('smtp-connectivity-test', {
        body: {
          host: settings.host,
          port: settings.port,
        },
      });

      if (error) throw error;

      setConnectivityResult(data);

      if (data.success) {
        setConnectionStatus('success');
        toast.success(`Connection successful! Resolved to ${data.resolvedIp} in ${data.responseTime}ms`);
      } else {
        setConnectionStatus('error');
        toast.error(data.error || "Connection failed");
      }
    } catch (error: any) {
      console.error("Connectivity test error:", error);
      setConnectionStatus('error');
      setConnectivityResult({
        dnsResolved: false,
        tcpConnected: false,
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
      const requestBody: any = { recipientEmail: testEmail };

      // If settings are loaded from the database, let the backend pick an available mailbox
      // (avoids sending passwords over the wire and enables load balancing).
      if (syncSource !== 'database' || !selectedMailboxId) {
        requestBody.smtpConfig = {
          host: settings.host,
          port: settings.port,
          username: settings.username,
          password: settings.password,
          encryption: settings.encryption,
          fromEmail: settings.fromEmail,
          fromName: settings.fromName,
        };
      }

      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: requestBody,
      });

      if (error) throw error;

      if (data.success) {
        setTestResult({ 
          success: true, 
          message: data.message,
          deliverabilityInfo: data.deliverabilityInfo
        });
        toast.success(`Test email sent to ${testEmail}!`);
      } else {
        setTestResult({ 
          success: false, 
          message: data.error,
          deliverabilityInfo: data.deliverabilityInfo
        });
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
          <p className="text-muted-foreground">Configure email sending settings for outbound emails</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
            {isTesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wifi className="w-4 h-4 mr-2" />}
            {isTesting ? 'Testing...' : 'Test Connectivity'}
          </Button>
          <Dialog open={testEmailDialogOpen} onOpenChange={setTestEmailDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Send className="w-4 h-4 mr-2" />
                Send Test Email
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
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
                  <div className={`p-4 rounded-lg space-y-3 ${
                    testResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-destructive/10 border border-destructive/30'
                  }`}>
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                      )}
                      <span className={`text-sm ${testResult.success ? 'text-green-500' : 'text-destructive'}`}>
                        {testResult.message}
                      </span>
                    </div>
                    
                    {testResult.deliverabilityInfo && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-amber-600 dark:text-amber-400">
                              {testResult.deliverabilityInfo.spamHint}
                            </p>
                            {testResult.deliverabilityInfo.spfDkimHint && (
                              <p className="text-muted-foreground mt-1">
                                {testResult.deliverabilityInfo.spfDkimHint}
                              </p>
                            )}
                            {testResult.deliverabilityInfo.testTools && (
                              <div className="mt-2 flex gap-2">
                                {testResult.deliverabilityInfo.testTools.map((tool, i) => (
                                  <a
                                    key={i}
                                    href={`https://${tool}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline flex items-center gap-1"
                                  >
                                    <LinkIcon className="w-3 h-3" />
                                    {tool}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
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
        </div>
      </div>

      {/* Database Mailbox Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Database Mailboxes
            </span>
            <div className="flex items-center gap-2">
              <Badge variant={syncSource === 'database' ? 'default' : 'outline'}>
                {syncSource === 'database' ? 'Synced with DB' : 'Local Only'}
              </Badge>
              <Button variant="outline" size="sm" onClick={fetchMailboxes} disabled={isLoadingMailboxes}>
                <RefreshCw className={`w-4 h-4 ${isLoadingMailboxes ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Mailboxes stored in the database are used by edge functions for sending emails with load balancing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select
              value={selectedMailboxId || ""}
              onValueChange={handleSelectMailbox}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a mailbox to edit..." />
              </SelectTrigger>
              <SelectContent>
                {mailboxes.map((mailbox) => (
                  <SelectItem key={mailbox.id} value={mailbox.id}>
                    <div className="flex items-center gap-2">
                      {mailbox.is_active ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span>{mailbox.name}</span>
                      <span className="text-muted-foreground text-xs">
                        ({mailbox.smtp_host})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedMailboxId(null);
                setSettings(defaultSettings);
                setSyncSource('local');
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
            {selectedMailboxId && (
              <Button variant="destructive" size="icon" onClick={handleDeleteMailbox}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Mailbox stats if selected */}
          {selectedMailboxId && mailboxes.find(m => m.id === selectedMailboxId) && (
            <div className="grid grid-cols-4 gap-2 p-3 bg-muted rounded-lg text-sm">
              {(() => {
                const mb = mailboxes.find(m => m.id === selectedMailboxId)!;
                return (
                  <>
                    <div>
                      <span className="text-muted-foreground">Today:</span>{' '}
                      <strong>{mb.emails_sent_today || 0}</strong>/{mb.daily_limit || 100}
                    </div>
                    <div>
                      <span className="text-muted-foreground">This hour:</span>{' '}
                      <strong>{mb.emails_sent_this_hour || 0}</strong>/{mb.hourly_limit || 20}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{' '}
                      <Badge variant={mb.is_active ? "default" : "secondary"}>
                        {mb.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div>
                      {mb.last_error && (
                        <span className="text-destructive text-xs" title={mb.last_error}>
                          Last error: {new Date(mb.last_error_at!).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSaveLocal} disabled={isSaving} variant="outline">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Local'}
            </Button>
            <Button onClick={handleSaveToDatabase} disabled={isSavingToDb}>
              <Database className="w-4 h-4 mr-2" />
              {isSavingToDb ? 'Saving...' : selectedMailboxId ? 'Update in Database' : 'Save to Database'}
            </Button>
          </div>
        </CardContent>
      </Card>

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
        <div className={`p-4 rounded-lg space-y-2 ${
          connectionStatus === 'success' ? 'bg-green-500/10 border border-green-500/30' : 'bg-destructive/10 border border-destructive/30'
        }`}>
          <div className="flex items-center gap-2">
            {connectionStatus === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive" />
            )}
            <span className={connectionStatus === 'success' ? 'text-green-500' : 'text-destructive'}>
              {connectionStatus === 'success' 
                ? 'Connection successful! SMTP server is reachable.'
                : 'Connection failed. Check the details below.'}
            </span>
          </div>
          
          {connectivityResult && (
            <div className="ml-7 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                {connectivityResult.dnsResolved ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                <span>DNS Resolution: {connectivityResult.dnsResolved ? `✓ Resolved to ${connectivityResult.resolvedIp}` : '✗ Failed'}</span>
              </div>
              <div className="flex items-center gap-2">
                {connectivityResult.tcpConnected ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                <span>TCP Connection: {connectivityResult.tcpConnected ? `✓ Connected in ${connectivityResult.responseTime}ms` : '✗ Failed'}</span>
              </div>
              {connectivityResult.error && (
                <div className="p-2 bg-destructive/10 rounded text-destructive text-xs mt-2">
                  {connectivityResult.error}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
            Configure SMTP settings. Save to database to enable use by edge functions.
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

      {/* Email Deliverability Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Email Deliverability Guide
          </CardTitle>
          <CardDescription>
            Improve email deliverability and avoid spam folders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertTitle>Check Spam Folder First!</AlertTitle>
            <AlertDescription>
              If test emails are sent successfully but not received, check your spam/junk folder. 
              New sending domains often get filtered.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                SPF Record
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Add an SPF record to authorize your mail server.
              </p>
              <code className="text-xs bg-background p-2 rounded block">
                v=spf1 include:_spf.your-provider.com ~all
              </code>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                DKIM Record
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Enable DKIM signing in your email provider's settings.
              </p>
              <code className="text-xs bg-background p-2 rounded block">
                Contact your email provider for DKIM setup
              </code>
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Test Your Email Deliverability</h4>
            <div className="flex gap-2 flex-wrap">
              <a 
                href="https://www.mail-tester.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                mail-tester.com
              </a>
              <a 
                href="https://mxtoolbox.com/deliverability" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                MXToolbox Deliverability
              </a>
              <a 
                href="https://www.learndmarc.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Learn DMARC
              </a>
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
