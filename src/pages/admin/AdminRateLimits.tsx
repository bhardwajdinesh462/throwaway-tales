import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Gauge, Save, RefreshCw, Trash2, RotateCcw, AlertTriangle, Users, User, Mail, LogIn, UserPlus, Key, Globe } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface ActionRateLimitSettings {
  max_requests: number;
  window_minutes: number;
  guest_max_requests: number;
  guest_window_minutes: number;
}

interface RateLimitsConfig {
  email_create: ActionRateLimitSettings;
  login: ActionRateLimitSettings;
  signup: ActionRateLimitSettings;
  password_reset: ActionRateLimitSettings;
  api: ActionRateLimitSettings;
}

interface RateLimitRecord {
  id: string;
  identifier: string;
  action_type: string;
  request_count: number;
  window_start: string;
}

const defaultActionSettings: ActionRateLimitSettings = {
  max_requests: 30,
  window_minutes: 60,
  guest_max_requests: 10,
  guest_window_minutes: 60,
};

const defaultConfig: RateLimitsConfig = {
  email_create: { max_requests: 30, window_minutes: 60, guest_max_requests: 10, guest_window_minutes: 60 },
  login: { max_requests: 5, window_minutes: 15, guest_max_requests: 5, guest_window_minutes: 15 },
  signup: { max_requests: 3, window_minutes: 60, guest_max_requests: 3, guest_window_minutes: 60 },
  password_reset: { max_requests: 3, window_minutes: 60, guest_max_requests: 3, guest_window_minutes: 60 },
  api: { max_requests: 100, window_minutes: 60, guest_max_requests: 20, guest_window_minutes: 60 },
};

const actionTabs = [
  { key: 'email_create', label: 'Email Creation', icon: Mail, description: 'Limit temp email creation' },
  { key: 'login', label: 'Login Attempts', icon: LogIn, description: 'Limit login attempts to prevent brute force' },
  { key: 'signup', label: 'Signup Attempts', icon: UserPlus, description: 'Limit account creation' },
  { key: 'password_reset', label: 'Password Reset', icon: Key, description: 'Limit password reset requests' },
  { key: 'api', label: 'API Requests', icon: Globe, description: 'Limit API access' },
];

