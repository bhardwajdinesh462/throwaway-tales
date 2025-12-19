import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useSupabaseAuth';

interface TwoFactorSettings {
  id: string;
  user_id: string;
  is_enabled: boolean;
  backup_codes: string[];
}

export const use2FA = () => {
  const { user, session } = useAuth();
  const [settings, setSettings] = useState<TwoFactorSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_2fa')
        .select('id, user_id, is_enabled, backup_codes')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching 2FA settings:', error);
      }
      setSettings(data as TwoFactorSettings | null);
    } catch (e) {
      console.error('Error fetching 2FA settings:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const callSecure2FA = async (action: string, params: Record<string, unknown> = {}) => {
    if (!session?.access_token) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('secure-2fa', {
        body: { action, ...params },
      });

      if (error) {
        console.error('Secure 2FA error:', error);
        return { success: false, error: error.message };
      }

      return data;
    } catch (e: unknown) {
      console.error('Error calling secure-2fa:', e);
      return { success: false, error: e instanceof Error ? e.message : 'Failed to call secure 2FA' };
    }
  };

  const setup2FA = async () => {
    if (!user) return { success: false, error: 'Not authenticated' };

    const result = await callSecure2FA('setup');
    if (result.success) {
      await fetchSettings();
    }
    return result;
  };

  const verifyAndEnable2FA = async (code: string, secret: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    const result = await callSecure2FA('enable', { code, secret });
    if (result.success) {
      await fetchSettings();
    }
    return result;
  };

  const disable2FA = async () => {
    if (!user) return { success: false, error: 'Not authenticated' };

    const result = await callSecure2FA('disable');
    if (result.success) {
      await fetchSettings();
    }
    return result;
  };

  const verifyCode = async (code: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    return await callSecure2FA('verify', { code });
  };

  return {
    settings,
    isLoading,
    isEnabled: settings?.is_enabled ?? false,
    setup2FA,
    verifyAndEnable2FA,
    disable2FA,
    verifyCode,
    refetch: fetchSettings,
  };
};

export default use2FA;
