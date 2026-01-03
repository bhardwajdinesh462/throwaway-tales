import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'limit_modal_config')
        .maybeSingle();
      
      if (data?.value && typeof data.value === 'object') {
        setConfig({ ...defaultLimitModalConfig, ...data.value as Partial<LimitModalConfig> });
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
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'limit_modal_config')
        .maybeSingle();

      const configJson = JSON.parse(JSON.stringify(newConfig));

      let error;
      if (existing) {
        const result = await supabase
          .from('app_settings')
          .update({
            value: configJson,
            updated_at: new Date().toISOString(),
          })
          .eq('key', 'limit_modal_config');
        error = result.error;
      } else {
        const result = await supabase
          .from('app_settings')
          .insert([{
            key: 'limit_modal_config',
            value: configJson,
          }]);
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
