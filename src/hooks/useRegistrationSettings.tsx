import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export interface RegistrationSettings {
  allowRegistration: boolean;
  registrationMessage: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  requireEmailConfirmation: boolean;
}

const defaultSettings: RegistrationSettings = {
  allowRegistration: true,
  registrationMessage: 'Registration is currently disabled. Please try again later.',
  maintenanceMode: false,
  maintenanceMessage: 'The site is under maintenance. Please check back later.',
  requireEmailConfirmation: false,
};

export const useRegistrationSettings = () => {
  const [settings, setSettings] = useState<RegistrationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data, error } = await api.db.query<{ value: RegistrationSettings }[]>('app_settings', {
        select: 'value',
        filter: { key: 'registration_settings' },
        order: { column: 'updated_at', ascending: false },
        limit: 1,
      });

      if (!error && data && data.length > 0 && data[0].value) {
        const dbSettings = data[0].value;
        setSettings({ ...defaultSettings, ...dbSettings });
      }
    } catch (e) {
      console.error('Error loading registration settings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<RegistrationSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    
    try {
      const { data: existing } = await api.db.query<{ id: string }[]>('app_settings', {
        select: 'id',
        filter: { key: 'registration_settings' },
        limit: 1,
      });

      const settingsJson = JSON.parse(JSON.stringify(updatedSettings));

      if (existing && existing.length > 0) {
        await api.db.update('app_settings', {
          value: settingsJson,
          updated_at: new Date().toISOString(),
        }, { key: 'registration_settings' });
      } else {
        await api.db.insert('app_settings', {
          key: 'registration_settings',
          value: settingsJson,
        });
      }

      setSettings(updatedSettings);
      return { success: true };
    } catch (e) {
      console.error('Error saving registration settings:', e);
      return { success: false, error: e };
    }
  };

  return { settings, isLoading, updateSettings, refetch: fetchSettings };
};

export default useRegistrationSettings;
