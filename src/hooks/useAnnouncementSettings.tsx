import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';

export interface AnnouncementSettings {
  isEnabled: boolean;
  badgeText: string;
  mainMessage: string;
  ctaText: string;
  ctaLink: string;
  showTelegramButton: boolean;
  telegramText: string;
  telegramLink: string;
}

const defaultSettings: AnnouncementSettings = {
  isEnabled: true,
  badgeText: 'New',
  mainMessage: 'Guest can create 5 free Emails in a day',
  ctaText: 'Premium Plan is live!',
  ctaLink: '',
  showTelegramButton: true,
  telegramText: 'Contact on Telegram',
  telegramLink: 'https://t.me/nullstoemail',
};

export const useAnnouncementSettings = () => {
  const [settings, setSettings] = useState<AnnouncementSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof api.realtime.channel> | null>(null);

  const fetchSettings = async () => {
    try {
      const { data, error } = await api.db.query<{ value: AnnouncementSettings }[]>('app_settings', {
        select: 'value',
        filter: { key: 'announcement_settings' },
        order: { column: 'updated_at', ascending: false },
        limit: 1,
      });

      if (!error && data && data.length > 0 && data[0].value) {
        const dbSettings = data[0].value;
        setSettings({ ...defaultSettings, ...dbSettings });
      }
    } catch (e) {
      console.error('Error loading announcement settings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();

    // Real-time subscription for instant updates across all tabs
    const channel = api.realtime
      .channel('announcement-admin-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.announcement_settings'
        },
        (payload) => {
          console.log('Announcement settings updated (admin hook):', payload);
          if (payload.new && (payload.new as any).value) {
            const newSettings = (payload.new as any).value as AnnouncementSettings;
            setSettings({ ...defaultSettings, ...newSettings });
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

  const updateSettings = async (newSettings: Partial<AnnouncementSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    
    try {
      const { data: existing } = await api.db.query<{ id: string }[]>('app_settings', {
        select: 'id',
        filter: { key: 'announcement_settings' },
        limit: 1,
      });

      const settingsJson = JSON.parse(JSON.stringify(updatedSettings));

      if (existing && existing.length > 0) {
        await api.db.update('app_settings', {
          value: settingsJson,
          updated_at: new Date().toISOString(),
        }, { key: 'announcement_settings' });
      } else {
        await api.db.insert('app_settings', {
          key: 'announcement_settings',
          value: settingsJson,
        });
      }

      setSettings(updatedSettings);
      return { success: true };
    } catch (e) {
      console.error('Error saving announcement settings:', e);
      return { success: false, error: e };
    }
  };

  return { settings, isLoading, updateSettings, refetch: fetchSettings };
};

export default useAnnouncementSettings;
