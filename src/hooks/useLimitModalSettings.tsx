import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export interface LimitModalConfig {
  enabled: boolean;
  title: string;
  description: string;
  ctaText: string;
  showTimer: boolean;
  showBenefits: boolean;
  theme: 'default' | 'urgent' | 'friendly';
}

export const defaultLimitModalConfig: LimitModalConfig = {
  enabled: true,
  title: 'Daily Limit Reached',
  description: "You've used all {limit} temporary emails for today",
  ctaText: 'Upgrade Now',
  showTimer: true,
  showBenefits: true,
  theme: 'default',
};

export const useLimitModalSettings = () => {
  const [config, setConfig] = useState<LimitModalConfig>(defaultLimitModalConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const { data } = await api.db.query<{ value: Partial<LimitModalConfig> }[]>('app_settings', {
        select: 'value',
        filter: { key: 'limit_modal_config' },
        limit: 1,
      });
      
      if (data && data.length > 0 && data[0].value && typeof data[0].value === 'object') {
        setConfig({ ...defaultLimitModalConfig, ...data[0].value });
      }
    } catch (err) {
      console.error('Failed to load limit modal config:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = async (newConfig: LimitModalConfig) => {
    setIsSaving(true);
    try {
      const { data: existing } = await api.db.query<{ id: string }[]>('app_settings', {
        select: 'id',
        filter: { key: 'limit_modal_config' },
        limit: 1,
      });

      const configJson = JSON.parse(JSON.stringify(newConfig));

      let error;
      if (existing && existing.length > 0) {
        const result = await api.db.update('app_settings', {
          value: configJson,
          updated_at: new Date().toISOString(),
        }, { key: 'limit_modal_config' });
        error = result.error;
      } else {
        const result = await api.db.insert('app_settings', {
          key: 'limit_modal_config',
          value: configJson,
        });
        error = result.error;
      }

      if (error) {
        throw error;
      }

      setConfig(newConfig);
      return true;
    } catch (err) {
      console.error('Failed to save limit modal config:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfig = <K extends keyof LimitModalConfig>(key: K, value: LimitModalConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return {
    config,
    isLoading,
    isSaving,
    updateConfig,
    saveConfig,
    loadConfig,
  };
};

export default useLimitModalSettings;
