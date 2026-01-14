import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Save, Eye, EyeOff, QrCode, Settings, Sparkles, Type, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api } from "@/lib/api";
import DonationWidget from "@/components/DonationWidget";

interface DonationSettings {
  enabled: boolean;
  usdtAddress: string;
  title: string;
  subtitle: string;
  message: string;
  showQRByDefault: boolean;
  position: 'inbox-header' | 'footer' | 'sidebar';
  accentColor: string;
}

const DEFAULT_SETTINGS: DonationSettings = {
  enabled: true,
  usdtAddress: "TSssRNtfSiDL9H8yo9hDdFiDuJURoY9LJg",
  title: "Support Nullsto",
  subtitle: "Help keep this free service running",
  message: "Your donation helps us upgrade to dedicated servers and keep Nullsto free for everyone.",
  showQRByDefault: false,
  position: 'inbox-header',
  accentColor: 'red',
};

const AdminDonationSettings = () => {
  const [settings, setSettings] = useState<DonationSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await api.db.query<{ value: DonationSettings }[]>('app_settings', {
        select: 'value',
        filter: { key: 'donation_settings' },
        limit: 1
      });

      if (!error && data?.[0]?.value) {
        const parsed = typeof data[0].value === 'string' ? JSON.parse(data[0].value as any) : data[0].value;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (err) {
      console.error('Error fetching donation settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Check if record exists
      const { data: existing } = await api.db.query<{ id: string }[]>('app_settings', {
        select: 'id',
        filter: { key: 'donation_settings' },
        limit: 1
      });

      if (existing && existing.length > 0) {
        // Update
        const { error } = await api.db.update('app_settings', {
          value: settings as any,
          updated_at: new Date().toISOString(),
        }, { key: 'donation_settings' });
        if (error) throw error;
      } else {
        // Insert
        const { error } = await api.db.insert('app_settings', {
          key: 'donation_settings',
          value: settings as any,
        });
        if (error) throw error;
      }
      toast.success('Donation settings saved!');
    } catch (err) {
      console.error('Error saving donation settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof DonationSettings>(key: K, value: DonationSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Heart className="w-6 h-6 text-red-500" fill="currentColor" />
            Donation Widget Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure the donation widget that appears in the inbox
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showPreview ? 'Hide' : 'Preview'}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Main Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              General Settings
            </CardTitle>
            <CardDescription>
              Enable or disable the donation widget and set basic options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Donation Widget</Label>
                <p className="text-xs text-muted-foreground">Show the donation widget to users</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => updateSetting('enabled', v)}
              />
            </div>

            <div className="space-y-2">
              <Label>Widget Position</Label>
              <Select
                value={settings.position}
                onValueChange={(v: DonationSettings['position']) => updateSetting('position', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbox-header">Inbox Header (Compact)</SelectItem>
                  <SelectItem value="footer">Page Footer</SelectItem>
                  <SelectItem value="sidebar">Sidebar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Show QR Code by Default</Label>
                <p className="text-xs text-muted-foreground">Display QR code when widget loads</p>
              </div>
              <Switch
                checked={settings.showQRByDefault}
                onCheckedChange={(v) => updateSetting('showQRByDefault', v)}
              />
            </div>

            <div className="space-y-2">
              <Label>Accent Color</Label>
              <Select
                value={settings.accentColor}
                onValueChange={(v) => updateSetting('accentColor', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="red">Red (Default)</SelectItem>
                  <SelectItem value="pink">Pink</SelectItem>
                  <SelectItem value="purple">Purple</SelectItem>
                  <SelectItem value="blue">Blue</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="orange">Orange</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Crypto Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Crypto Address
            </CardTitle>
            <CardDescription>
              Set the cryptocurrency address for donations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>USDT Address (TRC20)</Label>
              <Input
                value={settings.usdtAddress}
                onChange={(e) => updateSetting('usdtAddress', e.target.value)}
                placeholder="TRC20 USDT address"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                This address will be displayed to users and used for QR code generation
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Content Settings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="w-5 h-5" />
              Content & Text
            </CardTitle>
            <CardDescription>
              Customize the text displayed in the donation widget
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Widget Title</Label>
              <Input
                value={settings.title}
                onChange={(e) => updateSetting('title', e.target.value)}
                placeholder="Support Nullsto"
              />
            </div>
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Input
                value={settings.subtitle}
                onChange={(e) => updateSetting('subtitle', e.target.value)}
                placeholder="Help keep this free service running"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Donation Message</Label>
              <Textarea
                value={settings.message}
                onChange={(e) => updateSetting('message', e.target.value)}
                placeholder="Your donation helps us..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        {showPreview && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Preview
              </CardTitle>
              <CardDescription>
                This is how the donation widget will appear to users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-md mx-auto">
                <DonationWidget variant="full" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  );
};

export default AdminDonationSettings;