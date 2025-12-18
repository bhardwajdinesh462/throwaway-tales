import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Gauge, Save, RefreshCw, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

interface RateLimitSettings {
  max_requests: number;
  window_minutes: number;
}

interface RateLimitRecord {
  id: string;
  identifier: string;
  action_type: string;
  request_count: number;
  window_start: string;
}

const AdminRateLimits = () => {
  const [settings, setSettings] = useState<RateLimitSettings>({
    max_requests: 10,
    window_minutes: 60,
  });
  const [rateLimits, setRateLimits] = useState<RateLimitRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
    loadRateLimits();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "rate_limit_temp_email_create")
      .single();

    if (!error && data?.value && typeof data.value === 'object' && !Array.isArray(data.value)) {
      const value = data.value as Record<string, unknown>;
      setSettings({
        max_requests: typeof value.max_requests === 'number' ? value.max_requests : 10,
        window_minutes: typeof value.window_minutes === 'number' ? value.window_minutes : 60,
      });
    }
    setIsLoading(false);
  };

  const loadRateLimits = async () => {
    const { data, error } = await supabase
      .from("rate_limits")
      .select("*")
      .order("window_start", { ascending: false })
      .limit(50);

    if (!error && data) {
      setRateLimits(data);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    
    // First check if record exists
    const { data: existing } = await supabase
      .from("app_settings")
      .select("id")
      .eq("key", "rate_limit_temp_email_create")
      .single();

    let error;
    const jsonValue = { max_requests: settings.max_requests, window_minutes: settings.window_minutes };
    
    if (existing) {
      const result = await supabase
        .from("app_settings")
        .update({ value: jsonValue, updated_at: new Date().toISOString() })
        .eq("key", "rate_limit_temp_email_create");
      error = result.error;
    } else {
      const result = await supabase
        .from("app_settings")
        .insert([{ key: "rate_limit_temp_email_create", value: jsonValue }]);
      error = result.error;
    }

    if (error) {
      toast.error("Failed to save settings: " + error.message);
    } else {
      toast.success("Rate limit settings saved!");
    }
    setIsSaving(false);
  };

  const clearAllRateLimits = async () => {
    const { error } = await supabase
      .from("rate_limits")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

    if (error) {
      toast.error("Failed to clear rate limits: " + error.message);
    } else {
      toast.success("All rate limits cleared!");
      loadRateLimits();
    }
  };

  const clearOldRateLimits = async () => {
    const { error } = await supabase.rpc("cleanup_old_rate_limits");

    if (error) {
      toast.error("Failed to cleanup: " + error.message);
    } else {
      toast.success("Old rate limits cleaned up!");
      loadRateLimits();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gauge className="w-8 h-8 text-primary" />
            Rate Limits
          </h1>
          <p className="text-muted-foreground">Configure rate limiting for temp email creation</p>
        </div>
        <Button onClick={saveSettings} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Temp Email Creation Limits</CardTitle>
            <CardDescription>
              Control how many temp emails can be created per user/IP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max_requests">Max Requests</Label>
              <Input
                id="max_requests"
                type="number"
                min={1}
                max={1000}
                value={settings.max_requests}
                onChange={(e) => setSettings({ ...settings, max_requests: parseInt(e.target.value) || 10 })}
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of temp emails a user/IP can create within the time window
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="window_minutes">Time Window (minutes)</Label>
              <Input
                id="window_minutes"
                type="number"
                min={1}
                max={1440}
                value={settings.window_minutes}
                onChange={(e) => setSettings({ ...settings, window_minutes: parseInt(e.target.value) || 60 })}
              />
              <p className="text-xs text-muted-foreground">
                Time period in minutes for the rate limit window
              </p>
            </div>
            <div className="pt-4 p-4 bg-secondary/30 rounded-lg">
              <p className="text-sm">
                <strong>Current Setting:</strong> {settings.max_requests} emails per {settings.window_minutes} minutes per user/IP
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rate Limit Management</CardTitle>
            <CardDescription>
              View and manage current rate limit records
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadRateLimits}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" onClick={clearOldRateLimits}>
                Clean Old Records
              </Button>
              <Button variant="destructive" onClick={clearAllRateLimits}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {rateLimits.length} active rate limit record(s)
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Rate Limits</CardTitle>
          <CardDescription>Current rate limit tracking records</CardDescription>
        </CardHeader>
        <CardContent>
          {rateLimits.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No active rate limits</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identifier</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Request Count</TableHead>
                  <TableHead>Window Start</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateLimits.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">
                      {record.identifier}
                    </TableCell>
                    <TableCell>{record.action_type}</TableCell>
                    <TableCell>
                      <span className={record.request_count >= settings.max_requests ? "text-destructive font-bold" : ""}>
                        {record.request_count}
                      </span>
                      <span className="text-muted-foreground"> / {settings.max_requests}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(record.window_start), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRateLimits;