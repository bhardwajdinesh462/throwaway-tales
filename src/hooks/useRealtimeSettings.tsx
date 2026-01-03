import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { db, api } from '@/lib/api';

interface SettingsTimestamp {
  key: string;
  updated_at: string;
}

interface UseRealtimeSettingsOptions {
  pollInterval?: number; // Default 30 seconds
  enabled?: boolean;
}

/**
 * Hook that provides real-time settings sync for PHP backend using polling mechanism.
 * When settings change (detected via timestamp comparison), it invalidates React Query caches.
 */
export function useRealtimeSettings(options: UseRealtimeSettingsOptions = {}) {
  const { pollInterval = 30000, enabled = true } = options;
  const queryClient = useQueryClient();
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const timestampsRef = useRef<Map<string, string>>(new Map());
  const isVisibleRef = useRef(true);

  // Track page visibility to pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchSettingsTimestamps = useCallback(async (): Promise<SettingsTimestamp[]> => {
    try {
      const result = await db.query<SettingsTimestamp[]>('app_settings', { select: 'key,updated_at' });
      if (result.error || !result.data) {
        return [];
      }
      return Array.isArray(result.data) ? result.data : [];
    } catch (error) {
      console.error('[useRealtimeSettings] Error fetching timestamps:', error);
      return [];
    }
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (!enabled || !isVisibleRef.current || isPolling) return;
    
    setIsPolling(true);
    
    try {
      const timestamps = await fetchSettingsTimestamps();
      let hasChanges = false;
      
      for (const item of timestamps) {
        const storedTimestamp = timestampsRef.current.get(item.key);
        
        if (storedTimestamp && storedTimestamp !== item.updated_at) {
          hasChanges = true;
          console.log(`[useRealtimeSettings] Settings changed: ${item.key}`);
        }
        
        timestampsRef.current.set(item.key, item.updated_at);
      }
      
      if (hasChanges) {
        // Invalidate all settings-related queries
        await queryClient.invalidateQueries({ queryKey: ['settings'] });
        await queryClient.invalidateQueries({ queryKey: ['app_settings'] });
        await queryClient.invalidateQueries({ queryKey: ['appearance'] });
        await queryClient.invalidateQueries({ queryKey: ['general'] });
        await queryClient.invalidateQueries({ queryKey: ['seo'] });
        await queryClient.invalidateQueries({ queryKey: ['announcement'] });
        await queryClient.invalidateQueries({ queryKey: ['captcha'] });
        await queryClient.invalidateQueries({ queryKey: ['registration'] });
        await queryClient.invalidateQueries({ queryKey: ['subscription_tiers'] });
        await queryClient.invalidateQueries({ queryKey: ['rate_limits'] });
        await queryClient.invalidateQueries({ queryKey: ['payment_settings'] });
        
        // Clear localStorage caches
        const keysToInvalidate = [
          'trashmails_settings',
          'trashmails_appearance',
          'trashmails_general',
          'trashmails_seo_settings',
          'trashmails_announcement_settings',
          'trashmails_captcha_settings',
          'trashmails_registration_settings',
          'SITE_NAME',
        ];
        
        keysToInvalidate.forEach(key => localStorage.removeItem(key));
        
        // Dispatch custom event for components listening to settings changes
        window.dispatchEvent(new CustomEvent('settings-changed', { detail: { timestamps } }));
      }
      
      setLastSync(new Date());
    } catch (error) {
      console.error('[useRealtimeSettings] Error checking for updates:', error);
    } finally {
      setIsPolling(false);
    }
  }, [enabled, isPolling, fetchSettingsTimestamps, queryClient]);

  // Initial fetch and polling setup
  useEffect(() => {
    if (!enabled) return;
    
    // Check if we're using PHP backend
    const isPhpBackend = api.isPhpBackend();
    if (!isPhpBackend) {
      // Supabase projects use real-time subscriptions in SettingsContext
      return;
    }
    
    // Initial fetch
    checkForUpdates();
    
    // Set up polling interval
    const intervalId = setInterval(checkForUpdates, pollInterval);
    
    return () => clearInterval(intervalId);
  }, [enabled, pollInterval, checkForUpdates]);

  // Manual refresh function
  const forceRefresh = useCallback(async () => {
    await checkForUpdates();
  }, [checkForUpdates]);

  return {
    lastSync,
    isPolling,
    forceRefresh,
  };
}

export default useRealtimeSettings;
