import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { Search, Save, Code, FileCode, FileText, TrendingUp, AlertTriangle, CheckCircle, XCircle, Lightbulb, Globe, RefreshCw, Send, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SEO_SETTINGS_KEY = 'trashmails_seo_settings';

interface PageSEO {
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
  noIndex: boolean;
  noFollow: boolean;
  canonicalUrl: string;
  schemaType: string;
}

interface PingStatus {
  success: boolean;
  message: string;
  timestamp: string;
}

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
  pages: Record<string, PageSEO>;
  autoPingEnabled?: boolean;
  indexNowApiKey?: string;
  lastSitemapGenerated?: string;
  lastPingStatus?: {
    google?: PingStatus;
    bing?: PingStatus;
    yandex?: PingStatus;
    seznam?: PingStatus;
  };
}

const sitePages = [
  { path: '/', name: 'Home', description: 'Main landing page' },
  { path: '/about', name: 'About', description: 'About us page' },
  { path: '/pricing', name: 'Pricing', description: 'Pricing plans' },
  { path: '/blog', name: 'Blog', description: 'Blog listing page' },
  { path: '/contact', name: 'Contact', description: 'Contact form page' },
  { path: '/privacy', name: 'Privacy Policy', description: 'Privacy policy page' },
  { path: '/terms', name: 'Terms of Service', description: 'Terms and conditions' },
  { path: '/cookies', name: 'Cookie Policy', description: 'Cookie policy page' },
  { path: '/status', name: 'Status', description: 'Service status page' },
  { path: '/dashboard', name: 'Dashboard', description: 'User dashboard' },
  { path: '/auth', name: 'Auth', description: 'Login/Register page' },
  { path: '/profile', name: 'Profile', description: 'User profile page' },
  { path: '/history', name: 'History', description: 'Email history page' },
  { path: '/features', name: 'Premium Features', description: 'Premium features showcase' },
  { path: '/changelog', name: 'Changelog', description: 'Version history' },
  { path: '/api-access', name: 'API Access', description: 'API documentation' },
  { path: '/billing', name: 'Billing History', description: 'Payment history' },
];

const defaultPageSEO: PageSEO = {
  title: '',
  description: '',
  keywords: '',
  ogImage: '',
  noIndex: false,
  noFollow: false,
  canonicalUrl: '',
  schemaType: 'WebPage',
};

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
  pages: {},
};

interface SEOIssue {
  type: 'error' | 'warning' | 'success';
  message: string;
  fix?: string;
}

