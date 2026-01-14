import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

const USER_SETTINGS_KEY = 'trashmails_user_settings';

export interface UserSettings {
  allowGuestAccess: boolean;
  guestEmailLimit: number;
  guestEmailDuration: number;
  userEmailLimit: number;
  userEmailDuration: number;
  requireEmailVerification: boolean;
  allowSocialLogin: boolean;
  allowPasswordReset: boolean;
  sessionTimeout: number;
  maxSavedEmails: number;
  // AI Summary settings
  aiSummaryEnabled: boolean;
  guestAiSummaryLimit: number;
  userAiSummaryLimit: number;
}

const defaultSettings: UserSettings = {
  allowGuestAccess: true,
  guestEmailLimit: 5,
  guestEmailDuration: 60,
  userEmailLimit: 50,
  userEmailDuration: 1440,
  requireEmailVerification: false,
  allowSocialLogin: true,
  allowPasswordReset: true,
  sessionTimeout: 1440,
  maxSavedEmails: 100,
  // AI Summary defaults - these are FALLBACKS only; subscription_tiers takes precedence
  aiSummaryEnabled: true,
  guestAiSummaryLimit: 0, // Default to 0 - let subscription_tiers control this
  userAiSummaryLimit: 0, // Default to 0 - let subscription_tiers control this
};

export const useUserSettings = () => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = async () => {
    try {
      const { data, error } = await api.db.query<{ value: UserSettings }[]>('app_settings', {
        filter: { key: 'user_settings' },
        order: { column: 'updated_at', ascending: false },
        limit: 1
      });

      if (!error && data && data.length > 0) {
        const dbSettings = data[0].value as unknown as UserSettings;
        const merged = { ...defaultSettings, ...dbSettings };
        setSettings(merged);
        storage.set(USER_SETTINGS_KEY, merged);
      } else {
        const localSettings = storage.get<UserSettings>(USER_SETTINGS_KEY, defaultSettings);
        setSettings(localSettings);
      }
    } catch (e) {
      console.error('Error loading user settings:', e);
      const localSettings = storage.get<UserSettings>(USER_SETTINGS_KEY, defaultSettings);
      setSettings(localSettings);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return { settings, isLoading, refetch: loadSettings };
};

export default useUserSettings;
