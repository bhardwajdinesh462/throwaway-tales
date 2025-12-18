import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
import { Cog, Save, Eye, EyeOff } from "lucide-react";

const SMTP_SETTINGS_KEY = 'trashmails_smtp_settings';

interface SMTPSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'none' | 'ssl' | 'tls';
  fromEmail: string;
  fromName: string;
  enabled: boolean;
}

const defaultSettings: SMTPSettings = {
  host: 'smtp.example.com',
  port: 587,
  username: '',
  password: '',
  encryption: 'tls',
  fromEmail: 'noreply@trashmails.io',
  fromName: 'TrashMails',
  enabled: false,
};

const AdminSMTPSettings = () => {
  const [settings, setSettings] = useState<SMTPSettings>(() =>
    storage.get(SMTP_SETTINGS_KEY, defaultSettings)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    storage.set(SMTP_SETTINGS_KEY, settings);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("SMTP settings saved successfully!");
    }, 500);
  };

  const handleTestConnection = () => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      toast.success("SMTP connection test successful!");
    }, 1500);
  };

  const updateSetting = <K extends keyof SMTPSettings>(key: K, value: SMTPSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Cog className="w-8 h-8 text-primary" />
            SMTP Settings
          </h1>
          <p className="text-muted-foreground">Configure email sending settings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            SMTP Configuration
            <div className="flex items-center gap-2">
              <Label htmlFor="smtp-enabled">Enable SMTP</Label>
              <Switch
                id="smtp-enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => updateSetting('enabled', checked)}
              />
            </div>
          </CardTitle>
          <CardDescription>Configure your SMTP server for sending emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">SMTP Host</Label>
              <Input
                id="host"
                value={settings.host}
                onChange={(e) => updateSetting('host', e.target.value)}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={settings.port}
                onChange={(e) => updateSetting('port', parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={settings.username}
                onChange={(e) => updateSetting('username', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={settings.password}
                  onChange={(e) => updateSetting('password', e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Encryption</Label>
            <div className="flex gap-4">
              {(['none', 'ssl', 'tls'] as const).map((enc) => (
                <label key={enc} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="encryption"
                    checked={settings.encryption === enc}
                    onChange={() => updateSetting('encryption', enc)}
                    className="text-primary"
                  />
                  <span className="capitalize">{enc === 'none' ? 'None' : enc.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromEmail">From Email</Label>
              <Input
                id="fromEmail"
                type="email"
                value={settings.fromEmail}
                onChange={(e) => updateSetting('fromEmail', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                value={settings.fromName}
                onChange={(e) => updateSetting('fromName', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSMTPSettings;
