import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Save, Shield, Database, Server, Lock, Key, 
  RefreshCw, Download, Upload, Clock, AlertTriangle,
  Eye, EyeOff, HardDrive, Zap, FileCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";

const AdminAdvancedSettings = () => {
  const [settings, setSettings] = useState({
    // Security
    twoFactorAuth: false,
    sessionTimeout: "30",
    maxLoginAttempts: "5",
    ipWhitelist: "",
    rateLimiting: true,
    rateLimitRequests: "100",
    rateLimitWindow: "60",
    encryptionKey: "",
    showEncryptionKey: false,
    
    // Backup
    autoBackup: true,
    backupFrequency: "daily",
    backupRetention: "30",
    lastBackup: "2024-01-15 14:30:00",
    backupLocation: "local",
    
    // System
    debugMode: false,
    logLevel: "info",
    maxUploadSize: "10",
    timezone: "UTC",
    dateFormat: "YYYY-MM-DD",
    maintenanceMode: false,
    maintenanceMessage: "We are currently performing maintenance. Please check back soon.",
    
    // Performance
    cacheEnabled: true,
    cacheDuration: "3600",
    compressionEnabled: true,
    lazyLoadImages: true,
    minifyAssets: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    localStorage.setItem("nullsto_advanced_settings", JSON.stringify(settings));
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success("Advanced settings saved successfully");
    setIsSaving(false);
  };

  const handleBackupNow = async () => {
    setIsBackingUp(true);
    setBackupProgress(0);
    
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setBackupProgress(i);
    }
    
    const backupData = {
      settings: localStorage.getItem("nullsto_settings"),
      users: localStorage.getItem("nullsto_users"),
      emails: localStorage.getItem("nullsto_emails"),
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nullsto_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    setIsBackingUp(false);
    toast.success("Backup created successfully");
  };

  const handleRestoreBackup = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          
          if (data.settings) localStorage.setItem("nullsto_settings", data.settings);
          if (data.users) localStorage.setItem("nullsto_users", data.users);
          if (data.emails) localStorage.setItem("nullsto_emails", data.emails);
          
          toast.success("Backup restored successfully. Please refresh the page.");
        } catch {
          toast.error("Invalid backup file");
        }
      }
    };
    input.click();
  };

  const generateEncryptionKey = () => {
    const key = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    setSettings({ ...settings, encryptionKey: key });
    toast.success("New encryption key generated");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Accordion type="multiple" defaultValue={["security", "backup", "system"]} className="space-y-4">
        {/* Security Settings */}
        <AccordionItem value="security" className="glass-card border-none">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <Shield className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Security Settings</h3>
                <p className="text-sm text-muted-foreground">Authentication, rate limiting, encryption</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">Require 2FA for admin access</p>
                  </div>
                  <Switch
                    checked={settings.twoFactorAuth}
                    onCheckedChange={(checked) => setSettings({ ...settings, twoFactorAuth: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">Rate Limiting</p>
                    <p className="text-sm text-muted-foreground">Prevent API abuse</p>
                  </div>
                  <Switch
                    checked={settings.rateLimiting}
                    onCheckedChange={(checked) => setSettings({ ...settings, rateLimiting: checked })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Session Timeout (minutes)</label>
                  <Input
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => setSettings({ ...settings, sessionTimeout: e.target.value })}
                    className="bg-secondary/50"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Max Login Attempts</label>
                  <Input
                    type="number"
                    value={settings.maxLoginAttempts}
                    onChange={(e) => setSettings({ ...settings, maxLoginAttempts: e.target.value })}
                    className="bg-secondary/50"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Rate Limit (req/min)</label>
                  <Input
                    type="number"
                    value={settings.rateLimitRequests}
                    onChange={(e) => setSettings({ ...settings, rateLimitRequests: e.target.value })}
                    className="bg-secondary/50"
                    disabled={!settings.rateLimiting}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">IP Whitelist (comma-separated)</label>
                <Textarea
                  value={settings.ipWhitelist}
                  onChange={(e) => setSettings({ ...settings, ipWhitelist: e.target.value })}
                  placeholder="192.168.1.1, 10.0.0.1"
                  className="bg-secondary/50"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Encryption Key</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={settings.showEncryptionKey ? "text" : "password"}
                      value={settings.encryptionKey}
                      onChange={(e) => setSettings({ ...settings, encryptionKey: e.target.value })}
                      className="bg-secondary/50 pr-10"
                      placeholder="Enter or generate encryption key"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => setSettings({ ...settings, showEncryptionKey: !settings.showEncryptionKey })}
                    >
                      {settings.showEncryptionKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <Button variant="outline" onClick={generateEncryptionKey}>
                    <Key className="w-4 h-4 mr-2" />
                    Generate
                  </Button>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Backup Settings */}
        <AccordionItem value="backup" className="glass-card border-none">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Database className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Backup Settings</h3>
                <p className="text-sm text-muted-foreground">Automated backups and restore options</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-6">
              <div className="p-4 bg-secondary/30 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Last Backup</p>
                    <p className="text-sm text-muted-foreground">{settings.lastBackup}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleRestoreBackup}>
                    <Upload className="w-4 h-4 mr-2" />
                    Restore
                  </Button>
                  <Button variant="neon" onClick={handleBackupNow} disabled={isBackingUp}>
                    <Download className="w-4 h-4 mr-2" />
                    {isBackingUp ? "Backing up..." : "Backup Now"}
                  </Button>
                </div>
              </div>

              {isBackingUp && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Creating backup...</span>
                    <span>{backupProgress}%</span>
                  </div>
                  <Progress value={backupProgress} className="h-2" />
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Automatic Backups</p>
                  <p className="text-sm text-muted-foreground">Schedule regular backups</p>
                </div>
                <Switch
                  checked={settings.autoBackup}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoBackup: checked })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Backup Frequency</label>
                  <Select
                    value={settings.backupFrequency}
                    onValueChange={(value) => setSettings({ ...settings, backupFrequency: value })}
                    disabled={!settings.autoBackup}
                  >
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Retention (days)</label>
                  <Input
                    type="number"
                    value={settings.backupRetention}
                    onChange={(e) => setSettings({ ...settings, backupRetention: e.target.value })}
                    className="bg-secondary/50"
                    disabled={!settings.autoBackup}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Storage Location</label>
                  <Select
                    value={settings.backupLocation}
                    onValueChange={(value) => setSettings({ ...settings, backupLocation: value })}
                  >
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local Storage</SelectItem>
                      <SelectItem value="cloud">Cloud Storage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* System Configuration */}
        <AccordionItem value="system" className="glass-card border-none">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Server className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground">System Configuration</h3>
                <p className="text-sm text-muted-foreground">Debug, logging, and maintenance</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">Debug Mode</p>
                    <p className="text-sm text-muted-foreground">Enable verbose logging</p>
                  </div>
                  <Switch
                    checked={settings.debugMode}
                    onCheckedChange={(checked) => setSettings({ ...settings, debugMode: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <div>
                      <p className="font-medium text-foreground">Maintenance Mode</p>
                      <p className="text-sm text-muted-foreground">Disable public access</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.maintenanceMode}
                    onCheckedChange={(checked) => setSettings({ ...settings, maintenanceMode: checked })}
                  />
                </div>
              </div>

              {settings.maintenanceMode && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Maintenance Message</label>
                  <Textarea
                    value={settings.maintenanceMessage}
                    onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                    className="bg-secondary/50"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Log Level</label>
                  <Select
                    value={settings.logLevel}
                    onValueChange={(value) => setSettings({ ...settings, logLevel: value })}
                  >
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="warn">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Max Upload Size (MB)</label>
                  <Input
                    type="number"
                    value={settings.maxUploadSize}
                    onChange={(e) => setSettings({ ...settings, maxUploadSize: e.target.value })}
                    className="bg-secondary/50"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Timezone</label>
                  <Select
                    value={settings.timezone}
                    onValueChange={(value) => setSettings({ ...settings, timezone: value })}
                  >
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Performance Settings */}
        <AccordionItem value="performance" className="glass-card border-none">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Zap className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-foreground">Performance</h3>
                <p className="text-sm text-muted-foreground">Caching, compression, optimization</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">Enable Caching</p>
                    <p className="text-sm text-muted-foreground">Cache static assets</p>
                  </div>
                  <Switch
                    checked={settings.cacheEnabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, cacheEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">Compression</p>
                    <p className="text-sm text-muted-foreground">GZIP compress responses</p>
                  </div>
                  <Switch
                    checked={settings.compressionEnabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, compressionEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">Lazy Load Images</p>
                    <p className="text-sm text-muted-foreground">Load images on demand</p>
                  </div>
                  <Switch
                    checked={settings.lazyLoadImages}
                    onCheckedChange={(checked) => setSettings({ ...settings, lazyLoadImages: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">Minify Assets</p>
                    <p className="text-sm text-muted-foreground">Minify CSS and JS</p>
                  </div>
                  <Switch
                    checked={settings.minifyAssets}
                    onCheckedChange={(checked) => setSettings({ ...settings, minifyAssets: checked })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Cache Duration (seconds)</label>
                <Input
                  type="number"
                  value={settings.cacheDuration}
                  onChange={(e) => setSettings({ ...settings, cacheDuration: e.target.value })}
                  className="bg-secondary/50 max-w-xs"
                  disabled={!settings.cacheEnabled}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Button variant="neon" size="lg" onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save All Settings"}
        </Button>
      </motion.div>
    </div>
  );
};

export default AdminAdvancedSettings;
