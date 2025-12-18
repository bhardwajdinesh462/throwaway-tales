import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
import { Search, Save } from "lucide-react";

const SEO_SETTINGS_KEY = 'trashmails_seo_settings';

interface SEOSettings {
  siteTitle: string;
  metaDescription: string;
  metaKeywords: string;
  ogImage: string;
  twitterHandle: string;
  googleAnalyticsId: string;
  googleTagManagerId: string;
  robotsTxt: string;
  enableSitemap: boolean;
  enableCanonicalUrls: boolean;
}

const defaultSettings: SEOSettings = {
  siteTitle: 'TrashMails - Free Disposable Email Service',
  metaDescription: 'Generate instant, anonymous email addresses. Perfect for sign-ups, testing, and keeping your real inbox spam-free.',
  metaKeywords: 'disposable email, temporary email, trash mail, anonymous email, fake email, temp mail',
  ogImage: '/og-image.png',
  twitterHandle: '@trashmails',
  googleAnalyticsId: '',
  googleTagManagerId: '',
  robotsTxt: 'User-agent: *\nAllow: /\nDisallow: /admin/',
  enableSitemap: true,
  enableCanonicalUrls: true,
};

const AdminSEO = () => {
  const [settings, setSettings] = useState<SEOSettings>(() =>
    storage.get(SEO_SETTINGS_KEY, defaultSettings)
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    storage.set(SEO_SETTINGS_KEY, settings);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("SEO settings saved!");
    }, 500);
  };

  const updateSetting = <K extends keyof SEOSettings>(key: K, value: SEOSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Search className="w-8 h-8 text-primary" />
            SEO Management
          </h1>
          <p className="text-muted-foreground">Optimize your site for search engines</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Meta Tags</CardTitle>
            <CardDescription>Basic SEO meta information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siteTitle">Site Title</Label>
              <Input
                id="siteTitle"
                value={settings.siteTitle}
                onChange={(e) => updateSetting('siteTitle', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{settings.siteTitle.length}/60 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaDescription">Meta Description</Label>
              <Textarea
                id="metaDescription"
                value={settings.metaDescription}
                onChange={(e) => updateSetting('metaDescription', e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{settings.metaDescription.length}/160 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaKeywords">Meta Keywords</Label>
              <Input
                id="metaKeywords"
                value={settings.metaKeywords}
                onChange={(e) => updateSetting('metaKeywords', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Social Media</CardTitle>
            <CardDescription>Open Graph and Twitter Card settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ogImage">OG Image URL</Label>
                <Input
                  id="ogImage"
                  value={settings.ogImage}
                  onChange={(e) => updateSetting('ogImage', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitterHandle">Twitter Handle</Label>
                <Input
                  id="twitterHandle"
                  value={settings.twitterHandle}
                  onChange={(e) => updateSetting('twitterHandle', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
            <CardDescription>Google Analytics and Tag Manager</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="googleAnalyticsId">Google Analytics ID</Label>
                <Input
                  id="googleAnalyticsId"
                  value={settings.googleAnalyticsId}
                  onChange={(e) => updateSetting('googleAnalyticsId', e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="googleTagManagerId">Google Tag Manager ID</Label>
                <Input
                  id="googleTagManagerId"
                  value={settings.googleTagManagerId}
                  onChange={(e) => updateSetting('googleTagManagerId', e.target.value)}
                  placeholder="GTM-XXXXXXX"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Technical SEO</CardTitle>
            <CardDescription>Robots.txt and sitemap settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Sitemap</Label>
                <p className="text-sm text-muted-foreground">Generate XML sitemap</p>
              </div>
              <Switch
                checked={settings.enableSitemap}
                onCheckedChange={(checked) => updateSetting('enableSitemap', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Canonical URLs</Label>
                <p className="text-sm text-muted-foreground">Add canonical tags to pages</p>
              </div>
              <Switch
                checked={settings.enableCanonicalUrls}
                onCheckedChange={(checked) => updateSetting('enableCanonicalUrls', checked)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="robotsTxt">robots.txt Content</Label>
              <Textarea
                id="robotsTxt"
                value={settings.robotsTxt}
                onChange={(e) => updateSetting('robotsTxt', e.target.value)}
                rows={5}
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSEO;
