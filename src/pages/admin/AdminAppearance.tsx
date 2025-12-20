import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
import { Paintbrush, Save, Upload, Image, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsContext";
const APPEARANCE_SETTINGS_KEY = 'trashmails_appearance_settings';

interface AppearanceSettings {
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  darkMode: boolean;
  showAnimations: boolean;
  customCss: string;
  footerText: string;
}

const defaultSettings: AppearanceSettings = {
  logoUrl: '/og-image.png',
  faviconUrl: '/favicon.ico',
  primaryColor: '#0d9488',
  accentColor: '#8b5cf6',
  darkMode: true,
  showAnimations: true,
  customCss: '',
  footerText: '© 2024 Nullsto. All rights reserved.',
};

const AdminAppearance = () => {
  const { refetch: refetchGlobalSettings } = useSettings();
  const [settings, setSettings] = useState<AppearanceSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'appearance')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.value) {
          const dbSettings = data.value as unknown as AppearanceSettings;
          setSettings({ ...defaultSettings, ...dbSettings });
        } else {
          const localSettings = storage.get<AppearanceSettings>(APPEARANCE_SETTINGS_KEY, defaultSettings);
          setSettings(localSettings);
        }
      } catch (e) {
        console.error('Error loading settings:', e);
        const localSettings = storage.get<AppearanceSettings>(APPEARANCE_SETTINGS_KEY, defaultSettings);
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
      storage.set(APPEARANCE_SETTINGS_KEY, settings);
      
      // Also save to Supabase app_settings for persistence
      // First check if the key exists
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'appearance')
        .single();

      // Cast settings to Json-compatible format
      const settingsJson = JSON.parse(JSON.stringify(settings));

      let error;
      if (existing) {
        // Update existing
        const result = await supabase
          .from('app_settings')
          .update({
            value: settingsJson,
            updated_at: new Date().toISOString(),
          })
          .eq('key', 'appearance');
        error = result.error;
      } else {
        // Insert new
        const result = await supabase
          .from('app_settings')
          .insert([{
            key: 'appearance',
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
        toast.success("Appearance settings saved!");
      }
    } catch (e) {
      console.error('Error saving settings:', e);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = async (
    file: File,
    type: 'logo' | 'favicon',
    setUploading: (v: boolean) => void
  ) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/x-icon', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload an image file.');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 2MB.');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `branding/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('banners')
        .getPublicUrl(filePath);

      if (type === 'logo') {
        updateSetting('logoUrl', publicUrl);
      } else {
        updateSetting('faviconUrl', publicUrl);
      }

      toast.success(`${type === 'logo' ? 'Logo' : 'Favicon'} uploaded successfully!`);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload ${type}: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, 'logo', setIsUploadingLogo);
    }
  };

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, 'favicon', setIsUploadingFavicon);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Paintbrush className="w-8 h-8 text-primary" />
            Appearance
          </h1>
          <p className="text-muted-foreground">Customize the look and feel of your site</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Upload your logo and favicon</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Logo Upload */}
              <div className="space-y-4">
                <Label>Site Logo</Label>
                <div className="flex flex-col gap-4">
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                    {settings.logoUrl ? (
                      <div className="space-y-3">
                        <img
                          src={settings.logoUrl}
                          alt="Logo preview"
                          className="max-h-24 mx-auto object-contain"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateSetting('logoUrl', '')}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="py-4">
                        <Image className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No logo uploaded</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={settings.logoUrl}
                      onChange={(e) => updateSetting('logoUrl', e.target.value)}
                      placeholder="Enter logo URL or upload"
                      className="flex-1"
                    />
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isUploadingLogo}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {isUploadingLogo ? 'Uploading...' : 'Upload'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended: PNG or SVG, max 2MB
                  </p>
                </div>
              </div>

              {/* Favicon Upload */}
              <div className="space-y-4">
                <Label>Favicon</Label>
                <div className="flex flex-col gap-4">
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                    {settings.faviconUrl ? (
                      <div className="space-y-3">
                        <img
                          src={settings.faviconUrl}
                          alt="Favicon preview"
                          className="w-16 h-16 mx-auto object-contain"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateSetting('faviconUrl', '')}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="py-4">
                        <Image className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No favicon uploaded</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={settings.faviconUrl}
                      onChange={(e) => updateSetting('faviconUrl', e.target.value)}
                      placeholder="Enter favicon URL or upload"
                      className="flex-1"
                    />
                    <input
                      ref={faviconInputRef}
                      type="file"
                      accept="image/*,.ico"
                      onChange={handleFaviconUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => faviconInputRef.current?.click()}
                      disabled={isUploadingFavicon}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {isUploadingFavicon ? 'Uploading...' : 'Upload'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended: ICO or PNG, 32x32 or 64x64 pixels
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Colors</CardTitle>
            <CardDescription>Customize your brand colors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    value={settings.primaryColor}
                    onChange={(e) => updateSetting('primaryColor', e.target.value)}
                  />
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => updateSetting('primaryColor', e.target.value)}
                    className="w-10 h-10 rounded border border-border cursor-pointer"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accentColor">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="accentColor"
                    value={settings.accentColor}
                    onChange={(e) => updateSetting('accentColor', e.target.value)}
                  />
                  <input
                    type="color"
                    value={settings.accentColor}
                    onChange={(e) => updateSetting('accentColor', e.target.value)}
                    className="w-10 h-10 rounded border border-border cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Display Options</CardTitle>
            <CardDescription>Toggle various display features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Dark Mode Default</Label>
                <p className="text-sm text-muted-foreground">Set dark mode as the default theme</p>
              </div>
              <Switch
                checked={settings.darkMode}
                onCheckedChange={(checked) => updateSetting('darkMode', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Show Animations</Label>
                <p className="text-sm text-muted-foreground">Enable UI animations and transitions</p>
              </div>
              <Switch
                checked={settings.showAnimations}
                onCheckedChange={(checked) => updateSetting('showAnimations', checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Footer</CardTitle>
            <CardDescription>Customize footer content</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="footerText">Footer Text</Label>
              <Input
                id="footerText"
                value={settings.footerText}
                onChange={(e) => updateSetting('footerText', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAppearance;