const AdminRateLimits = () => {
  const [config, setConfig] = useState<RateLimitsConfig>(defaultConfig);
  const [rateLimits, setRateLimits] = useState<RateLimitRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [resetOnSave, setResetOnSave] = useState(true);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [activeTab, setActiveTab] = useState('email_create');

  useEffect(() => {
    loadSettings();
    loadRateLimits();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "rate_limits_config")
      .single();

    if (!error && data?.value && typeof data.value === 'object' && !Array.isArray(data.value)) {
      const value = data.value as Record<string, unknown>;
      setConfig({
        email_create: parseActionSettings(value.email_create, defaultConfig.email_create),
        login: parseActionSettings(value.login, defaultConfig.login),
        signup: parseActionSettings(value.signup, defaultConfig.signup),
        password_reset: parseActionSettings(value.password_reset, defaultConfig.password_reset),
        api: parseActionSettings(value.api, defaultConfig.api),
      });
    }
    setIsLoading(false);
  };

  const parseActionSettings = (value: unknown, defaults: ActionRateLimitSettings): ActionRateLimitSettings => {
    if (!value || typeof value !== 'object') return defaults;
    const v = value as Record<string, unknown>;
    return {
      max_requests: typeof v.max_requests === 'number' ? v.max_requests : defaults.max_requests,
      window_minutes: typeof v.window_minutes === 'number' ? v.window_minutes : defaults.window_minutes,
      guest_max_requests: typeof v.guest_max_requests === 'number' ? v.guest_max_requests : defaults.guest_max_requests,
      guest_window_minutes: typeof v.guest_window_minutes === 'number' ? v.guest_window_minutes : defaults.guest_window_minutes,
    };
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

  const updateActionSettings = (actionKey: keyof RateLimitsConfig, field: keyof ActionRateLimitSettings, value: number) => {
    setConfig(prev => ({
      ...prev,
      [actionKey]: {
        ...prev[actionKey],
        [field]: value
      }
    }));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    
    // First check if record exists
    const { data: existing } = await supabase
      .from("app_settings")
      .select("id")
      .eq("key", "rate_limits_config")
      .single();

    let error;
    const jsonValue = JSON.parse(JSON.stringify(config));
    
    if (existing) {
      const result = await supabase
        .from("app_settings")
        .update({ value: jsonValue, updated_at: new Date().toISOString() })
        .eq("key", "rate_limits_config");
      error = result.error;
    } else {
      const result = await supabase
        .from("app_settings")
        .insert([{ key: "rate_limits_config", value: jsonValue }]);
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
      toast.success(`All rate limits cleared! ${count} record(s) removed.`);
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

  const renderActionSettings = (actionKey: keyof RateLimitsConfig) => {
    const settings = config[actionKey];
    const tabInfo = actionTabs.find(t => t.key === actionKey);
    
    return (
      <div className="space-y-6">
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
                <Label>Max Requests</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={settings.max_requests}
                  onChange={(e) => updateActionSettings(actionKey, 'max_requests', parseInt(e.target.value) || 1)}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum {tabInfo?.label.toLowerCase()} per time window
                </p>
              </div>
              <div className="space-y-2">
                <Label>Time Window (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={settings.window_minutes}
                  onChange={(e) => updateActionSettings(actionKey, 'window_minutes', parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="p-3 bg-secondary/30 rounded-lg">
                <p className="text-sm font-medium">
                  ✅ {settings.max_requests} requests per {settings.window_minutes} min
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
                Rate limits for anonymous users (tracked by device ID)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Max Requests</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={settings.guest_max_requests}
                  onChange={(e) => updateActionSettings(actionKey, 'guest_max_requests', parseInt(e.target.value) || 1)}
                />
                <p className="text-xs text-muted-foreground">
                  Keep lower to prevent abuse from anonymous users
                </p>
              </div>
              <div className="space-y-2">
                <Label>Time Window (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={settings.guest_window_minutes}
                  onChange={(e) => updateActionSettings(actionKey, 'guest_window_minutes', parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
                <p className="text-sm font-medium text-orange-600">
                  ⚠️ {settings.guest_max_requests} requests per {settings.guest_window_minutes} min
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Gauge className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            Rate Limits
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">Configure rate limiting for all actions</p>
        </div>
        <Button onClick={saveSettings} disabled={isSaving} className="w-full sm:w-auto">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save All Settings"}
        </Button>
      </div>

      {/* Prominent Reset All Rate Limits Card */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-destructive text-lg sm:text-xl">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            Reset All User Rate Limits
          </CardTitle>
          <CardDescription className="text-sm">
            Instantly clear all rate limit restrictions for all users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-muted-foreground">
                This will immediately allow all rate-limited users to perform actions again. 
              </p>
              <p className="text-sm font-medium mt-2">
                Currently tracking: <span className="text-primary">{rateLimits.length} active record(s)</span>
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="lg" 
                  className="w-full sm:w-auto"
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
              <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Reset All Rate Limits?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately clear all {rateLimits.length} rate limit record(s). 
                    All users will be able to perform actions again without restriction.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllRateLimits} className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Yes, Reset All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limit Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Configure Rate Limits by Action</CardTitle>
          <CardDescription>
            Set different limits for each type of action
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 sm:grid-cols-5 mb-6">
              {actionTabs.map(tab => (
                <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-1 text-xs sm:text-sm">
                  <tab.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            
            {actionTabs.map(tab => (
              <TabsContent key={tab.key} value={tab.key}>
                <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">{tab.description}</p>
                </div>
                {renderActionSettings(tab.key as keyof RateLimitsConfig)}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

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
            When enabled, saving will clear all existing rate limit records, immediately allowing all blocked users to perform actions again.
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">Active Rate Limits</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Current rate limit tracking records</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {rateLimits.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No active rate limits</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Identifier</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Count</TableHead>
                    <TableHead className="text-xs">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rateLimits.map((limit) => (
                    <TableRow key={limit.id}>
                      <TableCell className="text-xs font-mono">
                        {limit.identifier.length > 20 
                          ? `${limit.identifier.slice(0, 20)}...` 
                          : limit.identifier}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="px-2 py-1 bg-muted rounded text-xs">
                          {limit.action_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{limit.request_count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(limit.window_start), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRateLimits;
