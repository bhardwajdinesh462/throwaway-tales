import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/lib/api';

export interface PaymentSettings {
  stripeEnabled: boolean;
  stripePublishableKey: string;
  paypalEnabled: boolean;
  paypalClientId: string;
  paypalMode: 'sandbox' | 'live';
  telegramUpgradeEnabled: boolean;
  telegramLink: string;
  defaultPaymentMethod: 'stripe' | 'paypal' | 'telegram';
  testMode: boolean;
  currency: string;
}

const defaultSettings: PaymentSettings = {
  stripeEnabled: false,
  stripePublishableKey: '',
  paypalEnabled: false,
  paypalClientId: '',
  paypalMode: 'sandbox',
  telegramUpgradeEnabled: true,
  telegramLink: 'https://t.me/digitalselling023',
  defaultPaymentMethod: 'telegram',
  testMode: true,
  currency: 'usd',
};

export function usePaymentSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error, refetch } = useQuery({
    queryKey: ['payment_settings'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'payment_settings')
          .maybeSingle();

        if (error) {
          console.error('[usePaymentSettings] Error fetching settings:', error);
          return defaultSettings;
        }

        if (data?.value) {
          const dbSettings = data.value as unknown as Partial<PaymentSettings>;
          return { ...defaultSettings, ...dbSettings };
        }

        return defaultSettings;
      } catch (e) {
        console.error('[usePaymentSettings] Exception:', e);
        return defaultSettings;
      }
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  // Subscribe to real-time changes
  useEffect(() => {
    const channel = supabase
      .channel('payment_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.payment_settings',
        },
        () => {
          console.log('[usePaymentSettings] Settings changed, refetching...');
          queryClient.invalidateQueries({ queryKey: ['payment_settings'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Listen for custom settings-changed event
  useEffect(() => {
    const handleSettingsChange = () => {
      refetch();
    };

    window.addEventListener('settings-changed', handleSettingsChange);
    return () => window.removeEventListener('settings-changed', handleSettingsChange);
  }, [refetch]);

  const currentSettings = settings || defaultSettings;

  return {
    settings: currentSettings,
    isLoading,
    error,
    refetch,
    // Convenience properties
    stripeEnabled: currentSettings.stripeEnabled,
    paypalEnabled: currentSettings.paypalEnabled,
    telegramEnabled: currentSettings.telegramUpgradeEnabled,
    telegramLink: currentSettings.telegramLink || 'https://t.me/digitalselling023',
    defaultPaymentMethod: currentSettings.defaultPaymentMethod,
    hasAnyPaymentMethod: currentSettings.stripeEnabled || currentSettings.paypalEnabled || currentSettings.telegramUpgradeEnabled,
    hasPaidPaymentMethod: currentSettings.stripeEnabled || currentSettings.paypalEnabled,
  };
}

export default usePaymentSettings;
