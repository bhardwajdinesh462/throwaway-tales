import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Wand2, Server, Mail, Shield, Globe, CheckCircle, XCircle,
  Copy, ExternalLink, Loader2, RefreshCw, AlertTriangle
} from "lucide-react";

interface ConfigStatus {
  name: string;
  configured: boolean;
}

interface EmailConfig {
  smtp: { configured: boolean; secrets: ConfigStatus[] };
  imap: { configured: boolean; secrets: ConfigStatus[] };
}

const AdminEmailSetup = () => {
  const [activeTab, setActiveTab] = useState("credentials");
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-email-config');
      if (error) throw error;
      setConfig(data);
    } catch (error: any) {
      console.error("Error fetching config:", error);
      toast.error("Failed to check configuration status");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const CopyButton = ({ text, label }: { text: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => copyToClipboard(text, label)}
      className="h-6 w-6 p-0"
    >
      <Copy className="h-3 w-3" />
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wand2 className="w-8 h-8 text-primary" />
            Email Setup Wizard
          </h1>
          <p className="text-muted-foreground">Step-by-step guide to configure email receiving and sending</p>
        </div>
        <Button variant="outline" onClick={fetchConfig} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      {/* Configuration Status Overview */}
      <div className="grid grid-cols-2 gap-4">
        <Card className={config?.smtp.configured ? 'border-green-500/50' : 'border-yellow-500/50'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-semibold">SMTP (Outgoing)</p>
                  <p className="text-sm text-muted-foreground">Send emails</p>
                </div>
              </div>
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : config?.smtp.configured ? (
                <Badge className="bg-green-500">Configured</Badge>
              ) : (
                <Badge variant="outline" className="border-yellow-500 text-yellow-500">Not Configured</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={config?.imap.configured ? 'border-green-500/50' : 'border-yellow-500/50'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Server className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-semibold">IMAP (Incoming)</p>
                  <p className="text-sm text-muted-foreground">Receive emails</p>
                </div>
              </div>
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : config?.imap.configured ? (
                <Badge className="bg-green-500">Configured</Badge>
              ) : (
                <Badge variant="outline" className="border-yellow-500 text-yellow-500">Not Configured</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Setup Steps */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="credentials">1. Get Credentials</TabsTrigger>
          <TabsTrigger value="catchall">2. Catch-All Email</TabsTrigger>
          <TabsTrigger value="backend">3. Backend Secrets</TabsTrigger>
          <TabsTrigger value="dns">4. DNS Setup</TabsTrigger>
          <TabsTrigger value="test">5. Test & Verify</TabsTrigger>
        </TabsList>

        <TabsContent value="credentials" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Step 1: Get SMTP/IMAP Credentials
              </CardTitle>
              <CardDescription>
                Find your email server settings from your hosting provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-3">Where to find your credentials:</h4>
                <div className="grid gap-4">
                  <div className="p-3 bg-background rounded border">
                    <p className="font-medium">cPanel Hosting</p>
                    <p className="text-sm text-muted-foreground">
                      Login → Email Accounts → Connect Devices → Mail Client Manual Settings
                    </p>
                  </div>
                  <div className="p-3 bg-background rounded border">
                    <p className="font-medium">Plesk Hosting</p>
                    <p className="text-sm text-muted-foreground">
                      Login → Mail → Email Addresses → Select account → Manual Configuration
                    </p>
                  </div>
                  <div className="p-3 bg-background rounded border">
                    <p className="font-medium">DirectAdmin</p>
                    <p className="text-sm text-muted-foreground">
                      Login → E-mail Manager → E-mail Accounts → Actions → View Config
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Typical Settings Format:</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-medium mb-2 text-primary">SMTP (Outgoing)</p>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Host:</span> mail.yourdomain.com</p>
                      <p><span className="text-muted-foreground">Port:</span> 465 (SSL) or 587 (TLS)</p>
                      <p><span className="text-muted-foreground">Username:</span> catchall@yourdomain.com</p>
                      <p><span className="text-muted-foreground">Password:</span> Your email password</p>
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-medium mb-2 text-primary">IMAP (Incoming)</p>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Host:</span> mail.yourdomain.com</p>
                      <p><span className="text-muted-foreground">Port:</span> 993 (SSL)</p>
                      <p><span className="text-muted-foreground">Username:</span> catchall@yourdomain.com</p>
                      <p><span className="text-muted-foreground">Password:</span> Your email password</p>
                    </div>
                  </div>
                </div>
              </div>

              <Button onClick={() => setActiveTab("catchall")}>
                Next: Set Up Catch-All Email →
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catchall" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Step 2: Create Catch-All Email Account
              </CardTitle>
              <CardDescription>
                A catch-all email receives all emails sent to any address at your domain
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-lg">
                <div className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-500">Important</p>
                    <p className="text-sm text-muted-foreground">
                      The catch-all email must be created at your hosting provider, not in this admin panel.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Instructions for cPanel:</h4>
                <ol className="list-decimal list-inside space-y-3 text-sm">
                  <li>Login to your cPanel account</li>
                  <li>Navigate to <strong>Email</strong> → <strong>Email Accounts</strong></li>
                  <li>Click <strong>Create</strong> to add a new email account</li>
                  <li>Create an account like <code className="bg-muted px-2 py-1 rounded">catchall@yourdomain.com</code></li>
                  <li>Set a strong password and note it down</li>
                  <li>Go to <strong>Email</strong> → <strong>Default Address</strong> (or Catch-All)</li>
                  <li>Select your domain and set it to forward to <code className="bg-muted px-2 py-1 rounded">catchall@yourdomain.com</code></li>
                </ol>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setActiveTab("credentials")}>
                  ← Back
                </Button>
                <Button onClick={() => setActiveTab("backend")}>
                  Next: Configure Backend Secrets →
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Step 3: Configure Backend Secrets
              </CardTitle>
              <CardDescription>
                Add your email credentials as secure backend secrets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm mb-4">
                  Backend secrets are securely stored environment variables that the email system uses.
                  You need to configure these in the Lovable Cloud backend panel.
                </p>
              </div>

              {/* Current Status */}
              <div className="space-y-4">
                <h4 className="font-semibold">SMTP Secrets Status:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {config?.smtp.secrets.map((secret) => (
                    <div key={secret.name} className="flex items-center gap-2 p-2 bg-muted rounded">
                      {secret.configured ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      <code className="text-sm">{secret.name}</code>
                      <CopyButton text={secret.name} label={secret.name} />
                    </div>
                  ))}
                </div>

                <h4 className="font-semibold mt-4">IMAP Secrets Status:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {config?.imap.secrets.map((secret) => (
                    <div key={secret.name} className="flex items-center gap-2 p-2 bg-muted rounded">
                      {secret.configured ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      <code className="text-sm">{secret.name}</code>
                      <CopyButton text={secret.name} label={secret.name} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-primary/10 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">How to add secrets:</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Click the "View Backend" button below</li>
                  <li>Navigate to <strong>Edge Functions → Secrets</strong></li>
                  <li>Add each secret with its corresponding value from your hosting provider</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setActiveTab("catchall")}>
                  ← Back
                </Button>
                <Button onClick={() => setActiveTab("dns")}>
                  Next: DNS Setup →
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Step 4: DNS Configuration
              </CardTitle>
              <CardDescription>
                Configure DNS records at your domain registrar (e.g., Regery.com)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm">
                  DNS records tell the internet where to route emails and web traffic for your domain.
                  Add these records at your domain registrar's DNS management panel.
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Required DNS Records:</h4>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Value</th>
                        <th className="text-left p-2">Priority</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="p-2"><Badge>MX</Badge></td>
                        <td className="p-2">@</td>
                        <td className="p-2 font-mono text-xs">mail.yourdomain.com</td>
                        <td className="p-2">10</td>
                        <td className="p-2"><CopyButton text="mail.yourdomain.com" label="MX record" /></td>
                      </tr>
                      <tr>
                        <td className="p-2"><Badge>A</Badge></td>
                        <td className="p-2">mail</td>
                        <td className="p-2 font-mono text-xs">[Your server IP]</td>
                        <td className="p-2">-</td>
                        <td className="p-2"></td>
                      </tr>
                      <tr>
                        <td className="p-2"><Badge>TXT</Badge></td>
                        <td className="p-2">@</td>
                        <td className="p-2 font-mono text-xs">v=spf1 mx a ~all</td>
                        <td className="p-2">-</td>
                        <td className="p-2"><CopyButton text="v=spf1 mx a ~all" label="SPF record" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-lg">
                <div className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-500">DNS Propagation</p>
                    <p className="text-sm text-muted-foreground">
                      DNS changes can take up to 24-48 hours to propagate worldwide.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setActiveTab("backend")}>
                  ← Back
                </Button>
                <Button onClick={() => setActiveTab("test")}>
                  Next: Test & Verify →
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Step 5: Test & Verify
              </CardTitle>
              <CardDescription>
                Verify your email configuration is working correctly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-4">
                      {config?.smtp.configured ? (
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      ) : (
                        <XCircle className="w-8 h-8 text-destructive" />
                      )}
                      <div>
                        <p className="font-semibold">SMTP Configuration</p>
                        <p className="text-sm text-muted-foreground">
                          {config?.smtp.configured ? 'All secrets configured' : 'Missing secrets'}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.location.href = '/admin/smtp'}
                    >
                      Go to SMTP Settings to Test
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-4">
                      {config?.imap.configured ? (
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      ) : (
                        <XCircle className="w-8 h-8 text-destructive" />
                      )}
                      <div>
                        <p className="font-semibold">IMAP Configuration</p>
                        <p className="text-sm text-muted-foreground">
                          {config?.imap.configured ? 'All secrets configured' : 'Missing secrets'}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.location.href = '/admin/imap'}
                    >
                      Go to IMAP Settings to Test
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-green-500/10 border border-green-500/50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-500 mb-2">Testing Checklist:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    All backend secrets are configured
                  </li>
                  <li className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    Catch-all email is set up at hosting provider
                  </li>
                  <li className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    DNS records are configured (MX, SPF)
                  </li>
                  <li className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    Test email sends successfully from SMTP settings
                  </li>
                  <li className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    Fetch emails works from IMAP settings
                  </li>
                </ul>
              </div>

              <Button variant="outline" onClick={() => setActiveTab("dns")}>
                ← Back
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminEmailSetup;
