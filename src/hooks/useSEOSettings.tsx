import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/lib/storage';

const SEO_SETTINGS_KEY = 'trashmails_seo_settings';

export interface PageSEO {
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
  noIndex: boolean;
  noFollow: boolean;
  canonicalUrl: string;
  schemaType: string;
}

export interface SEOSettings {
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
}

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

export const useSEOSettings = () => {
  const [settings, setSettings] = useState<SEOSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Always fetch fresh from database to ensure admin changes are reflected
        const { data, error } = await supabase
          .from('app_settings')
          .select('value, updated_at')
          .eq('key', 'seo')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.value) {
          const dbSettings = data.value as unknown as SEOSettings;
          const merged = { ...defaultSettings, ...dbSettings, pages: { ...defaultSettings.pages, ...dbSettings.pages } };
          setSettings(merged);
          // Update local storage cache with latest
          storage.set(SEO_SETTINGS_KEY, merged);
        } else {
          // Fallback to local storage only if database fails
          const localSettings = storage.get<SEOSettings>(SEO_SETTINGS_KEY, defaultSettings);
          setSettings(localSettings);
        }
      } catch (e) {
        console.error('Error loading SEO settings:', e);
        const localSettings = storage.get<SEOSettings>(SEO_SETTINGS_KEY, defaultSettings);
        setSettings(localSettings);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const getPageSEO = (path: string): PageSEO => {
    return settings.pages[path] || { ...defaultPageSEO };
  };

  return { settings, isLoading, getPageSEO, defaultPageSEO };
};

export default useSEOSettings;
