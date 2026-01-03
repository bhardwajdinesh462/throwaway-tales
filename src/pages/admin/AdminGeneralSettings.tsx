import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Save, AlertTriangle, Eye } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { useLimitModalSettings, defaultLimitModalConfig, LimitModalConfig } from "@/hooks/useLimitModalSettings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GENERAL_SETTINGS_KEY = 'trashmails_general_settings';

// Site Status settings moved to AdminRegistration.tsx to avoid duplicates
interface GeneralSettings {
  siteName: string;
  siteTagline: string;
  siteDescription: string;
  siteUrl: string;
  contactEmail: string;
  supportEmail: string;
  timezone: string;
  dateFormat: string;
}

const defaultSettings: GeneralSettings = {
  siteName: 'Nullsto',
  siteTagline: 'Protect Your Privacy with Disposable Emails',
  siteDescription: 'Generate instant, anonymous email addresses. Perfect for sign-ups, testing, and keeping your real inbox spam-free.',
  siteUrl: 'https://nullsto.edu.pl',
  contactEmail: 'contact@nullsto.com',
  supportEmail: 'support@nullsto.com',
  timezone: 'UTC',
  dateFormat: 'YYYY-MM-DD',
};

const AdminGeneralSettings = () => {
  const { refetch: refetchGlobalSettings } = useSettings();
  const [settings, setSettings] = useState<GeneralSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  // Limit modal settings
  const {
    config: limitModalConfig,
    isLoading: isLoadingModal,
    isSaving: isSavingModal,
    updateConfig: updateModalConfig,
    saveConfig: saveModalConfig,
  } = useLimitModalSettings();

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'general')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.value) {
          const dbSettings = data.value as unknown as GeneralSettings;
          setSettings({ ...defaultSettings, ...dbSettings });
        } else {
          const localSettings = storage.get<GeneralSettings>(GENERAL_SETTINGS_KEY, defaultSettings);
          setSettings(localSettings);
        }
      } catch (e) {
        console.error('Error loading settings:', e);
        const localSettings = storage.get<GeneralSettings>(GENERAL_SETTINGS_KEY, defaultSettings);
        setSettings(localSettings);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage for immediate access
      storage.set(GENERAL_SETTINGS_KEY, settings);
      
      // Also save to Supabase app_settings for persistence
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'general')
        .maybeSingle();

      const settingsJson = JSON.parse(JSON.stringify(settings));

      let error;
      if (existing) {
        const result = await supabase
          .from('app_settings')
          .update({
            value: settingsJson,
            updated_at: new Date().toISOString(),
          })
          .eq('key', 'general');
        error = result.error;
      } else {
        const result = await supabase
          .from('app_settings')
          .insert([{
            key: 'general',
            value: settingsJson,
          }]);
        error = result.error;
      }

      if (error) {
        console.error('Error saving to database:', error);
        toast.error('Settings saved locally but failed to sync to database');
      } else {
        // Immediately refetch global settings so changes apply everywhere
        await refetchGlobalSettings();
        toast.success("General settings saved successfully!");
      }
    } catch (e) {
      console.error('Error saving settings:', e);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLimitModal = async () => {
    const success = await saveModalConfig(limitModalConfig);
    if (success) {
      toast.success("Limit modal settings saved!");
    } else {
      toast.error("Failed to save limit modal settings");
    }
  };

  const updateSetting = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="w-8 h-8 text-primary" />
            General Settings
          </h1>
          <p className="text-muted-foreground">Configure basic site settings</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Site Information</CardTitle>
            <CardDescription>Basic information about your site</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="siteName">Site Name</Label>
                <Input
                  id="siteName"
                  value={settings.siteName}
                  onChange={(e) => updateSetting('siteName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="siteTagline">Tagline</Label>
                <Input
                  id="siteTagline"
                  value={settings.siteTagline}
                  onChange={(e) => updateSetting('siteTagline', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteDescription">Site Description</Label>
              <Textarea
                id="siteDescription"
                value={settings.siteDescription}
                onChange={(e) => updateSetting('siteDescription', e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteUrl">Site URL</Label>
              <Input
                id="siteUrl"
                type="url"
                placeholder="https://nullsto.edu.pl"
                value={settings.siteUrl}
                onChange={(e) => updateSetting('siteUrl', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used for verification email links and other system URLs
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Email addresses for contact and support</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={settings.contactEmail}
                  onChange={(e) => updateSetting('contactEmail', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => updateSetting('supportEmail', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Regional Settings</CardTitle>
            <CardDescription>Timezone and date format preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={settings.timezone}
                  onChange={(e) => updateSetting('timezone', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateFormat">Date Format</Label>
                <Input
                  id="dateFormat"
                  value={settings.dateFormat}
                  onChange={(e) => updateSetting('dateFormat', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Limit Modal Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Email Limit Modal
                </CardTitle>
                <CardDescription>Configure the popup shown when users reach their daily email limit</CardDescription>
              </div>
              <Button onClick={handleSaveLimitModal} disabled={isSavingModal} size="sm">
                <Save className="w-4 h-4 mr-2" />
                {isSavingModal ? 'Saving...' : 'Save Modal Settings'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Limit Modal</Label>
                <p className="text-xs text-muted-foreground">Show popup when users hit their daily email limit</p>
              </div>
              <Switch
                checked={limitModalConfig.enabled}
                onCheckedChange={(checked) => updateModalConfig('enabled', checked)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modalTitle">Modal Title</Label>
                <Input
                  id="modalTitle"
                  value={limitModalConfig.title}
                  onChange={(e) => updateModalConfig('title', e.target.value)}
                  placeholder="Daily Limit Reached"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ctaText">CTA Button Text</Label>
                <Input
                  id="ctaText"
                  value={limitModalConfig.ctaText}
                  onChange={(e) => updateModalConfig('ctaText', e.target.value)}
                  placeholder="Upgrade Now"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modalDescription">Description</Label>
              <Textarea
                id="modalDescription"
                value={limitModalConfig.description}
                onChange={(e) => updateModalConfig('description', e.target.value)}
                placeholder="You've used all {limit} temporary emails for today"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Use {'{limit}'} to insert the user's email limit dynamically
              </p>
            </div>

            <div className="space-y-2">
              <Label>Modal Theme</Label>
              <Select
                value={limitModalConfig.theme}
                onValueChange={(value) => updateModalConfig('theme', value as LimitModalConfig['theme'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (Amber Warning)</SelectItem>
                  <SelectItem value="urgent">Urgent (Red Alert)</SelectItem>
                  <SelectItem value="friendly">Friendly (Blue Info)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/30">
                <div className="space-y-0.5">
                  <Label>Show Countdown Timer</Label>
                  <p className="text-xs text-muted-foreground">Display time until limit resets</p>
                </div>
                <Switch
                  checked={limitModalConfig.showTimer}
                  onCheckedChange={(checked) => updateModalConfig('showTimer', checked)}
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg bg-secondary/30">
                <div className="space-y-0.5">
                  <Label>Show Premium Benefits</Label>
                  <p className="text-xs text-muted-foreground">List benefits of upgrading</p>
                </div>
                <Switch
                  checked={limitModalConfig.showBenefits}
                  onCheckedChange={(checked) => updateModalConfig('showBenefits', checked)}
                />
              </div>
            </div>

            {/* Preview */}
            <div className="mt-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm">Preview</h4>
                <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                  <Eye className="w-4 h-4 mr-2" />
                  {showPreview ? 'Hide' : 'Show'} Preview
                </Button>
              </div>
              {showPreview && (
                <div className="p-4 bg-card border rounded-lg text-center">
                  <div className={`inline-flex p-3 rounded-full mb-3 ${
                    limitModalConfig.theme === 'urgent' ? 'bg-red-500/20' :
                    limitModalConfig.theme === 'friendly' ? 'bg-blue-500/20' :
                    'bg-amber-500/20'
                  }`}>
                    <AlertTriangle className={`w-6 h-6 ${
                      limitModalConfig.theme === 'urgent' ? 'text-red-500' :
                      limitModalConfig.theme === 'friendly' ? 'text-blue-500' :
                      'text-amber-500'
                    }`} />
                  </div>
                  <h3 className="font-bold text-lg">{limitModalConfig.title}</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    {limitModalConfig.description.replace('{limit}', '5')}
                  </p>
                  {limitModalConfig.showTimer && (
                    <div className="mt-3 text-primary font-mono">23h 45m 30s</div>
                  )}
                  <Button className="mt-4" size="sm">{limitModalConfig.ctaText}</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Site Status settings are in Registration Control page */}
      </div>
    </div>
  );
};

export default AdminGeneralSettings;
