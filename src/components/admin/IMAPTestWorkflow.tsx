import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Send, 
  Mail, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Radio,
  ArrowRight,
  Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface WorkflowStep {
  id: string;
  label: string;
  status: "pending" | "running" | "success" | "error";
  message?: string;
  duration?: number;
}

export const IMAPTestWorkflow = () => {
  const [testEmail, setTestEmail] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [realtimeReceived, setRealtimeReceived] = useState(false);
  const channelRef = useRef<ReturnType<typeof api.realtime.channel> | null>(null);

  const initialSteps: WorkflowStep[] = [
    { id: "send", label: "Send Test Email via SMTP", status: "pending" },
    { id: "wait", label: "Wait for SMTP Delivery", status: "pending" },
    { id: "poll", label: "Trigger IMAP Poll", status: "pending" },
    { id: "verify", label: "Verify Email in Database", status: "pending" },
    { id: "realtime", label: "Verify Realtime Event", status: "pending" },
  ];

  const updateStep = (id: string, updates: Partial<WorkflowStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const runWorkflow = async () => {
    if (!testEmail) {
      toast.error("Please enter a test email address");
      return;
    }

    setIsRunning(true);
    setSteps(initialSteps);
    setRealtimeReceived(false);

    const startTime = Date.now();

    // Step 1: Set up realtime listener first
    const channelName = `test-workflow-${Date.now()}`;
    const channel = api.realtime.channel(channelName);
    
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "received_emails",
      },
      (payload) => {
        console.log("[TestWorkflow] Realtime event received:", payload);
        const email = payload.new as { subject?: string };
        if (email?.subject?.includes("IMAP Test Workflow")) {
          setRealtimeReceived(true);
        }
      }
    ).subscribe();

    channelRef.current = channel;

    try {
      // Step 1: Send test email
      updateStep("send", { status: "running" });
      const sendStart = Date.now();

      const { data: sendData, error: sendError } = await supabase.functions.invoke("send-test-email", {
        body: {
          recipientEmail: testEmail,
          subject: `IMAP Test Workflow - ${new Date().toISOString()}`,
          body: `<p>This is an automated test email for the IMAP workflow verification.</p><p>Timestamp: ${new Date().toISOString()}</p>`,
        },
      });

      if (sendError) throw new Error(sendError.message);
      if (!sendData?.success) throw new Error(sendData?.error || "Failed to send test email");

      updateStep("send", { 
        status: "success", 
        message: `Sent via ${sendData.mailbox || "SMTP"}`,
        duration: Date.now() - sendStart 
      });

      // Step 2: Wait for delivery
      updateStep("wait", { status: "running" });
      const waitStart = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 5000));
      updateStep("wait", { 
        status: "success", 
        message: "Waited 5 seconds",
        duration: Date.now() - waitStart 
      });

      // Step 3: Trigger IMAP poll
      updateStep("poll", { status: "running" });
      const pollStart = Date.now();

      const { data: pollData, error: pollError } = await supabase.functions.invoke("fetch-imap-emails", {
        body: { mode: "latest", limit: 20 },
      });

      if (pollError) {
        updateStep("poll", { status: "error", message: pollError.message });
      } else if (pollData?.success) {
        updateStep("poll", { 
          status: "success", 
          message: `Stored ${pollData.stats?.stored || 0} emails`,
          duration: Date.now() - pollStart 
        });
      } else {
        updateStep("poll", { status: "error", message: pollData?.error || "Poll failed" });
      }

      // Step 4: Verify in database
      updateStep("verify", { status: "running" });
      const verifyStart = Date.now();

      // Wait a moment for the email to be stored
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { data: emails, error: dbError } = await supabase
        .from("received_emails")
        .select("id, subject, from_address, received_at")
        .ilike("subject", "%IMAP Test Workflow%")
        .gte("received_at", new Date(startTime - 60000).toISOString())
        .order("received_at", { ascending: false })
        .limit(1);

      if (dbError) {
        updateStep("verify", { status: "error", message: dbError.message });
      } else if (emails && emails.length > 0) {
        updateStep("verify", { 
          status: "success", 
          message: `Found email: ${emails[0].subject?.slice(0, 30)}...`,
          duration: Date.now() - verifyStart 
        });
      } else {
        updateStep("verify", { 
          status: "error", 
          message: "Email not found in database. Check recipient address matching." 
        });
      }

      // Step 5: Check realtime event
      updateStep("realtime", { status: "running" });
      
      // Wait a bit more for realtime
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (realtimeReceived) {
        updateStep("realtime", { status: "success", message: "Event received!" });
      } else {
        // Check if we received it during the wait
        if (realtimeReceived) {
          updateStep("realtime", { status: "success", message: "Event received!" });
        } else {
          updateStep("realtime", { 
            status: "error", 
            message: "No realtime event detected. Check if temp_email_id matches." 
          });
        }
      }

      toast.success("Test workflow completed!");
    } catch (error: any) {
      console.error("Workflow error:", error);
      toast.error(error.message || "Workflow failed");
      
      // Mark remaining steps as error
      setSteps((prev) =>
        prev.map((s) => (s.status === "pending" || s.status === "running" ? { ...s, status: "error" as const } : s))
      );
    } finally {
      setIsRunning(false);
      
      // Clean up realtime channel
      if (channelRef.current) {
        api.realtime.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }
  };

  // Update realtime step when event is received
  useEffect(() => {
    if (realtimeReceived && isRunning) {
      updateStep("realtime", { status: "success", message: "Event received!" });
    }
  }, [realtimeReceived, isRunning]);

  const completedSteps = steps.filter((s) => s.status === "success").length;
  const progress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5 text-primary" />
          Test Email Workflow
        </CardTitle>
        <CardDescription>
          Send a test email and verify it arrives via IMAP polling and triggers realtime events
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="test-email">Recipient Email Address</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="test@yourdomain.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              disabled={isRunning}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter an address that your IMAP mailbox receives (e.g., your catch-all domain)
            </p>
          </div>
          <div className="flex items-end">
            <Button onClick={runWorkflow} disabled={isRunning || !testEmail}>
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Run Test
                </>
              )}
            </Button>
          </div>
        </div>

        {steps.length > 0 && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="space-y-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    step.status === "running" ? "border-primary bg-primary/5" :
                    step.status === "success" ? "border-green-500/30 bg-green-500/5" :
                    step.status === "error" ? "border-destructive/30 bg-destructive/5" :
                    "border-border"
                  }`}
                >
                  <div className="shrink-0">
                    {step.status === "pending" && (
                      <div className="w-6 h-6 rounded-full border-2 border-muted flex items-center justify-center text-xs text-muted-foreground">
                        {index + 1}
                      </div>
                    )}
                    {step.status === "running" && (
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    )}
                    {step.status === "success" && (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    )}
                    {step.status === "error" && (
                      <XCircle className="w-6 h-6 text-destructive" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${step.status === "pending" ? "text-muted-foreground" : "text-foreground"}`}>
                      {step.label}
                    </p>
                    {step.message && (
                      <p className="text-xs text-muted-foreground truncate">{step.message}</p>
                    )}
                  </div>

                  {step.duration && (
                    <Badge variant="outline" className="text-xs shrink-0">
                      <Clock className="w-3 h-3 mr-1" />
                      {(step.duration / 1000).toFixed(1)}s
                    </Badge>
                  )}

                  {index < steps.length - 1 && step.status === "success" && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {/* Realtime indicator */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Radio className={`w-4 h-4 ${realtimeReceived ? "text-green-500" : "text-muted-foreground"}`} />
              <span className="text-sm">
                Realtime Event: {realtimeReceived ? (
                  <Badge variant="default" className="bg-green-500/20 text-green-600">Received</Badge>
                ) : (
                  <Badge variant="outline">Waiting...</Badge>
                )}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default IMAPTestWorkflow;
