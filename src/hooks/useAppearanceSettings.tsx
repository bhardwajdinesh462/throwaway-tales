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
  const lastFetchRef = useRef<number>(0);
  const fetchPromiseRef = useRef<Promise<void> | null>(null);
  const FETCH_COOLDOWN_MS = 30000; // 30 seconds between fetches

  // Helper to add cache buster to URLs
  const addCacheBuster = (url: string): string => {
    if (!url) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${cacheBusterRef.current}`;
  };

  useEffect(() => {
    const loadSettings = async (force = false) => {
      const now = Date.now();
      
      // Return existing promise if already fetching
      if (fetchPromiseRef.current) {
        return fetchPromiseRef.current;
      }
      
      // Skip if fetched recently (unless forced)
      if (!force && now - lastFetchRef.current < FETCH_COOLDOWN_MS) {
        setIsLoading(false);
        return;
      }
      
      lastFetchRef.current = now;
      
      fetchPromiseRef.current = (async () => {
        try {
          // Try batch endpoint first for efficiency
          const response = await fetch(
            `${api.baseUrl}/data/settings/batch?keys=appearance`,
            { 
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include'
            }
          );
          
          if (response.ok) {
            const result = await response.json();
            const appearanceRow = result.data?.find((r: any) => r.key === 'appearance');
            if (appearanceRow?.value) {
              const value = typeof appearanceRow.value === 'string' 
                ? JSON.parse(appearanceRow.value) 
                : appearanceRow.value;
              const merged = { ...defaultSettings, ...value };
              setSettings(merged);
              storage.set(APPEARANCE_SETTINGS_KEY, merged);
            }
          } else {
            // Fallback to individual query
            const { data, error } = await api.db.query<{ value: AppearanceSettings }[]>('app_settings', {
              select: 'value',
              filter: { key: 'appearance' },
              order: { column: 'updated_at', ascending: false },
              limit: 1,
            });

            if (!error && data?.[0]?.value) {
              const merged = { ...defaultSettings, ...data[0].value };
              setSettings(merged);
              storage.set(APPEARANCE_SETTINGS_KEY, merged);
            } else {
              // Use local cache on error
              const localSettings = storage.get<AppearanceSettings>(APPEARANCE_SETTINGS_KEY, defaultSettings);
              setSettings(localSettings);
            }
          }
        } catch (e) {
          console.error('Error loading appearance settings:', e);
          const localSettings = storage.get<AppearanceSettings>(APPEARANCE_SETTINGS_KEY, defaultSettings);
          setSettings(localSettings);
        } finally {
          setIsLoading(false);
          fetchPromiseRef.current = null;
        }
      })();
      
      return fetchPromiseRef.current;
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
