import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Database, Trash2, RefreshCw, Clock, Settings, Zap, HardDrive, Mail, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
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

interface CacheSettings {
  autoDeleteEnabled: boolean;
  autoDeleteHours: number;
  maxEmailsPerAddress: number;
  maxAttachmentSize: number;
}

const AdminCache = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalEmails: 0,
    totalAttachments: 0,
    storageUsed: "0 MB",
    oldestEmail: "-",
  });
  const [settings, setSettings] = useState<CacheSettings>({
    autoDeleteEnabled: true,
    autoDeleteHours: 48,
    maxEmailsPerAddress: 100,
    maxAttachmentSize: 10,
  });

  useEffect(() => {
    fetchStats();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await api.db.query<{value: CacheSettings}>("app_settings", {
        select: "value",
        eq: { key: "cache_settings" },
        single: true
      });
      
      if (data?.value) {
        setSettings(data.value);
      }
    } catch (error) {
      console.log("Using default cache settings");
    }
  };

  const saveSettings = async () => {
    try {
      const settingsValue = JSON.parse(JSON.stringify(settings));

      const { error } = await api.db.upsert("app_settings", {
        key: "cache_settings",
        value: settingsValue,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

      if (error) throw error;
      
      toast.success("Cache settings saved");
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  const fetchStats = async () => {
    try {
      // Get email count
      const { data: emailData } = await api.db.query<{id: string}[]>("received_emails", {
        select: "id",
        limit: 10000
      });
      const emailCount = emailData?.length || 0;

      // Get attachment count
      const { data: attachmentData } = await api.db.query<{id: string}[]>("email_attachments", {
        select: "id",
        limit: 10000
      });
      const attachmentCount = attachmentData?.length || 0;

      // Get oldest email
      const { data: oldestData } = await api.db.query<{received_at: string}>("received_emails", {
        select: "received_at",
        order: { column: "received_at", ascending: true },
        limit: 1,
        single: true
      });

      // Get total attachment size
      const { data: sizeData } = await api.db.query<{file_size: number}[]>("email_attachments", {
        select: "file_size"
      });

      const totalSize = sizeData?.reduce((acc, item) => acc + (item.file_size || 0), 0) || 0;
      const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);

      setStats({
        totalEmails: emailCount,
        totalAttachments: attachmentCount,
        storageUsed: `${sizeInMB} MB`,
        oldestEmail: oldestData?.received_at 
          ? new Date(oldestData.received_at).toLocaleDateString() 
          : "-",
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const clearOldEmails = async (hours: number) => {
    setIsLoading(true);
    try {
      // Use API to run cleanup
      const { data, error } = await api.functions.invoke<{message?: string}>('auto-delete-emails', {
        body: { hours }
      });

      if (error) throw error;

      toast.success(data?.message || `Cleanup completed`);
      fetchStats();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error("Failed to clear emails: " + message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllEmails = async () => {
    setIsLoading(true);
    try {
      // Use API to clear all
      const { error } = await api.functions.invoke('auto-delete-emails', {
        body: { clearAll: true }
      });

      if (error) throw error;

      toast.success("All emails and attachments cleared");
      fetchStats();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error("Failed to clear all data: " + message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearExpiredTempEmails = async () => {
    setIsLoading(true);
    try {
      // Use API to clear expired
      const { data, error } = await api.functions.invoke<{message?: string}>('auto-delete-emails', {
        body: { expiredOnly: true }
      });

      if (error) throw error;

      toast.success(data?.message || "Expired temp emails cleared");
      fetchStats();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error("Failed to clear expired emails: " + message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLocalCache = () => {
    try {
      // Clear specific localStorage items related to cache
      const keysToKeep = ['trashmails_user', 'trashmails_theme', 'trashmails_language'];
      const allKeys = Object.keys(localStorage);
      
      allKeys.forEach(key => {
        if (key.startsWith('trashmails_') && !keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      toast.success("Local cache cleared");
    } catch (error) {
      toast.error("Failed to clear local cache");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="w-8 h-8 text-primary" />
            Cache & Cleanup
          </h1>
          <p className="text-muted-foreground">Manage data retention and cleanup settings</p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchStats}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalEmails}</p>
                <p className="text-sm text-muted-foreground">Total Emails</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-accent/10">
                <HardDrive className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalAttachments}</p>
                <p className="text-sm text-muted-foreground">Attachments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Database className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.storageUsed}</p>
                <p className="text-sm text-muted-foreground">Storage Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.oldestEmail}</p>
                <p className="text-sm text-muted-foreground">Oldest Email</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auto-Delete Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Auto-Delete Settings
          </CardTitle>
          <CardDescription>
            Configure automatic cleanup of old emails and data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Enable Auto-Delete</Label>
              <p className="text-sm text-muted-foreground">
                Automatically delete emails older than the specified time
              </p>
            </div>
            <Switch
              checked={settings.autoDeleteEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, autoDeleteEnabled: checked })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Delete After (hours)</Label>
              <Input
                type="number"
                value={settings.autoDeleteHours}
                onChange={(e) => setSettings({ ...settings, autoDeleteHours: parseInt(e.target.value) || 48 })}
                min={1}
                max={720}
              />
              <p className="text-xs text-muted-foreground">Default: 48 hours</p>
            </div>
            <div className="space-y-2">
              <Label>Max Emails Per Address</Label>
              <Input
                type="number"
                value={settings.maxEmailsPerAddress}
                onChange={(e) => setSettings({ ...settings, maxEmailsPerAddress: parseInt(e.target.value) || 100 })}
                min={10}
                max={1000}
              />
              <p className="text-xs text-muted-foreground">Oldest deleted first</p>
            </div>
            <div className="space-y-2">
              <Label>Max Attachment Size (MB)</Label>
              <Input
                type="number"
                value={settings.maxAttachmentSize}
                onChange={(e) => setSettings({ ...settings, maxAttachmentSize: parseInt(e.target.value) || 10 })}
                min={1}
                max={50}
              />
              <p className="text-xs text-muted-foreground">Per file limit</p>
            </div>
          </div>

          <Button onClick={saveSettings} variant="neon">
            <Settings className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Manual Cleanup Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Manual Cleanup Actions
          </CardTitle>
          <CardDescription>
            Perform immediate cleanup operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-500" />
                <span className="font-medium">Clear Old Emails (48h)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Delete all emails and attachments older than 48 hours
              </p>
              <Button 
                variant="outline" 
                onClick={() => clearOldEmails(48)}
                disabled={isLoading}
              >
                {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Clear 48h+ Emails
              </Button>
            </div>

            <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                <span className="font-medium">Clear Expired Temp Emails</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Delete all expired temporary email addresses and their data
              </p>
              <Button 
                variant="outline" 
                onClick={clearExpiredTempEmails}
                disabled={isLoading}
              >
                {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Clear Expired
              </Button>
            </div>

            <div className="p-4 bg-secondary/30 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-blue-500" />
                <span className="font-medium">Clear Local Cache</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Clear browser localStorage cache (keeps user preferences)
              </p>
              <Button 
                variant="outline" 
                onClick={clearLocalCache}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Clear Local Cache
              </Button>
            </div>

            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <span className="font-medium text-destructive">Clear All Data</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Delete ALL emails and attachments. This cannot be undone!
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isLoading}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete ALL received emails and their attachments.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground"
                      onClick={clearAllEmails}
                    >
                      Delete Everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCache;
