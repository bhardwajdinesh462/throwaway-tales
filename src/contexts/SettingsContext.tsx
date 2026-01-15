import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

// Constants for optimized caching
const SETTINGS_CACHE_KEY = 'all_settings_cache';
const SETTINGS_TIMESTAMP_KEY = 'settings_cache_timestamp';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes - only refetch if cache is older
// Types
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

export interface GeneralSettings {
  siteName: string;
  siteTagline: string;
  siteDescription: string;
  contactEmail: string;
  supportEmail: string;
  timezone: string;
  dateFormat: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
}

// Defaults
const defaultAppearance: AppearanceSettings = {
  logoUrl: '',
  faviconUrl: '/nullsto-favicon.png',
  primaryColor: '#0d9488',
  accentColor: '#8b5cf6',
  darkMode: true,
  showAnimations: true,
  customCss: '',
  footerText: '© 2024 Nullsto. All rights reserved.',
};

const defaultGeneral: GeneralSettings = {
  siteName: 'Nullsto',
  siteTagline: 'Protect Your Privacy with Disposable Emails',
  siteDescription: 'Generate instant, anonymous email addresses. Perfect for sign-ups, testing, and keeping your real inbox spam-free.',
  contactEmail: 'contact@nullsto.com',
  supportEmail: 'support@nullsto.com',
  timezone: 'UTC',
  dateFormat: 'YYYY-MM-DD',
  maintenanceMode: false,
  registrationEnabled: true,
};

interface SettingsContextType {
  appearance: AppearanceSettings;
  general: GeneralSettings;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  appearance: defaultAppearance,
  general: defaultGeneral,
  isLoading: true,
  refetch: async () => {},
});

export const useSettings = () => useContext(SettingsContext);

// Storage keys
const APPEARANCE_KEY = 'trashmails_appearance_settings';
const GENERAL_KEY = 'trashmails_general_settings';

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const channelRef = useRef<ReturnType<typeof api.realtime.channel> | null>(null);
  
  // Initialize from localStorage synchronously to prevent flash
  const [appearance, setAppearance] = useState<AppearanceSettings>(() => {
    try {
      const cached = localStorage.getItem(APPEARANCE_KEY);
      if (cached) {
        return { ...defaultAppearance, ...JSON.parse(cached) };
      }
    } catch {}
    return defaultAppearance;
  });

  const [general, setGeneral] = useState<GeneralSettings>(() => {
    try {
      const cached = localStorage.getItem(GENERAL_KEY);
      if (cached) {
        return { ...defaultGeneral, ...JSON.parse(cached) };
      }
    } catch {}
    return defaultGeneral;
  });

  const [isLoading, setIsLoading] = useState(true);

  // Apply critical settings immediately using useLayoutEffect
  useLayoutEffect(() => {
    // Apply favicon immediately
    if (appearance.faviconUrl) {
      let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = appearance.faviconUrl;
    }

    // Apply document title with site name
    if (general.siteName && !document.title.includes(general.siteName)) {
      const currentTitle = document.title;
      if (!currentTitle || currentTitle === 'Vite + React + TS') {
        document.title = `${general.siteName} - ${general.siteTagline}`;
      }
    }
  }, [appearance.faviconUrl, general.siteName, general.siteTagline]);

  // Check if cache is stale
  const isCacheStale = useCallback(() => {
    try {
      const timestamp = localStorage.getItem(SETTINGS_TIMESTAMP_KEY);
      if (!timestamp) return true;
      return Date.now() - parseInt(timestamp, 10) > CACHE_TTL_MS;
    } catch {
      return true;
    }
  }, []);

  // Debounce/cache to prevent excessive API calls
  const lastFetchRef = useRef<number>(0);
  const fetchPromiseRef = useRef<Promise<void> | null>(null);
  const FETCH_COOLDOWN_MS = 10000; // 10 seconds between fetches

  const fetchSettings = useCallback(async (force = false) => {
    const now = Date.now();
    
    // If we're already fetching, return the existing promise
    if (fetchPromiseRef.current) {
      return fetchPromiseRef.current;
    }
    
    // Skip if we fetched recently (unless forced) AND cache is not stale
    if (!force && now - lastFetchRef.current < FETCH_COOLDOWN_MS && !isCacheStale()) {
      setIsLoading(false);
      return;
    }
    
    lastFetchRef.current = now;
    
    fetchPromiseRef.current = (async () => {
      try {
        // Try batch endpoint first (more efficient - single request)
        const batchResponse = await fetch(
          `${api.baseUrl}/data/settings/batch?keys=appearance,general,announcement_settings,limit_modal_config`,
          { 
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          }
        );
        
        if (batchResponse.ok) {
          const result = await batchResponse.json();
          const settingsData = result.data || [];
          
          // Process batch response
          for (const row of settingsData) {
            const key = row.key;
            const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
            
            if (key === 'appearance') {
              const merged = { ...defaultAppearance, ...value };
              setAppearance(merged);
              storage.set(APPEARANCE_KEY, merged);
            } else if (key === 'general') {
              const merged = { ...defaultGeneral, ...value };
              setGeneral(merged);
              storage.set(GENERAL_KEY, merged);
            }
          }
          
          // Update cache timestamp
          localStorage.setItem(SETTINGS_TIMESTAMP_KEY, now.toString());
        } else {
          // Fallback to individual queries if batch endpoint not available
          const [appearanceRes, generalRes] = await Promise.all([
            api.db.query<{ value: AppearanceSettings }[]>('app_settings', {
              select: 'value',
              filter: { key: 'appearance' },
              order: { column: 'updated_at', ascending: false },
              limit: 1,
            }),
            api.db.query<{ value: GeneralSettings }[]>('app_settings', {
              select: 'value',
              filter: { key: 'general' },
              order: { column: 'updated_at', ascending: false },
              limit: 1,
            }),
          ]);

          // Update appearance
          if (!appearanceRes.error && appearanceRes.data?.[0]?.value) {
            const merged = { ...defaultAppearance, ...appearanceRes.data[0].value };
            setAppearance(merged);
            storage.set(APPEARANCE_KEY, merged);
          }

          // Update general
          if (!generalRes.error && generalRes.data?.[0]?.value) {
            const merged = { ...defaultGeneral, ...generalRes.data[0].value };
            setGeneral(merged);
            storage.set(GENERAL_KEY, merged);
          }
          
          localStorage.setItem(SETTINGS_TIMESTAMP_KEY, now.toString());
        }
      } catch (e) {
        console.error('Error fetching settings:', e);
        // Use cached values on error - they're already set from localStorage
      } finally {
        setIsLoading(false);
        fetchPromiseRef.current = null;
      }
    })();
    
    return fetchPromiseRef.current;
  }, [isCacheStale]);

  useEffect(() => {
    fetchSettings();

    // Subscribe to real-time updates on app_settings for instant admin sync
    const channel = api.realtime
      .channel('settings-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings'
        },
        () => {
          console.log('[SettingsContext] Settings changed, refetching...');
          fetchSettings(true); // Force refetch on realtime update
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

  return (
    <SettingsContext.Provider value={{ appearance, general, isLoading, refetch: () => fetchSettings(true) }}>
      {children}
    </SettingsContext.Provider>
  );
};
