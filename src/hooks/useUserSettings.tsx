import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  // AI Summary defaults
  aiSummaryEnabled: true,
  guestAiSummaryLimit: 3,
  userAiSummaryLimit: 10,
};

export const useUserSettings = () => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'user_settings')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.value) {
        const dbSettings = data.value as unknown as UserSettings;
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
