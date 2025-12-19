import React, { createContext, useContext, useState, useEffect, useLayoutEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/lib/storage';

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

  const fetchSettings = async () => {
    try {
      // Fetch both settings in parallel
      const [appearanceRes, generalRes] = await Promise.all([
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'appearance')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'general')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      // Update appearance
      if (!appearanceRes.error && appearanceRes.data?.value) {
        const dbAppearance = appearanceRes.data.value as unknown as AppearanceSettings;
        const merged = { ...defaultAppearance, ...dbAppearance };
        setAppearance(merged);
        storage.set(APPEARANCE_KEY, merged);
      }

      // Update general
      if (!generalRes.error && generalRes.data?.value) {
        const dbGeneral = generalRes.data.value as unknown as GeneralSettings;
        const merged = { ...defaultGeneral, ...dbGeneral };
        setGeneral(merged);
        storage.set(GENERAL_KEY, merged);
      }
    } catch (e) {
      console.error('Error fetching settings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ appearance, general, isLoading, refetch: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};