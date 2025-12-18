import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
import { Users, Save } from "lucide-react";

const USER_SETTINGS_KEY = 'trashmails_user_settings';

interface UserSettings {
  allowGuestAccess: boolean;
  guestEmailLimit: number;
  guestEmailDuration: number;
  userEmailLimit: number;
  userEmailDuration: number;
  requireEmailVerification: boolean;
  allowSocialLogin: boolean;
  allowPasswordReset: boolean;
  sessionTimeout: number;
  maxSavedEmails: number;
}

const defaultSettings: UserSettings = {
  allowGuestAccess: true,
  guestEmailLimit: 5,
  guestEmailDuration: 60,
  userEmailLimit: 50,
  userEmailDuration: 1440,
  requireEmailVerification: false,
  allowSocialLogin: true,
  allowPasswordReset: true,
  sessionTimeout: 1440,
  maxSavedEmails: 100,
};

const AdminUserSettings = () => {
  const [settings, setSettings] = useState<UserSettings>(() =>
    storage.get(USER_SETTINGS_KEY, defaultSettings)
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    storage.set(USER_SETTINGS_KEY, settings);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("User settings saved!");
    }, 500);
  };

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8 text-primary" />
            User & Guest Settings
          </h1>
          <p className="text-muted-foreground">Configure user and guest access permissions</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Guest Access</CardTitle>
            <CardDescription>Configure anonymous user access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Guest Access</Label>
                <p className="text-sm text-muted-foreground">Allow users without accounts to generate emails</p>
              </div>
              <Switch
                checked={settings.allowGuestAccess}
                onCheckedChange={(checked) => updateSetting('allowGuestAccess', checked)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guestEmailLimit">Guest Email Limit</Label>
                <Input
                  id="guestEmailLimit"
                  type="number"
                  value={settings.guestEmailLimit}
                  onChange={(e) => updateSetting('guestEmailLimit', parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Max emails per session</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="guestEmailDuration">Email Duration (minutes)</Label>
                <Input
                  id="guestEmailDuration"
                  type="number"
                  value={settings.guestEmailDuration}
                  onChange={(e) => updateSetting('guestEmailDuration', parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">How long guest emails remain active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registered Users</CardTitle>
            <CardDescription>Configure limits for registered users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="userEmailLimit">User Email Limit</Label>
                <Input
                  id="userEmailLimit"
                  type="number"
                  value={settings.userEmailLimit}
                  onChange={(e) => updateSetting('userEmailLimit', parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Max active emails per user</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="userEmailDuration">Email Duration (minutes)</Label>
                <Input
                  id="userEmailDuration"
                  type="number"
                  value={settings.userEmailDuration}
                  onChange={(e) => updateSetting('userEmailDuration', parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">How long user emails remain active</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxSavedEmails">Max Saved Emails</Label>
              <Input
                id="maxSavedEmails"
                type="number"
                value={settings.maxSavedEmails}
                onChange={(e) => updateSetting('maxSavedEmails', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Maximum emails a user can save</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>Configure authentication options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Require Email Verification</Label>
                <p className="text-sm text-muted-foreground">Users must verify email before using features</p>
              </div>
              <Switch
                checked={settings.requireEmailVerification}
                onCheckedChange={(checked) => updateSetting('requireEmailVerification', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Social Login</Label>
                <p className="text-sm text-muted-foreground">Enable Google and Facebook login</p>
              </div>
              <Switch
                checked={settings.allowSocialLogin}
                onCheckedChange={(checked) => updateSetting('allowSocialLogin', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Password Reset</Label>
                <p className="text-sm text-muted-foreground">Enable password recovery feature</p>
              </div>
              <Switch
                checked={settings.allowPasswordReset}
                onCheckedChange={(checked) => updateSetting('allowPasswordReset', checked)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                value={settings.sessionTimeout}
                onChange={(e) => updateSetting('sessionTimeout', parseInt(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminUserSettings;
