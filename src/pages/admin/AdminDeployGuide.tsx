import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Rocket, Globe, Mail, Server, Shield, Copy, ExternalLink,
  CheckCircle, AlertTriangle, HelpCircle
} from "lucide-react";

const AdminDeployGuide = () => {
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
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Rocket className="w-8 h-8 text-primary" />
          Deployment Guide
        </h1>
        <p className="text-muted-foreground">Complete guide for deploying Nullsto with custom domain and email</p>
      </div>

      <Tabs defaultValue="dns">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dns">DNS Setup</TabsTrigger>
          <TabsTrigger value="email">Email Config</TabsTrigger>
          <TabsTrigger value="hosting">Lovable Hosting</TabsTrigger>
          <TabsTrigger value="custom">Custom Domain</TabsTrigger>
          <TabsTrigger value="troubleshoot">Troubleshooting</TabsTrigger>
        </TabsList>

        <TabsContent value="dns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                DNS Configuration at Regery.com
              </CardTitle>
              <CardDescription>
                Step-by-step guide for setting up DNS at your domain registrar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-semibold">1. Login to Regery.com</h4>
                <div className="bg-muted p-4 rounded-lg">
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Go to <a href="https://regery.com" target="_blank" className="text-primary hover:underline">regery.com</a></li>
                    <li>Login to your account</li>
                    <li>Find your domain and click "Manage"</li>
                    <li>Navigate to "DNS Management" or "DNS Settings"</li>
                  </ol>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">2. Add Required DNS Records</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border rounded-lg">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3">Type</th>
                        <th className="text-left p-3">Name/Host</th>
                        <th className="text-left p-3">Value/Points To</th>
                        <th className="text-left p-3">TTL</th>
                        <th className="text-left p-3">Purpose</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="p-3"><Badge variant="outline">A</Badge></td>
                        <td className="p-3 font-mono">@</td>
                        <td className="p-3 font-mono text-xs">[Your Hosting IP]</td>
                        <td className="p-3">3600</td>
                        <td className="p-3 text-muted-foreground">Website</td>
                        <td className="p-3"></td>
                      </tr>
                      <tr>
                        <td className="p-3"><Badge variant="outline">A</Badge></td>
                        <td className="p-3 font-mono">www</td>
                        <td className="p-3 font-mono text-xs">[Your Hosting IP]</td>
                        <td className="p-3">3600</td>
                        <td className="p-3 text-muted-foreground">WWW subdomain</td>
                        <td className="p-3"></td>
                      </tr>
                      <tr>
                        <td className="p-3"><Badge variant="outline">A</Badge></td>
                        <td className="p-3 font-mono">mail</td>
                        <td className="p-3 font-mono text-xs">[Your Mail Server IP]</td>
                        <td className="p-3">3600</td>
                        <td className="p-3 text-muted-foreground">Mail server</td>
                        <td className="p-3"></td>
                      </tr>
                      <tr>
                        <td className="p-3"><Badge variant="outline">MX</Badge></td>
                        <td className="p-3 font-mono">@</td>
                        <td className="p-3 font-mono text-xs">mail.yourdomain.com</td>
                        <td className="p-3">3600</td>
                        <td className="p-3 text-muted-foreground">Email routing</td>
                        <td className="p-3"><CopyButton text="mail.yourdomain.com" label="MX value" /></td>
                      </tr>
                      <tr>
                        <td className="p-3"><Badge variant="outline">TXT</Badge></td>
                        <td className="p-3 font-mono">@</td>
                        <td className="p-3 font-mono text-xs">v=spf1 mx a ~all</td>
                        <td className="p-3">3600</td>
                        <td className="p-3 text-muted-foreground">SPF (email auth)</td>
                        <td className="p-3"><CopyButton text="v=spf1 mx a ~all" label="SPF record" /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-lg">
                <div className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-500">Important Notes</p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>• Replace [Your Hosting IP] with your actual server IP address</li>
                      <li>• Replace [Your Mail Server IP] with your mail server's IP</li>
                      <li>• DNS changes take 24-48 hours to propagate globally</li>
                      <li>• Priority for MX record should be 10</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Server Configuration
              </CardTitle>
              <CardDescription>
                Configure SMTP and IMAP for your temporary email service
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-semibold">Required Backend Secrets</h4>
                <p className="text-sm text-muted-foreground">
                  These secrets must be configured in the Lovable Cloud backend panel under Edge Functions → Secrets
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">SMTP Secrets (Outgoing)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'].map((secret) => (
                          <div key={secret} className="flex items-center justify-between p-2 bg-muted rounded">
                            <code className="text-sm">{secret}</code>
                            <CopyButton text={secret} label={secret} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">IMAP Secrets (Incoming)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {['IMAP_HOST', 'IMAP_PORT', 'IMAP_USER', 'IMAP_PASSWORD'].map((secret) => (
                          <div key={secret} className="flex items-center justify-between p-2 bg-muted rounded">
                            <code className="text-sm">{secret}</code>
                            <CopyButton text={secret} label={secret} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Common Provider Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-medium mb-2">cPanel / Shared Hosting</p>
                    <div className="text-sm space-y-1">
                      <p>SMTP Host: <code>mail.yourdomain.com</code></p>
                      <p>SMTP Port: <code>465</code> (SSL) or <code>587</code> (TLS)</p>
                      <p>IMAP Host: <code>mail.yourdomain.com</code></p>
                      <p>IMAP Port: <code>993</code> (SSL)</p>
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-medium mb-2">Gmail / Google Workspace</p>
                    <div className="text-sm space-y-1">
                      <p>SMTP Host: <code>smtp.gmail.com</code></p>
                      <p>SMTP Port: <code>587</code></p>
                      <p>IMAP Host: <code>imap.gmail.com</code></p>
                      <p>IMAP Port: <code>993</code></p>
                      <p className="text-yellow-500 mt-2">Requires App Password</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hosting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Lovable Cloud Hosting
              </CardTitle>
              <CardDescription>
                Your app is automatically hosted on Lovable Cloud
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-green-500/10 border border-green-500/50 p-4 rounded-lg">
                <div className="flex gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-500">Automatic Hosting</p>
                    <p className="text-sm text-muted-foreground">
                      Your Nullsto app is automatically deployed and hosted on Lovable Cloud. 
                      No additional server setup required!
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">What's Included:</h4>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Automatic HTTPS/SSL certificate</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Global CDN for fast loading</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Automatic deployments on code changes</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Edge functions for backend logic</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Database hosting (PostgreSQL)</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Your Default URL:</h4>
                <div className="p-4 bg-muted rounded-lg flex items-center justify-between">
                  <code className="text-sm">https://your-project.lovable.app</code>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  You can connect a custom domain to replace this URL. See the "Custom Domain" tab.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Custom Domain Setup
              </CardTitle>
              <CardDescription>
                Connect your own domain to Lovable Cloud
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-semibold">Step 1: Add Custom Domain in Lovable</h4>
                <div className="bg-muted p-4 rounded-lg">
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Open your Lovable project</li>
                    <li>Go to Project Settings</li>
                    <li>Navigate to "Domains" section</li>
                    <li>Click "Add Custom Domain"</li>
                    <li>Enter your domain (e.g., nullsto.com)</li>
                  </ol>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Step 2: Configure DNS</h4>
                <p className="text-sm text-muted-foreground">
                  After adding your domain in Lovable, you'll receive DNS records to add at your registrar (Regery.com):
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border rounded-lg">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3">Type</th>
                        <th className="text-left p-3">Name</th>
                        <th className="text-left p-3">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="p-3"><Badge variant="outline">CNAME</Badge></td>
                        <td className="p-3 font-mono">www</td>
                        <td className="p-3 font-mono text-xs">[provided by Lovable]</td>
                      </tr>
                      <tr>
                        <td className="p-3"><Badge variant="outline">A</Badge></td>
                        <td className="p-3 font-mono">@</td>
                        <td className="p-3 font-mono text-xs">[provided by Lovable]</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Step 3: Verify & Wait</h4>
                <div className="bg-muted p-4 rounded-lg">
                  <ul className="space-y-2 text-sm">
                    <li>• Click "Verify" in Lovable after adding DNS records</li>
                    <li>• SSL certificate will be automatically provisioned</li>
                    <li>• DNS propagation may take up to 48 hours</li>
                    <li>• Once verified, your domain will be active</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="troubleshoot" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                Troubleshooting Guide
              </CardTitle>
              <CardDescription>
                Common issues and how to fix them
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">❌ Emails not being received</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Check MX records are correctly pointing to your mail server</li>
                    <li>• Verify catch-all email is configured at hosting provider</li>
                    <li>• Ensure IMAP secrets are correctly configured in backend</li>
                    <li>• Wait for DNS propagation (up to 48 hours)</li>
                    <li>• Check if mail server firewall allows incoming connections</li>
                  </ul>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">❌ Test email fails to send</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Verify SMTP host and port are correct</li>
                    <li>• Check SMTP credentials (username/password)</li>
                    <li>• Ensure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD are set in backend</li>
                    <li>• Some providers require specific ports (465 for SSL, 587 for TLS)</li>
                    <li>• Gmail requires App Password, not account password</li>
                  </ul>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">❌ Custom domain not working</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Verify DNS records match exactly what Lovable provides</li>
                    <li>• Wait for DNS propagation (use dnschecker.org to verify)</li>
                    <li>• Clear browser cache and try incognito mode</li>
                    <li>• Ensure there are no conflicting DNS records</li>
                  </ul>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">❌ IMAP connection fails</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Double-check IMAP host (usually mail.yourdomain.com)</li>
                    <li>• Verify port 993 for SSL or 143 for non-SSL</li>
                    <li>• Ensure email account exists and password is correct</li>
                    <li>• Some providers block IMAP by default - enable in settings</li>
                  </ul>
                </div>
              </div>

              <div className="bg-primary/10 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Need More Help?</h4>
                <p className="text-sm text-muted-foreground">
                  If you're still experiencing issues, check the following:
                </p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>• Edge function logs in the Lovable Cloud backend panel</li>
                  <li>• Your hosting provider's email logs</li>
                  <li>• DNS propagation status at dnschecker.org</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDeployGuide;
