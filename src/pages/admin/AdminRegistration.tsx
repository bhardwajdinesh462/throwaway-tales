import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useRegistrationSettings } from "@/hooks/useRegistrationSettings";
import { api } from "@/lib/api";
import { UserPlus, Save, Shield, AlertTriangle, Lock, MailCheck, Loader2 } from "lucide-react";

const AdminRegistration = () => {
  const { settings, isLoading, updateSettings } = useRegistrationSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingAuth, setIsSyncingAuth] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    
    // Save registration settings
    const result = await updateSettings(localSettings);
    
    if (result.success) {
      // Sync email confirmation setting with backend
      setIsSyncingAuth(true);
      try {
        const { data, error } = await api.functions.invoke<{ error?: string }>('configure-auth', {
          body: {
            autoConfirmEmail: !localSettings.requireEmailConfirmation
          }
        });
        
        if (error) {
          console.error('Auth config sync error:', error);
          toast.error("Failed to sync auth settings: " + error.message);
        } else if (data?.error) {
          console.error('Auth config sync error:', data.error);
          toast.error("Failed to sync auth settings: " + data.error);
        } else {
          toast.success("Registration settings saved and synced successfully!");
        }
      } catch (e: any) {
        console.error('Auth config error:', e);
        toast.error("Error syncing auth settings: " + (e.message || "Unknown error"));
      } finally {
        setIsSyncingAuth(false);
      }
    } else {
      toast.error("Failed to save settings");
    }
    setIsSaving(false);
  };

  const updateSetting = <K extends keyof typeof localSettings>(key: K, value: typeof localSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserPlus className="w-8 h-8 text-primary" />
            Registration Control
          </h1>
          <p className="text-muted-foreground">Control user registration and site access</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Security Warning */}
      <Alert className="border-amber-500/50 bg-amber-500/10">
        <Shield className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-amber-200">
          These settings control who can access your application. Changes take effect immediately.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {/* Registration Control */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Registration Settings
            </CardTitle>
            <CardDescription>Control new user registration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
              <div>
                <Label className="text-base font-medium">Allow New Registrations</Label>
                <p className="text-sm text-muted-foreground">
                  When disabled, new users cannot sign up
                </p>
              </div>
              <Switch
                checked={localSettings.allowRegistration}
                onCheckedChange={(checked) => updateSetting('allowRegistration', checked)}
              />
            </div>

            {!localSettings.allowRegistration && (
              <div className="space-y-2">
                <Label htmlFor="registrationMessage">Disabled Registration Message</Label>
                <Textarea
                  id="registrationMessage"
                  value={localSettings.registrationMessage}
                  onChange={(e) => updateSetting('registrationMessage', e.target.value)}
                  placeholder="Message to show when registration is disabled"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  This message will be shown to users trying to register
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Confirmation Settings */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailCheck className="w-5 h-5 text-primary" />
              Email Verification
            </CardTitle>
            <CardDescription>Configure email verification requirements for new users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
              <div>
                <Label className="text-base font-medium">Require Email Confirmation</Label>
                <p className="text-sm text-muted-foreground">
                  Users must verify their email before accessing the app
                </p>
              </div>
              <Switch
                checked={localSettings.requireEmailConfirmation}
                onCheckedChange={(checked) => updateSetting('requireEmailConfirmation', checked)}
              />
            </div>

            {localSettings.requireEmailConfirmation ? (
              <Alert className="border-primary/50 bg-primary/10">
                <MailCheck className="h-4 w-4 text-primary" />
                <AlertDescription className="text-primary">
                  Email confirmation is <strong>mandatory</strong>. New users will receive a verification email and must confirm before logging in.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-200">
                  Email confirmation is <strong>optional</strong>. Users can access the app immediately after signing up without verifying their email.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Maintenance Mode */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Maintenance Mode
            </CardTitle>
            <CardDescription>Temporarily restrict access to the site</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
              <div>
                <Label className="text-base font-medium">Enable Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Only admins can access the site when enabled
                </p>
              </div>
              <Switch
                checked={localSettings.maintenanceMode}
                onCheckedChange={(checked) => updateSetting('maintenanceMode', checked)}
              />
            </div>

            {localSettings.maintenanceMode && (
              <div className="space-y-2">
                <Label htmlFor="maintenanceMessage">Maintenance Message</Label>
                <Textarea
                  id="maintenanceMessage"
                  value={localSettings.maintenanceMessage}
                  onChange={(e) => updateSetting('maintenanceMessage', e.target.value)}
                  placeholder="Message to show during maintenance"
                  rows={3}
                />
              </div>
            )}

            {localSettings.maintenanceMode && (
              <Alert className="border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  Maintenance mode is active. Regular users cannot access the site.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Current Status */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <p className="text-sm text-muted-foreground">Registration</p>
                <p className={`font-semibold ${localSettings.allowRegistration ? 'text-green-500' : 'text-red-500'}`}>
                  {localSettings.allowRegistration ? 'Open' : 'Closed'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <p className="text-sm text-muted-foreground">Email Verification</p>
                <p className={`font-semibold ${localSettings.requireEmailConfirmation ? 'text-primary' : 'text-amber-500'}`}>
                  {localSettings.requireEmailConfirmation ? 'Required' : 'Optional'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <p className="text-sm text-muted-foreground">Maintenance</p>
                <p className={`font-semibold ${localSettings.maintenanceMode ? 'text-amber-500' : 'text-green-500'}`}>
                  {localSettings.maintenanceMode ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminRegistration;
