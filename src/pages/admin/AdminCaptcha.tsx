import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
import { ShieldCheck, Save } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CAPTCHA_KEY = 'trashmails_captcha_settings';

interface CaptchaSettings {
  enabled: boolean;
  provider: 'recaptcha' | 'hcaptcha' | 'turnstile' | 'none';
  siteKey: string;
  secretKey: string;
  enableOnLogin: boolean;
  enableOnRegister: boolean;
  enableOnContact: boolean;
  enableOnEmailGen: boolean;
  threshold: number;
}

const defaultSettings: CaptchaSettings = {
  enabled: false,
  provider: 'recaptcha',
  siteKey: '',
  secretKey: '',
  enableOnLogin: true,
  enableOnRegister: true,
  enableOnContact: true,
  enableOnEmailGen: false,
  threshold: 0.5,
};

const AdminCaptcha = () => {
  const [settings, setSettings] = useState<CaptchaSettings>(() =>
    storage.get(CAPTCHA_KEY, defaultSettings)
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    storage.set(CAPTCHA_KEY, settings);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Captcha settings saved!");
    }, 500);
  };

  const updateSetting = <K extends keyof CaptchaSettings>(key: K, value: CaptchaSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Captcha Settings
          </h1>
          <p className="text-muted-foreground">Configure captcha protection</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Captcha Provider
              <div className="flex items-center gap-2">
                <Label htmlFor="captcha-enabled">Enable Captcha</Label>
                <Switch
                  id="captcha-enabled"
                  checked={settings.enabled}
                  onCheckedChange={(checked) => updateSetting('enabled', checked)}
                />
              </div>
            </CardTitle>
            <CardDescription>Choose your captcha provider</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={settings.provider} onValueChange={(v) => updateSetting('provider', v as CaptchaSettings['provider'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recaptcha">Google reCAPTCHA v3</SelectItem>
                  <SelectItem value="hcaptcha">hCaptcha</SelectItem>
                  <SelectItem value="turnstile">Cloudflare Turnstile</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="siteKey">Site Key</Label>
                <Input
                  id="siteKey"
                  value={settings.siteKey}
                  onChange={(e) => updateSetting('siteKey', e.target.value)}
                  placeholder="Enter site key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secretKey">Secret Key</Label>
                <Input
                  id="secretKey"
                  type="password"
                  value={settings.secretKey}
                  onChange={(e) => updateSetting('secretKey', e.target.value)}
                  placeholder="Enter secret key"
                />
              </div>
            </div>
            {settings.provider === 'recaptcha' && (
              <div className="space-y-2">
                <Label htmlFor="threshold">Score Threshold (0.0 - 1.0)</Label>
                <Input
                  id="threshold"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={settings.threshold}
                  onChange={(e) => updateSetting('threshold', parseFloat(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Higher values = stricter verification</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Protected Pages</CardTitle>
            <CardDescription>Enable captcha on specific actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Login Page</Label>
                <p className="text-sm text-muted-foreground">Protect login form</p>
              </div>
              <Switch
                checked={settings.enableOnLogin}
                onCheckedChange={(checked) => updateSetting('enableOnLogin', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Registration Page</Label>
                <p className="text-sm text-muted-foreground">Protect signup form</p>
              </div>
              <Switch
                checked={settings.enableOnRegister}
                onCheckedChange={(checked) => updateSetting('enableOnRegister', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Contact Form</Label>
                <p className="text-sm text-muted-foreground">Protect contact page</p>
              </div>
              <Switch
                checked={settings.enableOnContact}
                onCheckedChange={(checked) => updateSetting('enableOnContact', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Generation</Label>
                <p className="text-sm text-muted-foreground">Protect email generator</p>
              </div>
              <Switch
                checked={settings.enableOnEmailGen}
                onCheckedChange={(checked) => updateSetting('enableOnEmailGen', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminCaptcha;
