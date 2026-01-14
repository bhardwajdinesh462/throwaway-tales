import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

const APPEARANCE_SETTINGS_KEY = 'trashmails_appearance_settings';

export interface AppearanceSettings {
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
  logoUrl: '',
  faviconUrl: '/nullsto-favicon.png',
  primaryColor: '#0d9488',
  accentColor: '#8b5cf6',
  darkMode: true,
  showAnimations: true,
  customCss: '',
  footerText: '© 2024 Nullsto. All rights reserved.',
};

// Cache buster timestamp - updates on each settings change
let globalCacheBuster = Date.now();

export const useAppearanceSettings = () => {
  const [settings, setSettings] = useState<AppearanceSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const cacheBusterRef = useRef(globalCacheBuster);
  const channelRef = useRef<ReturnType<typeof api.realtime.channel> | null>(null);

  // Helper to add cache buster to URLs
  const addCacheBuster = (url: string): string => {
    if (!url) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${cacheBusterRef.current}`;
  };

  useEffect(() => {
    const loadSettings = async (attempt = 0) => {
      const maxRetries = 3;
      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
      
      try {
        const { data: queryData, error } = await api.db.query<{ value: AppearanceSettings; updated_at: string }[]>('app_settings', {
          select: 'value, updated_at',
          filter: { key: 'appearance' },
          order: { column: 'updated_at', ascending: false },
          limit: 1,
        });
        const data = queryData && queryData.length > 0 ? queryData[0] : null;

        if (!error && data?.value) {
          const dbSettings = data.value as unknown as AppearanceSettings;
          const merged = { ...defaultSettings, ...dbSettings };
          setSettings(merged);
          storage.set(APPEARANCE_SETTINGS_KEY, merged);
        } else if (error) {
          const isRetryable = error.message?.includes('Failed to fetch') || 
                              error.message?.includes('fetch');
          if (isRetryable && attempt < maxRetries) {
            setTimeout(() => loadSettings(attempt + 1), backoffMs);
            return;
          }
          const localSettings = storage.get<AppearanceSettings>(APPEARANCE_SETTINGS_KEY, defaultSettings);
          setSettings(localSettings);
        } else {
          const localSettings = storage.get<AppearanceSettings>(APPEARANCE_SETTINGS_KEY, defaultSettings);
          setSettings(localSettings);
        }
      } catch (e) {
        console.error('Error loading appearance settings:', e);
        if (attempt < maxRetries) {
          setTimeout(() => loadSettings(attempt + 1), backoffMs);
          return;
        }
        const localSettings = storage.get<AppearanceSettings>(APPEARANCE_SETTINGS_KEY, defaultSettings);
        setSettings(localSettings);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();

    // Real-time subscription for instant updates across all tabs
    const channel = api.realtime
      .channel('appearance-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.appearance'
        },
        (payload) => {
          console.log('Appearance settings updated:', payload);
          if (payload.new && (payload.new as any).value) {
            const newSettings = (payload.new as any).value as AppearanceSettings;
            const merged = { ...defaultSettings, ...newSettings };
            // Update cache buster for new images
            cacheBusterRef.current = Date.now();
            globalCacheBuster = cacheBusterRef.current;
            setSettings(merged);
            storage.set(APPEARANCE_SETTINGS_KEY, merged);
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
  }, []);

  // Apply favicon dynamically with cache busting
  useEffect(() => {
    if (settings.faviconUrl) {
      // Remove all existing favicon links
      const existingLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
      existingLinks.forEach(link => link.remove());
      
      // Create new favicon link with cache busting
      const faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      faviconLink.type = 'image/x-icon';
      faviconLink.href = addCacheBuster(settings.faviconUrl);
      document.head.appendChild(faviconLink);
    }
  }, [settings.faviconUrl]);

  // Return settings with cache-busted URLs for logo
  const settingsWithCacheBusting = {
    ...settings,
    logoUrl: settings.logoUrl ? addCacheBuster(settings.logoUrl) : settings.logoUrl,
  };

  return { settings: settingsWithCacheBusting, isLoading, refetch: () => {} };
};

export default useAppearanceSettings;
