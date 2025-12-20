import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Activity, 
  Save, 
  RefreshCw, 
  Mail, 
  Send, 
  Server, 
  Zap,
  CheckCircle2,
  AlertCircle,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ServiceOverride {
  enabled: boolean;
  status: "operational" | "degraded" | "down";
  message?: string;
}

interface StatusOverrides {
  imap: ServiceOverride;
  smtp: ServiceOverride;
  database: ServiceOverride;
  realtime: ServiceOverride;
  globalMessage?: string;
  showGlobalMessage: boolean;
}

const defaultOverrides: StatusOverrides = {
  imap: { enabled: false, status: "operational" },
  smtp: { enabled: false, status: "operational" },
  database: { enabled: false, status: "operational" },
  realtime: { enabled: false, status: "operational" },
  globalMessage: "",
  showGlobalMessage: false
};

const services = [
  { key: "imap", name: "IMAP (Email Receiving)", icon: Mail, description: "Incoming email processing" },
  { key: "smtp", name: "SMTP (Email Sending)", icon: Send, description: "Outgoing email delivery" },
  { key: "database", name: "Database", icon: Server, description: "Data storage & retrieval" },
  { key: "realtime", name: "Real-time", icon: Zap, description: "Live updates & notifications" },
];

const statusOptions = [
  { value: "operational", label: "Operational", color: "text-emerald-500", icon: CheckCircle2 },
  { value: "degraded", label: "Degraded", color: "text-amber-500", icon: AlertCircle },
  { value: "down", label: "Down", color: "text-red-500", icon: XCircle },
];

const AdminStatusSettings = () => {
  const [overrides, setOverrides] = useState<StatusOverrides>(defaultOverrides);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "status_overrides")
        .single();

      if (data && !error) {
        const parsed = data.value as unknown as StatusOverrides;
        setOverrides({ ...defaultOverrides, ...parsed });
      }
    } catch (error) {
      console.error("Error loading status settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Check if setting exists
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "status_overrides")
        .single();

      if (existing) {
        // Update
        const { error } = await supabase
          .from("app_settings")
          .update({
            value: JSON.parse(JSON.stringify(overrides)),
            updated_at: new Date().toISOString()
          })
          .eq("key", "status_overrides");

        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("app_settings")
          .insert([{
            key: "status_overrides",
            value: JSON.parse(JSON.stringify(overrides)),
            updated_at: new Date().toISOString()
          }]);

        if (error) throw error;
      }

      toast({
        title: "Settings Saved",
        description: "Status overrides have been updated successfully.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateService = (key: string, field: string, value: unknown) => {
    setOverrides(prev => ({
      ...prev,
      [key]: {
        ...prev[key as keyof typeof prev] as ServiceOverride,
        [field]: value
      }
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational": return "bg-emerald-500/10 border-emerald-500/30 text-emerald-500";
      case "degraded": return "bg-amber-500/10 border-amber-500/30 text-amber-500";
      case "down": return "bg-red-500/10 border-red-500/30 text-red-500";
      default: return "bg-muted border-border text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Status Page Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manually override service status displayed on the public status page
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>

      {/* Global Message */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Global Status Message</CardTitle>
          <CardDescription>
            Display a custom message at the top of the status page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="show-global-message">Show Global Message</Label>
            <Switch
              id="show-global-message"
              checked={overrides.showGlobalMessage}
              onCheckedChange={(checked) => setOverrides(prev => ({ ...prev, showGlobalMessage: checked }))}
            />
          </div>
          {overrides.showGlobalMessage && (
            <div className="space-y-2">
              <Label htmlFor="global-message">Message</Label>
              <Textarea
                id="global-message"
                placeholder="e.g., Scheduled maintenance on Dec 25th from 2:00 AM - 4:00 AM UTC"
                value={overrides.globalMessage || ""}
                onChange={(e) => setOverrides(prev => ({ ...prev, globalMessage: e.target.value }))}
                className="min-h-[80px]"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Overrides */}
      <div className="grid gap-4">
        {services.map((service) => {
          const serviceOverride = overrides[service.key as keyof StatusOverrides] as ServiceOverride;
          const Icon = service.icon;
          
          return (
            <motion.div
              key={service.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className={serviceOverride.enabled ? "border-primary/30" : ""}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Service Info */}
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${serviceOverride.enabled ? getStatusColor(serviceOverride.status) : "bg-muted"}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{service.name}</h3>
                        <p className="text-xs text-muted-foreground">{service.description}</p>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`${service.key}-override`} className="text-sm whitespace-nowrap">Manual Override</Label>
                        <Switch
                          id={`${service.key}-override`}
                          checked={serviceOverride.enabled}
                          onCheckedChange={(checked) => updateService(service.key, "enabled", checked)}
                        />
                      </div>

                      {serviceOverride.enabled && (
                        <Select
                          value={serviceOverride.status}
                          onValueChange={(value) => updateService(service.key, "status", value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((option) => {
                              const StatusIcon = option.icon;
                              return (
                                <SelectItem key={option.value} value={option.value}>
                                  <div className="flex items-center gap-2">
                                    <StatusIcon className={`w-4 h-4 ${option.color}`} />
                                    {option.label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>

                  {/* Custom message for this service */}
                  {serviceOverride.enabled && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <Label htmlFor={`${service.key}-message`} className="text-sm">Custom Message (Optional)</Label>
                      <Textarea
                        id={`${service.key}-message`}
                        placeholder="e.g., We are investigating issues with email delivery"
                        value={serviceOverride.message || ""}
                        onChange={(e) => updateService(service.key, "message", e.target.value)}
                        className="mt-2 min-h-[60px]"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Info */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">How Overrides Work</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>When a manual override is enabled, it replaces the automatic status check</li>
                <li>Automatic monitoring will resume once you disable the override</li>
                <li>Use this during planned maintenance or known outages</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStatusSettings;