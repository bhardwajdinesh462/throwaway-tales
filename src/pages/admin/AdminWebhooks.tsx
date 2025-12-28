import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Webhook, Send, CheckCircle, XCircle, Copy, RefreshCw, 
  Loader2, Code, Clock, AlertTriangle, FileJson, Globe
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WebhookLog {
  id: string;
  timestamp: string;
  provider: string;
  status: 'success' | 'rejected' | 'error';
  message: string;
  responseTime: number;
}

interface TestResult {
  success: boolean;
  message: string;
  response?: any;
  responseTime: number;
}

const AdminWebhooks = () => {
  const [activeTab, setActiveTab] = useState("test");
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  
  // Test form state
  const [provider, setProvider] = useState("custom");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderEmail, setSenderEmail] = useState("test@example.com");
  const [senderName, setSenderName] = useState("Test Sender");
  const [subject, setSubject] = useState("Test Webhook Email");
  const [bodyPlain, setBodyPlain] = useState("This is a test email sent via webhook.");
  const [bodyHtml, setBodyHtml] = useState("<p>This is a <strong>test email</strong> sent via webhook.</p>");
  const [customHeaders, setCustomHeaders] = useState("{}");
  
  // Webhook URL (would be configured in settings)
  const webhookUrl = `${window.location.origin}/api/emails/webhook.php`;

  const generateTestPayload = () => {
    const basePayload: Record<string, any> = {
      recipient: recipientEmail,
      from: senderEmail,
      from_name: senderName,
      subject: subject,
      body_plain: bodyPlain,
      body_html: bodyHtml,
      message_id: `test-${Date.now()}@webhook.test`
    };

    switch (provider) {
      case "mailgun":
        return {
          recipient: recipientEmail,
          from: `${senderName} <${senderEmail}>`,
          subject: subject,
          "body-plain": bodyPlain,
          "body-html": bodyHtml,
          "Message-Id": basePayload.message_id,
          signature: {
            timestamp: Math.floor(Date.now() / 1000),
            token: "test-token",
            signature: "test-signature"
          }
        };
      
      case "sendgrid":
        return [{
          envelope: JSON.stringify({ to: [recipientEmail] }),
          from: senderEmail,
          subject: subject,
          text: bodyPlain,
          html: bodyHtml,
          sg_message_id: basePayload.message_id
        }];
      
      case "postmark":
        return {
          OriginalRecipient: recipientEmail,
          FromFull: { Email: senderEmail, Name: senderName },
          Subject: subject,
          TextBody: bodyPlain,
          HtmlBody: bodyHtml,
          MessageID: basePayload.message_id
        };
      
      default:
        return basePayload;
    }
  };

  const sendTestWebhook = async () => {
    if (!recipientEmail) {
      toast.error("Please enter a recipient email address");
      return;
    }

    setIsLoading(true);
    setTestResult(null);
    const startTime = Date.now();

    try {
      const payload = generateTestPayload();
      let headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      // Add provider-specific headers
      try {
        const custom = JSON.parse(customHeaders);
        headers = { ...headers, ...custom };
      } catch (e) {
        // Invalid JSON, ignore
      }

      if (provider === "custom") {
        headers["X-Webhook-Secret"] = "test-secret";
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      const responseTime = Date.now() - startTime;
      const data = await response.json();

      const result: TestResult = {
        success: response.ok && data.success,
        message: data.message || (response.ok ? "Webhook processed successfully" : "Webhook failed"),
        response: data,
        responseTime
      };

      setTestResult(result);

      // Add to logs
      const log: WebhookLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        provider,
        status: result.success ? (data.data?.accepted ? 'success' : 'rejected') : 'error',
        message: result.message,
        responseTime
      };
      setWebhookLogs(prev => [log, ...prev].slice(0, 50));

      if (result.success && data.data?.accepted) {
        toast.success("Test email delivered successfully!");
      } else if (result.success && !data.data?.accepted) {
        toast.warning(`Webhook accepted but email not delivered: ${data.data?.reason || 'Unknown reason'}`);
      } else {
        toast.error(`Webhook failed: ${result.message}`);
      }

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const result: TestResult = {
        success: false,
        message: error.message || "Failed to send test webhook",
        responseTime
      };
      setTestResult(result);
      toast.error(result.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const copyPayload = () => {
    const payload = generateTestPayload();
    copyToClipboard(JSON.stringify(payload, null, 2), "Payload");
  };

  const copyCurlCommand = () => {
    const payload = generateTestPayload();
    const curl = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Secret: your-secret" \\
  -d '${JSON.stringify(payload)}'`;
    copyToClipboard(curl, "cURL command");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Webhook className="w-8 h-8 text-primary" />
            Webhook Testing
          </h1>
          <p className="text-muted-foreground">Test and verify webhook email delivery</p>
        </div>
      </div>

      {/* Webhook URL Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-muted-foreground">Your Webhook URL</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="bg-muted px-3 py-2 rounded-lg text-sm font-mono">
                  {webhookUrl}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Globe className="w-3 h-3 mr-1" />
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="test">
            <Send className="w-4 h-4 mr-2" />
            Test Webhook
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Clock className="w-4 h-4 mr-2" />
            Recent Logs
          </TabsTrigger>
          <TabsTrigger value="providers">
            <Code className="w-4 h-4 mr-2" />
            Provider Setup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="test" className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            {/* Test Form */}
            <Card>
              <CardHeader>
                <CardTitle>Send Test Email</CardTitle>
                <CardDescription>
                  Simulate an incoming email via webhook
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Provider Format</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom/Generic</SelectItem>
                      <SelectItem value="mailgun">Mailgun</SelectItem>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                      <SelectItem value="postmark">Postmark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Recipient Email *</Label>
                  <Input
                    placeholder="user@yourdomain.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be an active temp email address in your system
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sender Email</Label>
                    <Input
                      placeholder="sender@example.com"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sender Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    placeholder="Test Subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Body (Plain Text)</Label>
                  <Textarea
                    placeholder="Email body..."
                    value={bodyPlain}
                    onChange={(e) => setBodyPlain(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Body (HTML)</Label>
                  <Textarea
                    placeholder="<p>HTML email body...</p>"
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={sendTestWebhook} 
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Test Webhook
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={copyPayload}>
                    <FileJson className="w-4 h-4 mr-2" />
                    Copy Payload
                  </Button>
                  <Button variant="outline" onClick={copyCurlCommand}>
                    <Code className="w-4 h-4 mr-2" />
                    Copy cURL
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Result Panel */}
            <Card>
              <CardHeader>
                <CardTitle>Test Result</CardTitle>
                <CardDescription>
                  Response from the webhook endpoint
                </CardDescription>
              </CardHeader>
              <CardContent>
                {testResult ? (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-lg ${
                      testResult.success ? 'bg-green-500/10 border border-green-500/50' : 'bg-destructive/10 border border-destructive/50'
                    }`}>
                      <div className="flex items-center gap-2">
                        {testResult.success ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-destructive" />
                        )}
                        <span className={testResult.success ? 'text-green-500' : 'text-destructive'}>
                          {testResult.success ? 'Success' : 'Failed'}
                        </span>
                        <Badge variant="outline" className="ml-auto">
                          {testResult.responseTime}ms
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {testResult.message}
                      </p>
                    </div>

                    {testResult.response && (
                      <div className="space-y-2">
                        <Label>Response Data</Label>
                        <ScrollArea className="h-64 rounded-lg border bg-muted p-4">
                          <pre className="text-xs font-mono whitespace-pre-wrap">
                            {JSON.stringify(testResult.response, null, 2)}
                          </pre>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Send className="w-12 h-12 mb-4 opacity-50" />
                    <p>Send a test webhook to see the result</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Webhook Logs</CardTitle>
                  <CardDescription>Recent webhook requests and their status</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {webhookLogs.length > 0 ? (
                <div className="space-y-2">
                  {webhookLogs.map((log) => (
                    <div 
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        {log.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {log.status === 'rejected' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                        {log.status === 'error' && <XCircle className="w-4 h-4 text-destructive" />}
                        <div>
                          <p className="text-sm font-medium">{log.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{log.provider}</Badge>
                        <Badge variant="secondary">{log.responseTime}ms</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Clock className="w-12 h-12 mb-4 opacity-50" />
                  <p>No webhook logs yet</p>
                  <p className="text-sm">Send a test webhook to see logs here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                name: "Mailgun",
                description: "Popular transactional email service",
                docs: "https://documentation.mailgun.com/en/latest/api-webhooks.html",
                fields: ["recipient", "from", "subject", "body-plain", "body-html", "signature"]
              },
              {
                name: "SendGrid",
                description: "Cloud-based email delivery",
                docs: "https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook",
                fields: ["envelope", "from", "subject", "text", "html"]
              },
              {
                name: "Postmark",
                description: "Developer-friendly email API",
                docs: "https://postmarkapp.com/developer/webhooks/inbound-webhook",
                fields: ["OriginalRecipient", "FromFull", "Subject", "TextBody", "HtmlBody"]
              },
              {
                name: "Amazon SES",
                description: "AWS email service",
                docs: "https://docs.aws.amazon.com/ses/latest/dg/receiving-email-notifications.html",
                fields: ["mail", "content", "source", "destination"]
              }
            ].map((provider) => (
              <Card key={provider.name}>
                <CardHeader>
                  <CardTitle className="text-lg">{provider.name}</CardTitle>
                  <CardDescription>{provider.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Expected Fields</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {provider.fields.map((field) => (
                        <Badge key={field} variant="secondary" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <a href={provider.docs} target="_blank" rel="noopener noreferrer">
                      View Documentation
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminWebhooks;