const AdminSEO = () => {
  const [settings, setSettings] = useState<SEOSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<string>('/');
  const [isRegeneratingSitemap, setIsRegeneratingSitemap] = useState(false);
  const [isPinging, setIsPinging] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'seo')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.value) {
          const dbSettings = data.value as unknown as SEOSettings;
          setSettings({ ...defaultSettings, ...dbSettings, pages: { ...defaultSettings.pages, ...dbSettings.pages } });
        } else {
          const localSettings = storage.get<SEOSettings>(SEO_SETTINGS_KEY, defaultSettings);
          setSettings(localSettings);
        }
      } catch (e) {
        console.error('Error loading settings:', e);
        const localSettings = storage.get<SEOSettings>(SEO_SETTINGS_KEY, defaultSettings);
        setSettings(localSettings);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const calculateSEOScore = useMemo(() => {
    let score = 0;
    const issues: SEOIssue[] = [];

    // Global SEO checks
    if (settings.siteTitle.length > 0 && settings.siteTitle.length <= 60) {
      score += 10;
      issues.push({ type: 'success', message: 'Site title is optimal length' });
    } else if (settings.siteTitle.length > 60) {
      score += 5;
      issues.push({ type: 'warning', message: 'Site title is too long (>60 chars)', fix: 'Shorten to 60 characters or less' });
    } else {
      issues.push({ type: 'error', message: 'Site title is missing', fix: 'Add a descriptive site title' });
    }

    if (settings.metaDescription.length >= 120 && settings.metaDescription.length <= 160) {
      score += 10;
      issues.push({ type: 'success', message: 'Meta description is optimal length' });
    } else if (settings.metaDescription.length > 0) {
      score += 5;
      issues.push({ type: 'warning', message: 'Meta description should be 120-160 chars', fix: 'Adjust description length' });
    } else {
      issues.push({ type: 'error', message: 'Meta description is missing', fix: 'Add a compelling meta description' });
    }

    if (settings.metaKeywords.length > 0) {
      score += 5;
      issues.push({ type: 'success', message: 'Meta keywords are set' });
    } else {
      issues.push({ type: 'warning', message: 'Meta keywords are empty', fix: 'Add relevant keywords' });
    }

    if (settings.ogImage) {
      score += 10;
      issues.push({ type: 'success', message: 'Open Graph image is set' });
    } else {
      issues.push({ type: 'warning', message: 'OG image is missing', fix: 'Add an Open Graph image for social sharing' });
    }

    if (settings.twitterHandle) {
      score += 5;
      issues.push({ type: 'success', message: 'Twitter handle is configured' });
    }

    if (settings.googleAnalyticsId || settings.googleTagManagerId) {
      score += 10;
      issues.push({ type: 'success', message: 'Analytics tracking is configured' });
    } else {
      issues.push({ type: 'warning', message: 'No analytics configured', fix: 'Add Google Analytics or Tag Manager' });
    }

    if (settings.googleSiteVerification) {
      score += 10;
      issues.push({ type: 'success', message: 'Google Search Console verified' });
    } else {
      issues.push({ type: 'warning', message: 'Google Search Console not verified', fix: 'Verify with Google Search Console' });
    }

    if (settings.enableSitemap) {
      score += 10;
      issues.push({ type: 'success', message: 'Sitemap is enabled' });
    } else {
      issues.push({ type: 'error', message: 'Sitemap is disabled', fix: 'Enable sitemap generation' });
    }

    if (settings.enableCanonicalUrls) {
      score += 10;
      issues.push({ type: 'success', message: 'Canonical URLs are enabled' });
    } else {
      issues.push({ type: 'warning', message: 'Canonical URLs disabled', fix: 'Enable canonical URLs to prevent duplicate content' });
    }

    if (settings.schemaMarkup) {
      score += 10;
      issues.push({ type: 'success', message: 'Schema markup is configured' });
    } else {
      issues.push({ type: 'warning', message: 'No schema markup', fix: 'Add JSON-LD structured data' });
    }

    // Check page-specific SEO
    const pagesWithSEO = Object.keys(settings.pages).filter(p => settings.pages[p]?.title || settings.pages[p]?.description);
    if (pagesWithSEO.length >= sitePages.length * 0.5) {
      score += 10;
      issues.push({ type: 'success', message: `${pagesWithSEO.length}/${sitePages.length} pages have custom SEO` });
    } else {
      issues.push({ type: 'warning', message: `Only ${pagesWithSEO.length}/${sitePages.length} pages have custom SEO`, fix: 'Add SEO settings to more pages' });
    }

    return { score: Math.min(score, 100), issues };
  }, [settings]);

  const getPageSEO = (path: string): PageSEO => {
    return settings.pages[path] || { ...defaultPageSEO };
  };

  const updatePageSEO = (path: string, field: keyof PageSEO, value: string | boolean) => {
    setSettings(prev => ({
      ...prev,
      pages: {
        ...prev.pages,
        [path]: {
          ...getPageSEO(path),
          [field]: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settingsJson = JSON.parse(JSON.stringify(settings));

      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'seo')
        .maybeSingle();

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
        // Clear ALL SEO-related caches from localStorage
        localStorage.removeItem('trashmails_seo_settings');
        localStorage.removeItem(SEO_SETTINGS_KEY);
        
        // Dispatch a global event to notify all components to refetch
        window.dispatchEvent(new CustomEvent('seo-settings-updated', { detail: settings }));
        
        toast.success("SEO settings saved successfully!");
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

  const regenerateSitemap = async () => {
    setIsRegeneratingSitemap(true);
    try {
      const response = await supabase.functions.invoke('generate-sitemap', {
        body: { siteUrl: window.location.origin }
      });
      
      if (response.error) throw new Error(response.error.message);
      
      toast.success("Sitemap regenerated successfully!");
      
      // Refresh settings to get updated timestamp
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'seo')
        .maybeSingle();
      
      if (data?.value) {
        const updatedSettings = data.value as unknown as SEOSettings;
        setSettings(prev => ({ ...prev, ...updatedSettings }));
      }
    } catch (e) {
      console.error('Error regenerating sitemap:', e);
      toast.error('Failed to regenerate sitemap');
    } finally {
      setIsRegeneratingSitemap(false);
    }
  };

  const pingSearchEngines = async () => {
    setIsPinging(true);
    try {
      const response = await supabase.functions.invoke('ping-search-engines', {
        body: { 
          siteUrl: window.location.origin,
          indexNowKey: settings.indexNowApiKey || '',
        }
      });
      
      if (response.error) throw new Error(response.error.message);
      
      const results = response.data;
      const successCount = Object.values(results).filter((r: any) => r.success).length;
      
      toast.success(`Pinged search engines: ${successCount}/4 successful`);
      
      // Update settings with new ping status
      setSettings(prev => ({ ...prev, lastPingStatus: results }));
    } catch (e) {
      console.error('Error pinging search engines:', e);
      toast.error('Failed to ping search engines');
    } finally {
      setIsPinging(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const currentPageSEO = getPageSEO(selectedPage);

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

      {/* SEO Score Card */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`text-5xl font-bold ${getScoreColor(calculateSEOScore.score)}`}>
                {calculateSEOScore.score}
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  SEO Score
                </CardTitle>
                <CardDescription>
                  {calculateSEOScore.score >= 80 ? 'Excellent! Your SEO is well optimized.' :
                   calculateSEOScore.score >= 60 ? 'Good, but there\'s room for improvement.' :
                   calculateSEOScore.score >= 40 ? 'Fair. Consider fixing the issues below.' :
                   'Needs attention. Many SEO improvements needed.'}
                </CardDescription>
              </div>
            </div>
            <div className="w-32">
              <Progress value={calculateSEOScore.score} className={`h-3 ${getScoreBg(calculateSEOScore.score)}`} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="issues" className="border-none">
              <AccordionTrigger className="hover:no-underline py-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium">View SEO Suggestions & Issues</span>
                  <Badge variant="secondary" className="ml-2">
                    {calculateSEOScore.issues.filter(i => i.type !== 'success').length} items
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ScrollArea className="h-48 pr-4">
                  <div className="space-y-2">
                    {calculateSEOScore.issues.map((issue, idx) => (
                      <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg ${
                        issue.type === 'error' ? 'bg-red-500/10' :
                        issue.type === 'warning' ? 'bg-yellow-500/10' : 'bg-green-500/10'
                      }`}>
                        {issue.type === 'error' ? <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /> :
                         issue.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" /> :
                         <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{issue.message}</p>
                          {issue.fix && <p className="text-xs text-muted-foreground">Fix: {issue.fix}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Tabs defaultValue="pages" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pages" className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            Pages
          </TabsTrigger>
          <TabsTrigger value="meta">Meta Tags</TabsTrigger>
          <TabsTrigger value="social">Social & Analytics</TabsTrigger>
          <TabsTrigger value="codes">Custom Codes</TabsTrigger>
          <TabsTrigger value="technical">Technical</TabsTrigger>
        </TabsList>

        {/* Per-Page SEO Settings */}
        <TabsContent value="pages" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Page-Specific SEO Settings
              </CardTitle>
              <CardDescription>Configure unique SEO settings for each page on your site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Page Selector */}
                <div className="lg:col-span-1">
                  <Label className="mb-2 block">Select Page</Label>
                  <ScrollArea className="h-[500px] border rounded-lg">
                    <div className="p-2 space-y-1">
                      {sitePages.map((page) => {
                        const pageSeo = getPageSEO(page.path);
                        const hasCustomSeo = pageSeo.title || pageSeo.description;
                        return (
                          <button
                            key={page.path}
                            onClick={() => setSelectedPage(page.path)}
                            className={`w-full text-left p-3 rounded-lg transition-all ${
                              selectedPage === page.path 
                                ? 'bg-primary text-primary-foreground' 
                                : 'hover:bg-muted'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{page.name}</span>
                              {hasCustomSeo && (
                                <CheckCircle className={`w-4 h-4 ${selectedPage === page.path ? 'text-primary-foreground' : 'text-green-500'}`} />
                              )}
                            </div>
                            <span className={`text-xs ${selectedPage === page.path ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {page.path}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                {/* Page SEO Editor */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <h3 className="font-semibold">{sitePages.find(p => p.path === selectedPage)?.name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedPage}</p>
                    </div>
                    <Badge variant={currentPageSEO.title || currentPageSEO.description ? 'default' : 'secondary'}>
                      {currentPageSEO.title || currentPageSEO.description ? 'Custom SEO' : 'Using Defaults'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label>Page Title</Label>
                      <Input
                        value={currentPageSEO.title}
                        onChange={(e) => updatePageSEO(selectedPage, 'title', e.target.value)}
                        placeholder={`${sitePages.find(p => p.path === selectedPage)?.name} | ${settings.siteTitle}`}
                      />
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Leave empty to use default</span>
                        <span className={currentPageSEO.title.length > 60 ? 'text-red-500' : 'text-muted-foreground'}>
                          {currentPageSEO.title.length}/60
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Meta Description</Label>
                      <Textarea
                        value={currentPageSEO.description}
                        onChange={(e) => updatePageSEO(selectedPage, 'description', e.target.value)}
                        placeholder="Enter a unique description for this page..."
                        rows={3}
                      />
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Recommended: 120-160 characters</span>
                        <span className={currentPageSEO.description.length > 160 ? 'text-red-500' : 'text-muted-foreground'}>
                          {currentPageSEO.description.length}/160
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Keywords</Label>
                      <Input
                        value={currentPageSEO.keywords}
                        onChange={(e) => updatePageSEO(selectedPage, 'keywords', e.target.value)}
                        placeholder="keyword1, keyword2, keyword3"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>OG Image URL</Label>
                        <Input
                          value={currentPageSEO.ogImage}
                          onChange={(e) => updatePageSEO(selectedPage, 'ogImage', e.target.value)}
                          placeholder="/images/page-og.png"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Canonical URL</Label>
                        <Input
                          value={currentPageSEO.canonicalUrl}
                          onChange={(e) => updatePageSEO(selectedPage, 'canonicalUrl', e.target.value)}
                          placeholder="https://example.com/page"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Schema Type</Label>
                      <Select
                        value={currentPageSEO.schemaType}
                        onValueChange={(value) => updatePageSEO(selectedPage, 'schemaType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WebPage">WebPage</SelectItem>
                          <SelectItem value="Article">Article</SelectItem>
                          <SelectItem value="FAQPage">FAQ Page</SelectItem>
                          <SelectItem value="ContactPage">Contact Page</SelectItem>
                          <SelectItem value="AboutPage">About Page</SelectItem>
                          <SelectItem value="Product">Product</SelectItem>
                          <SelectItem value="Service">Service</SelectItem>
                          <SelectItem value="Organization">Organization</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-6 pt-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={currentPageSEO.noIndex}
                          onCheckedChange={(checked) => updatePageSEO(selectedPage, 'noIndex', checked)}
                        />
                        <Label className="cursor-pointer">No Index</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={currentPageSEO.noFollow}
                          onCheckedChange={(checked) => updatePageSEO(selectedPage, 'noFollow', checked)}
                        />
                        <Label className="cursor-pointer">No Follow</Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meta" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Global Meta Tags</CardTitle>
              <CardDescription>Default SEO meta information (used when pages don't have custom settings)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="siteTitle">Site Title</Label>
                <Input
                  id="siteTitle"
                  value={settings.siteTitle}
                  onChange={(e) => updateSetting('siteTitle', e.target.value)}
                />
                <p className={`text-xs ${settings.siteTitle.length > 60 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {settings.siteTitle.length}/60 characters recommended
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaDescription">Meta Description</Label>
                <Textarea
                  id="metaDescription"
                  value={settings.metaDescription}
                  onChange={(e) => updateSetting('metaDescription', e.target.value)}
                  rows={3}
                />
                <p className={`text-xs ${settings.metaDescription.length > 160 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {settings.metaDescription.length}/160 characters recommended
                </p>
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
              <CardDescription>Custom code injected into the &lt;head&gt; section</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={settings.headerCode}
                onChange={(e) => updateSetting('headerCode', e.target.value)}
                rows={8}
                className="font-mono text-sm"
                placeholder="<!-- Add custom scripts, styles, or meta tags here -->"
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
                placeholder="<!-- Add tracking scripts or chat widgets here -->"
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Custom CSS</CardTitle>
                <CardDescription>Add custom styles</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={settings.customCss}
                  onChange={(e) => updateSetting('customCss', e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                  placeholder="/* Custom CSS */"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom JavaScript</CardTitle>
                <CardDescription>Add custom scripts</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={settings.customJs}
                  onChange={(e) => updateSetting('customJs', e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                  placeholder="// Custom JavaScript"
                />
              </CardContent>
            </Card>
          </div>

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
                placeholder='{"@context": "https://schema.org", "@type": "WebSite"}'
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

          {/* Search Engine Indexing Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Search Engine Indexing
              </CardTitle>
              <CardDescription>
                Notify search engines about content updates and regenerate sitemap
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto-ping toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-ping on content update</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically notify search engines when content changes
                  </p>
                </div>
                <Switch
                  checked={settings.autoPingEnabled || false}
                  onCheckedChange={(checked) => updateSetting('autoPingEnabled', checked)}
                />
              </div>
              
              {/* IndexNow API Key */}
              <div className="space-y-2">
                <Label htmlFor="indexNowKey">IndexNow API Key</Label>
                <Input
                  id="indexNowKey"
                  value={settings.indexNowApiKey || ''}
                  onChange={(e) => updateSetting('indexNowApiKey', e.target.value)}
                  placeholder="Your IndexNow API key (for Bing, Yandex, Seznam)"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Used for instant indexing on Bing, Yandex, and Seznam. 
                  <a 
                    href="https://www.indexnow.org/documentation" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline ml-1"
                  >
                    Learn more about IndexNow
                  </a>
                </p>
              </div>
              
              {/* Manual Actions */}
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={regenerateSitemap} 
                  disabled={isRegeneratingSitemap}
                  variant="outline"
                >
                  {isRegeneratingSitemap ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Regenerate Sitemap
                </Button>
                <Button 
                  onClick={pingSearchEngines} 
                  disabled={isPinging}
                  variant="outline"
                >
                  {isPinging ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Ping Search Engines Now
                </Button>
              </div>
              
              {/* Last Sitemap Generated */}
              {settings.lastSitemapGenerated && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Last sitemap generated: </span>
                  {new Date(settings.lastSitemapGenerated).toLocaleString()}
                </div>
              )}
              
              {/* Ping Status */}
              {settings.lastPingStatus && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <Label className="text-sm font-medium mb-3 block">Last Ping Status</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['google', 'bing', 'yandex', 'seznam'].map((engine) => {
                      const status = settings.lastPingStatus?.[engine as keyof typeof settings.lastPingStatus];
                      return (
                        <div key={engine} className="flex items-center gap-2 p-2 rounded-md bg-background border">
                          {status?.success ? (
                            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="text-sm font-medium capitalize block">{engine}</span>
                            {status?.timestamp && (
                              <span className="text-xs text-muted-foreground truncate block">
                                {new Date(status.timestamp).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSEO;
