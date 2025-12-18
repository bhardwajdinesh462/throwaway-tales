import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { Search, Save, Code, FileCode } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  headerCode: string;
  footerCode: string;
  customCss: string;
  customJs: string;
  schemaMarkup: string;
  facebookPixelId: string;
  googleSiteVerification: string;
  bingSiteVerification: string;
}

const defaultSettings: SEOSettings = {
  siteTitle: 'Nullsto - Free Disposable Email Service',
  metaDescription: 'Generate instant, anonymous email addresses. Perfect for sign-ups, testing, and keeping your real inbox spam-free.',
  metaKeywords: 'disposable email, temporary email, trash mail, anonymous email, fake email, temp mail',
  ogImage: '/og-image.png',
  twitterHandle: '@nullsto',
  googleAnalyticsId: '',
  googleTagManagerId: '',
  robotsTxt: 'User-agent: *\nAllow: /\nDisallow: /admin/',
  enableSitemap: true,
  enableCanonicalUrls: true,
  headerCode: '',
  footerCode: '',
  customCss: '',
  customJs: '',
  schemaMarkup: '',
  facebookPixelId: '',
  googleSiteVerification: '',
  bingSiteVerification: '',
};

const AdminSEO = () => {
  const [settings, setSettings] = useState<SEOSettings>(() =>
    storage.get(SEO_SETTINGS_KEY, defaultSettings)
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage for immediate access
      storage.set(SEO_SETTINGS_KEY, settings);
      
      // Also save to Supabase app_settings for persistence
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'seo')
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
          .eq('key', 'seo');
        error = result.error;
      } else {
        const result = await supabase
          .from('app_settings')
          .insert([{
            key: 'seo',
            value: settingsJson,
          }]);
        error = result.error;
      }

      if (error) {
        console.error('Error saving to database:', error);
        toast.error('Settings saved locally but failed to sync to database');
      } else {
        toast.success("SEO settings saved!");
      }
    } catch (e) {
      console.error('Error saving settings:', e);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
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

      <Tabs defaultValue="meta" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="meta">Meta Tags</TabsTrigger>
          <TabsTrigger value="social">Social & Analytics</TabsTrigger>
          <TabsTrigger value="codes">Custom Codes</TabsTrigger>
          <TabsTrigger value="technical">Technical</TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Meta Tags</CardTitle>
              <CardDescription>Core SEO meta information for search engines</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="siteTitle">Site Title</Label>
                <Input
                  id="siteTitle"
                  value={settings.siteTitle}
                  onChange={(e) => updateSetting('siteTitle', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{settings.siteTitle.length}/60 characters recommended</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaDescription">Meta Description</Label>
                <Textarea
                  id="metaDescription"
                  value={settings.metaDescription}
                  onChange={(e) => updateSetting('metaDescription', e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">{settings.metaDescription.length}/160 characters recommended</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaKeywords">Meta Keywords</Label>
                <Input
                  id="metaKeywords"
                  value={settings.metaKeywords}
                  onChange={(e) => updateSetting('metaKeywords', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Comma-separated keywords</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Site Verification</CardTitle>
              <CardDescription>Verify your site with search engines</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="googleSiteVerification">Google Site Verification</Label>
                <Input
                  id="googleSiteVerification"
                  value={settings.googleSiteVerification}
                  onChange={(e) => updateSetting('googleSiteVerification', e.target.value)}
                  placeholder="google-site-verification=xxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bingSiteVerification">Bing Site Verification</Label>
                <Input
                  id="bingSiteVerification"
                  value={settings.bingSiteVerification}
                  onChange={(e) => updateSetting('bingSiteVerification', e.target.value)}
                  placeholder="msvalidate.01=xxxxxxxx"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="space-y-6">
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
              <CardTitle>Analytics & Tracking</CardTitle>
              <CardDescription>Google Analytics, Tag Manager, and Facebook Pixel</CardDescription>
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
              <div className="space-y-2">
                <Label htmlFor="facebookPixelId">Facebook Pixel ID</Label>
                <Input
                  id="facebookPixelId"
                  value={settings.facebookPixelId}
                  onChange={(e) => updateSetting('facebookPixelId', e.target.value)}
                  placeholder="XXXXXXXXXXXXXXX"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="codes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-5 h-5" />
                Header Code
              </CardTitle>
              <CardDescription>Custom code injected into the &lt;head&gt; section (scripts, styles, meta tags)</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.headerCode}
                onChange={(e) => updateSetting('headerCode', e.target.value)}
                rows={8}
                className="font-mono text-sm"
                placeholder="<!-- Add custom scripts, styles, or meta tags here -->
<script>
  // Your custom script
</script>"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="w-5 h-5" />
                Footer Code
              </CardTitle>
              <CardDescription>Custom code injected before the closing &lt;/body&gt; tag</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.footerCode}
                onChange={(e) => updateSetting('footerCode', e.target.value)}
                rows={8}
                className="font-mono text-sm"
                placeholder="<!-- Add tracking scripts, chat widgets, or other code here -->
<script>
  // Your custom script
</script>"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom CSS</CardTitle>
              <CardDescription>Add custom CSS styles to your site</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.customCss}
                onChange={(e) => updateSetting('customCss', e.target.value)}
                rows={8}
                className="font-mono text-sm"
                placeholder="/* Add custom CSS styles here */
.my-class {
  color: red;
}"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom JavaScript</CardTitle>
              <CardDescription>Add custom JavaScript code (runs after page load)</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.customJs}
                onChange={(e) => updateSetting('customJs', e.target.value)}
                rows={8}
                className="font-mono text-sm"
                placeholder="// Add custom JavaScript here
console.log('Custom script loaded');"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schema Markup (JSON-LD)</CardTitle>
              <CardDescription>Add structured data for rich search results</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.schemaMarkup}
                onChange={(e) => updateSetting('schemaMarkup', e.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder='{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Nullsto",
  "url": "https://nullsto.com"
}'
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technical" className="space-y-6">
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
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSEO;
