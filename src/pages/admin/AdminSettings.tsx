import { useState } from "react";
import { motion } from "framer-motion";
import { Save, Clock, Mail, Shield, Bell } from "lucide-react";
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

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    emailExpiration: "60",
    maxEmailsPerUser: "10",
    allowAnonymous: true,
    requireCaptcha: false,
    enableNotifications: true,
    maintenanceMode: false,
    welcomeMessage: "Welcome to TrashMails! Generate instant, anonymous email addresses.",
    footerText: "© 2024 TrashMails. All rights reserved.",
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success("Settings saved successfully");
    setIsSaving(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Email Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/20">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Email Settings</h3>
            <p className="text-sm text-muted-foreground">Configure email behavior</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Email Expiration (minutes)</label>
              <Select
                value={settings.emailExpiration}
                onValueChange={(value) => setSettings({ ...settings, emailExpiration: value })}
              >
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="1440">24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Max Emails Per User</label>
              <Input
                type="number"
                value={settings.maxEmailsPerUser}
                onChange={(e) => setSettings({ ...settings, maxEmailsPerUser: e.target.value })}
                className="bg-secondary/50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-foreground">Allow Anonymous Users</p>
              <p className="text-sm text-muted-foreground">
                Allow users to generate emails without signing in
              </p>
            </div>
            <Switch
              checked={settings.allowAnonymous}
              onCheckedChange={(checked) => setSettings({ ...settings, allowAnonymous: checked })}
            />
          </div>
        </div>
      </motion.div>

      {/* Security Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-accent/20">
            <Shield className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Security Settings</h3>
            <p className="text-sm text-muted-foreground">Manage security options</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-foreground">Require CAPTCHA</p>
              <p className="text-sm text-muted-foreground">
                Show CAPTCHA for email generation to prevent abuse
              </p>
            </div>
            <Switch
              checked={settings.requireCaptcha}
              onCheckedChange={(checked) => setSettings({ ...settings, requireCaptcha: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-foreground">Maintenance Mode</p>
              <p className="text-sm text-muted-foreground">
                Disable email generation for all users
              </p>
            </div>
            <Switch
              checked={settings.maintenanceMode}
              onCheckedChange={(checked) => setSettings({ ...settings, maintenanceMode: checked })}
            />
          </div>
        </div>
      </motion.div>

      {/* Notification Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-neon-green/20">
            <Bell className="w-5 h-5 text-neon-green" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Notification Settings</h3>
            <p className="text-sm text-muted-foreground">Configure notifications</p>
          </div>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="font-medium text-foreground">Enable Sound Notifications</p>
            <p className="text-sm text-muted-foreground">
              Play sound when new emails arrive
            </p>
          </div>
          <Switch
            checked={settings.enableNotifications}
            onCheckedChange={(checked) => setSettings({ ...settings, enableNotifications: checked })}
          />
        </div>
      </motion.div>

      {/* Content Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6"
      >
        <h3 className="font-semibold text-foreground mb-4">Content Settings</h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Welcome Message</label>
            <Textarea
              value={settings.welcomeMessage}
              onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
              className="bg-secondary/50 min-h-[100px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Footer Text</label>
            <Input
              value={settings.footerText}
              onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
              className="bg-secondary/50"
            />
          </div>
        </div>
      </motion.div>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Button variant="neon" size="lg" onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </motion.div>
    </div>
  );
};

export default AdminSettings;
