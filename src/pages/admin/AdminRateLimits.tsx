import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Gauge, Save, RefreshCw, Trash2, RotateCcw, AlertTriangle, Users, User } from "lucide-react";
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
  guest_max_requests: number;
  guest_window_minutes: number;
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
    max_requests: 30,
    window_minutes: 60,
    guest_max_requests: 10,
    guest_window_minutes: 60,
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
        max_requests: typeof value.max_requests === 'number' ? value.max_requests : 30,
        window_minutes: typeof value.window_minutes === 'number' ? value.window_minutes : 60,
        guest_max_requests: typeof value.guest_max_requests === 'number' ? value.guest_max_requests : 10,
        guest_window_minutes: typeof value.guest_window_minutes === 'number' ? value.guest_window_minutes : 60,
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
    const jsonValue = { 
      max_requests: settings.max_requests, 
      window_minutes: settings.window_minutes,
      guest_max_requests: settings.guest_max_requests,
      guest_window_minutes: settings.guest_window_minutes,
    };
    
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

      {/* What is Rate Limiting Explanation */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            What is Rate Limiting?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <strong>Rate limiting</strong> prevents abuse by restricting how many emails a user or guest can create within a time window. 
            This protects your service from spam, bots, and excessive resource usage.
          </p>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-background rounded-lg border">
              <p className="font-medium mb-1">🔐 Registered Users</p>
              <p className="text-muted-foreground">Tracked by their user ID. Higher limits recommended for trusted users.</p>
            </div>
            <div className="p-3 bg-background rounded-lg border">
              <p className="font-medium mb-1">👤 Guest Users</p>
              <p className="text-muted-foreground">Tracked by device fingerprint (localStorage). Lower limits to prevent abuse.</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Changes apply in real-time. When you save settings, all connected clients will automatically use the new limits.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Registered Users Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Registered User Limits
            </CardTitle>
            <CardDescription>
              Rate limits for logged-in users (tracked by user ID)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max_requests">Max Emails</Label>
              <Input
                id="max_requests"
                type="number"
                min={1}
                max={1000}
                value={settings.max_requests}
                onChange={(e) => setSettings({ ...settings, max_requests: parseInt(e.target.value) || 30 })}
              />
              <p className="text-xs text-muted-foreground">
                Maximum temp emails a registered user can create
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
                Time period for the rate limit window
              </p>
            </div>
            <div className="p-3 bg-secondary/30 rounded-lg">
              <p className="text-sm font-medium">
                ✅ {settings.max_requests} emails per {settings.window_minutes} min
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Guest Users Settings */}
        <Card className="border-orange-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <Users className="w-5 h-5" />
              Guest User Limits
            </CardTitle>
            <CardDescription>
              Rate limits for anonymous/guest users (tracked by device ID)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guest_max_requests">Max Emails</Label>
              <Input
                id="guest_max_requests"
                type="number"
                min={1}
                max={100}
                value={settings.guest_max_requests}
                onChange={(e) => setSettings({ ...settings, guest_max_requests: parseInt(e.target.value) || 10 })}
              />
              <p className="text-xs text-muted-foreground">
                Maximum temp emails a guest can create (keep lower to prevent abuse)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest_window_minutes">Time Window (minutes)</Label>
              <Input
                id="guest_window_minutes"
                type="number"
                min={1}
                max={1440}
                value={settings.guest_window_minutes}
                onChange={(e) => setSettings({ ...settings, guest_window_minutes: parseInt(e.target.value) || 60 })}
              />
              <p className="text-xs text-muted-foreground">
                Time period for the guest rate limit window
              </p>
            </div>
            <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
              <p className="text-sm font-medium text-orange-600">
                ⚠️ {settings.guest_max_requests} emails per {settings.guest_window_minutes} min
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Guest users are not logged in and may include bots
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Options */}
      <Card>
        <CardHeader>
          <CardTitle>Save Options</CardTitle>
        </CardHeader>
        <CardContent>
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
              Reset all rate limits on save (recommended when increasing limits)
            </label>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            When enabled, saving will clear all existing rate limit records, immediately allowing all blocked users to create emails again.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rate Limit Management</CardTitle>
            <CardDescription>
              View and manage current rate limit records
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
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