import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
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
  const channelRef = useRef<ReturnType<typeof api.realtime.channel> | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const { data: queryData, error } = await api.db.query<{ value: SEOSettings; updated_at: string }[]>('app_settings', {
        select: 'value, updated_at',
        filter: { key: 'seo' },
        order: { column: 'updated_at', ascending: false },
        limit: 1,
      });
      const data = queryData && queryData.length > 0 ? queryData[0] : null;

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
  }, []);

  useEffect(() => {
    fetchSettings();

    // Subscribe to real-time updates on app_settings for SEO changes
    const channel = api.realtime
      .channel('seo-settings-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
        },
        (payload) => {
          // Check if the change is for 'seo' key
          const newRecord = payload.new as { key?: string; value?: unknown } | undefined;
          if (newRecord?.key === 'seo') {
            console.log('[useSEOSettings] SEO settings changed in database, refetching...');
            fetchSettings();
          }
        }
      );

    channelRef.current = channel;
    channel.subscribe();

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [fetchSettings]);

  // Path compatibility mapping for old vs new routes
  const PATH_COMPAT_MAP: Record<string, string> = {
    '/privacy': '/privacy-policy',
    '/terms': '/terms-of-service',
    '/cookies': '/cookie-policy',
    '/features': '/premium-features',
  };

  const getPageSEO = useCallback((path: string): PageSEO => {
    // Try direct path first
    if (settings.pages[path]) {
      return settings.pages[path];
    }
    // Try compat mapping (old path might have settings saved)
    const compatPath = PATH_COMPAT_MAP[path];
    if (compatPath && settings.pages[compatPath]) {
      return settings.pages[compatPath];
    }
    // Try reverse compat (new path might have settings, looking up old)
    const reverseEntry = Object.entries(PATH_COMPAT_MAP).find(([_, v]) => v === path);
    if (reverseEntry && settings.pages[reverseEntry[0]]) {
      return settings.pages[reverseEntry[0]];
    }
    return { ...defaultPageSEO };
  }, [settings.pages]);

  return { settings, isLoading, getPageSEO, defaultPageSEO, refetch: fetchSettings };
};

export default useSEOSettings;
