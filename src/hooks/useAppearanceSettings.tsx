import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

export const useAppearanceSettings = () => {
  const [settings, setSettings] = useState<AppearanceSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value, updated_at')
          .eq('key', 'appearance')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.value) {
          const dbSettings = data.value as unknown as AppearanceSettings;
          const merged = { ...defaultSettings, ...dbSettings };
          setSettings(merged);
          storage.set(APPEARANCE_SETTINGS_KEY, merged);
        } else {
          const localSettings = storage.get<AppearanceSettings>(APPEARANCE_SETTINGS_KEY, defaultSettings);
          setSettings(localSettings);
        }
      } catch (e) {
        console.error('Error loading appearance settings:', e);
        const localSettings = storage.get<AppearanceSettings>(APPEARANCE_SETTINGS_KEY, defaultSettings);
        setSettings(localSettings);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();

    // Real-time subscription for instant updates across all tabs
    const channel = supabase
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
            setSettings(merged);
            storage.set(APPEARANCE_SETTINGS_KEY, merged);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Apply favicon dynamically
  useEffect(() => {
    if (settings.faviconUrl) {
      let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = settings.faviconUrl;
    }
  }, [settings.faviconUrl]);

  return { settings, isLoading };
};

export default useAppearanceSettings;
