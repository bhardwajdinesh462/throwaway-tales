import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

const GENERAL_SETTINGS_KEY = 'trashmails_general_settings';

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

const defaultSettings: GeneralSettings = {
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

export const useGeneralSettings = () => {
  const [settings, setSettings] = useState<GeneralSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof api.realtime.channel> | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await api.db.query<{ value: GeneralSettings; updated_at: string }[]>('app_settings', {
          select: 'value, updated_at',
          filter: { key: 'general' },
          order: { column: 'updated_at', ascending: false },
          limit: 1,
        });

        if (!error && data && data.length > 0 && data[0].value) {
          const dbSettings = data[0].value;
          const merged = { ...defaultSettings, ...dbSettings };
          setSettings(merged);
          storage.set(GENERAL_SETTINGS_KEY, merged);
        } else {
          const localSettings = storage.get<GeneralSettings>(GENERAL_SETTINGS_KEY, defaultSettings);
          setSettings(localSettings);
        }
      } catch (e) {
        console.error('Error loading general settings:', e);
        const localSettings = storage.get<GeneralSettings>(GENERAL_SETTINGS_KEY, defaultSettings);
        setSettings(localSettings);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();

    // Real-time subscription for instant updates across all tabs
    const channel = api.realtime
      .channel('general-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.general'
        },
        (payload) => {
          console.log('General settings updated:', payload);
          if (payload.new && (payload.new as any).value) {
            const newSettings = (payload.new as any).value as GeneralSettings;
            const merged = { ...defaultSettings, ...newSettings };
            setSettings(merged);
            storage.set(GENERAL_SETTINGS_KEY, merged);
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

  return { settings, isLoading };
};

export default useGeneralSettings;
