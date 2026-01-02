import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, Mail, Save, Send, RefreshCw, Clock, AlertTriangle, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface AlertSettings {
  enabled: boolean;
  admin_emails: string[];
  alerts: {
    health_check_failure: { enabled: boolean; threshold?: number };
    dns_verification_failure: { enabled: boolean };
    smtp_connection_failure: { enabled: boolean };
    imap_connection_failure: { enabled: boolean };
    database_issues: { enabled: boolean };
    rate_limit_exceeded: { enabled: boolean; threshold?: number };
  };
  cooldown_minutes: number;
}

interface AlertLog {
  id: string;
  alert_type: string;
  message: string;
  details: any;
  sent_to: string[];
  sent_at: string;
}

const defaultSettings: AlertSettings = {
  enabled: false,
  admin_emails: [],
  alerts: {
    health_check_failure: { enabled: true, threshold: 1 },
    dns_verification_failure: { enabled: true },
    smtp_connection_failure: { enabled: true },
    imap_connection_failure: { enabled: true },
    database_issues: { enabled: true },
    rate_limit_exceeded: { enabled: false, threshold: 100 },
  },
  cooldown_minutes: 60,
};

const alertTypeLabels: Record<string, { name: string; description: string; icon: typeof Bell }> = {
  health_check_failure: {
    name: "Health Check Failures",
    description: "Alert when deployment health checks detect critical issues",
    icon: AlertTriangle,
  },
  dns_verification_failure: {
    name: "DNS Verification Failures",
    description: "Alert when domain DNS records fail verification",
    icon: XCircle,
  },
  smtp_connection_failure: {
    name: "SMTP Connection Failures",
    description: "Alert when outgoing email server connections fail",
    icon: Mail,
  },
  imap_connection_failure: {
    name: "IMAP Connection Failures",
    description: "Alert when incoming email server connections fail",
    icon: Mail,
  },
  database_issues: {
    name: "Database Issues",
    description: "Alert when database connectivity or table issues are detected",
    icon: AlertTriangle,
  },
  rate_limit_exceeded: {
    name: "Rate Limit Exceeded",
    description: "Alert when rate limits are hit frequently",
    icon: Clock,
  },
};

const AdminAlertSettings = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<AlertSettings>(defaultSettings);
  const [emailInput, setEmailInput] = useState("");

  // Fetch alert settings
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['admin', 'alert-settings'],
    queryFn: async () => {
      const { data, error } = await api.admin.getSettings('alert_settings');
      if (error) throw new Error(error.message);
      return data?.value || defaultSettings;
    },
  });

  // Fetch alert logs
  const { data: alertLogsData = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['admin', 'alert-logs'],
    queryFn: async () => {
      const { data, error } = await api.db.query('alert_logs', {
        order: { column: 'sent_at', ascending: false },
        limit: 50,
      });
      if (error) return [];
      return (data || []) as AlertLog[];
    },
  });

  const alertLogs: AlertLog[] = alertLogsData as AlertLog[];

  useEffect(() => {
    if (settingsData) {
      setSettings({ ...defaultSettings, ...settingsData });
    }
  }, [settingsData]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: AlertSettings) => {
      const { error } = await api.admin.saveSettings('alert_settings', newSettings);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'alert-settings'] });
      toast.success("Alert settings saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save settings");
    },
  });

  // Test alert mutation
  const testAlertMutation = useMutation({
    mutationFn: async () => {
      const { error } = await api.functions.invoke('send-test-email', {
        body: {
          to: settings.admin_emails[0],
          subject: '[Test] TempMail Alert System',
          body: 'This is a test alert from your TempMail installation. If you received this, your alert system is working correctly.',
        },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Test alert sent");
      refetchLogs();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send test alert");
    },
  });

  const handleAddEmail = () => {
    if (!emailInput.trim()) return;
    const email = emailInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (settings.admin_emails.includes(email)) {
      toast.error("Email already added");
      return;
    }
    setSettings(prev => ({
      ...prev,
      admin_emails: [...prev.admin_emails, email],
    }));
    setEmailInput("");
  };

  const handleRemoveEmail = (email: string) => {
    setSettings(prev => ({
      ...prev,
      admin_emails: prev.admin_emails.filter(e => e !== email),
    }));
  };

  const handleToggleAlert = (alertType: keyof AlertSettings['alerts'], enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      alerts: {
        ...prev.alerts,
        [alertType]: { ...prev.alerts[alertType], enabled },
      },
    }));
  };

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Alert Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure automated email alerts for system issues
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => testAlertMutation.mutate()}
            disabled={testAlertMutation.isPending || settings.admin_emails.length === 0}
          >
            <Send className="w-4 h-4 mr-2" />
            Test Alert
          </Button>
          <Button
            variant="neon"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="history">Alert History</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          {/* Master Toggle */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    settings.enabled ? "bg-primary/20" : "bg-secondary"
                  }`}>
                    <Bell className={`w-5 h-5 ${settings.enabled ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">Email Alerts</CardTitle>
                    <CardDescription>
                      Enable or disable all automated email alerts
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(enabled) => setSettings(prev => ({ ...prev, enabled }))}
                />
              </div>
            </CardHeader>
          </Card>

          {/* Admin Emails */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Admin Email Addresses
              </CardTitle>
              <CardDescription>
                Alerts will be sent to these email addresses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="admin@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleAddEmail}>
                  Add
                </Button>
              </div>

              {settings.admin_emails.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {settings.admin_emails.map((email) => (
                    <Badge
                      key={email}
                      variant="secondary"
                      className="flex items-center gap-1 px-3 py-1"
                    >
                      {email}
                      <button
                        onClick={() => handleRemoveEmail(email)}
                        className="ml-1 hover:text-destructive"
                      >
                        <XCircle className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No email addresses configured
                </p>
              )}
            </CardContent>
          </Card>

          {/* Alert Types */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alert Types</CardTitle>
              <CardDescription>
                Choose which types of issues should trigger alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(alertTypeLabels).map(([key, info]) => {
                const alertKey = key as keyof AlertSettings['alerts'];
                const alertConfig = settings.alerts[alertKey];
                const Icon = info.icon;

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{info.name}</p>
                        <p className="text-xs text-muted-foreground">{info.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={alertConfig.enabled}
                      onCheckedChange={(enabled) => handleToggleAlert(alertKey, enabled)}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Cooldown Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Alert Cooldown
              </CardTitle>
              <CardDescription>
                Prevent duplicate alerts by setting a minimum time between alerts of the same type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Label>Cooldown Period</Label>
                <Input
                  type="number"
                  value={settings.cooldown_minutes}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    cooldown_minutes: parseInt(e.target.value) || 60,
                  }))}
                  className="w-24"
                  min={1}
                  max={1440}
                />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Recent Alerts</h3>
            <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {logsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : alertLogs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No alerts have been sent yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {alertLogs.map((log: AlertLog) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {alertTypeLabels[log.alert_type]?.name || log.alert_type}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {log.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {new Date(log.sent_at).toLocaleString()}
                          </Badge>
                          {log.sent_to?.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Sent to {log.sent_to.length} recipient(s)
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAlertSettings;
