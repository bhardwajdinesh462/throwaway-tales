import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Gauge, Save, RefreshCw, Trash2, RotateCcw, AlertTriangle, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const [resetOnSave, setResetOnSave] = useState(true);
  const [isResettingAll, setIsResettingAll] = useState(false);

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
      setIsSaving(false);
      return;
    }

    // Reset all rate limits if option is enabled
    if (resetOnSave) {
      const { error: clearError } = await supabase
        .from("rate_limits")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      
      if (clearError) {
        toast.error("Settings saved but failed to reset limits: " + clearError.message);
      } else {
        toast.success("Rate limit settings saved and all limits reset!");
        loadRateLimits();
      }
    } else {
      toast.success("Rate limit settings saved!");
    }
    
    setIsSaving(false);
  };

  const clearAllRateLimits = async () => {
    setIsResettingAll(true);
    const { data, error } = await supabase
      .from("rate_limits")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000")
      .select();

    if (error) {
      toast.error("Failed to clear rate limits: " + error.message);
    } else {
      const count = data?.length || 0;
      toast.success(`All rate limits cleared! ${count} record(s) removed. All users can now create emails again.`);
      loadRateLimits();
    }
    setIsResettingAll(false);
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

      {/* Prominent Reset All Rate Limits Card */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Users className="w-5 h-5" />
            Reset All User Rate Limits
          </CardTitle>
          <CardDescription>
            Instantly clear all rate limit restrictions for all users, moderators, and admins
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                This will immediately allow all users who have been rate-limited to create emails again. 
                Use this if users are reporting they cannot create new emails due to rate limits.
              </p>
              <p className="text-sm font-medium mt-2">
                Currently tracking: <span className="text-primary">{rateLimits.length} active rate limit record(s)</span>
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="lg" 
                  className="shrink-0"
                  disabled={isResettingAll || rateLimits.length === 0}
                >
                  {isResettingAll ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset All Rate Limits
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Reset All Rate Limits?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately clear all {rateLimits.length} rate limit record(s). 
                    All users, moderators, and admins will be able to create emails again without restriction.
                    <br /><br />
                    This action cannot be undone, but rate limits will naturally rebuild as users create new emails.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllRateLimits} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Yes, Reset All Limits
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

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
            <div className="pt-4 p-4 bg-secondary/30 rounded-lg space-y-3">
              <p className="text-sm">
                <strong>Current Setting:</strong> {settings.max_requests} emails per {settings.window_minutes} minutes per user/IP
              </p>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resetOnSave"
                  checked={resetOnSave}
                  onCheckedChange={(checked) => setResetOnSave(checked === true)}
                />
                <label
                  htmlFor="resetOnSave"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset all rate limits on save
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                When enabled, saving settings will clear all existing rate limit records, allowing blocked users to immediately create emails again.
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