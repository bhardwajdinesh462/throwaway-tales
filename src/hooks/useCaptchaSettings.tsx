import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export interface CaptchaSettings {
  enabled: boolean;
  provider: 'recaptcha' | 'hcaptcha' | 'turnstile' | 'none';
  siteKey: string;
  secretKey: string;
  enableOnLogin: boolean;
  enableOnRegister: boolean;
  enableOnContact: boolean;
  enableOnEmailGen: boolean;
  threshold: number;
}

const defaultSettings: CaptchaSettings = {
  enabled: false,
  provider: 'recaptcha',
  siteKey: '',
  secretKey: '',
  enableOnLogin: true,
  enableOnRegister: true,
  enableOnContact: true,
  enableOnEmailGen: false,
  threshold: 0.5,
};

const SETTINGS_KEY = 'captcha_settings';

export const useCaptchaSettings = () => {
  const queryClient = useQueryClient();

  const { data: settings = defaultSettings, isLoading } = useQuery({
    queryKey: ['app_settings', SETTINGS_KEY],
    queryFn: async () => {
      const { data, error } = await api.db.query<{ value: CaptchaSettings }[]>('app_settings', {
        select: 'value',
        filter: { key: SETTINGS_KEY },
        limit: 1,
      });

      if (error) {
        console.error('Error fetching captcha settings:', error);
        return defaultSettings;
      }

      if (data && data.length > 0 && data[0].value) {
        return { ...defaultSettings, ...data[0].value };
      }
      return defaultSettings;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - prevents refetching on tab switches
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });

  const updateMutation = useMutation({
    mutationFn: async (newSettings: Partial<CaptchaSettings>) => {
      const updatedSettings = { ...settings, ...newSettings };
      
      const { data: existing } = await api.db.query<{ id: string }[]>('app_settings', {
        select: 'id',
        filter: { key: SETTINGS_KEY },
        limit: 1,
      });

      const settingsJson = JSON.parse(JSON.stringify(updatedSettings));

      if (existing && existing.length > 0) {
        const { error } = await api.db.update('app_settings', {
          value: settingsJson,
          updated_at: new Date().toISOString(),
        }, { key: SETTINGS_KEY });
        
        if (error) throw error;
      } else {
        const { error } = await api.db.insert('app_settings', {
          key: SETTINGS_KEY,
          value: settingsJson,
        });
        
        if (error) throw error;
      }

      return updatedSettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['app_settings', SETTINGS_KEY], data);
      toast.success('Captcha settings saved!');
    },
    onError: (error: any) => {
      console.error('Error saving captcha settings:', error);
      toast.error('Failed to save captcha settings');
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateMutation.mutateAsync,
    isSaving: updateMutation.isPending,
  };
};

export default useCaptchaSettings;
