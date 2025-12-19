import { useEffect } from "react";

const CACHE_REFRESH_KEY = "nullsto_cache_refresh_version";
const CACHE_REFRESH_VERSION = "2025-12-19-03";

// Settings keys that should be cleared to force fresh load
const STALE_SETTINGS_KEYS = [
  'trashmails_appearance_settings',
  'trashmails_general_settings',
  'trashmails_user_settings',
  'trashmails_settings',
  'trashmails_email_templates',
];

export default function CacheRefresh() {
  useEffect(() => {
    const run = async () => {
      try {
        const last = localStorage.getItem(CACHE_REFRESH_KEY);
        if (last === CACHE_REFRESH_VERSION) return;

        console.log('[CacheRefresh] Clearing stale caches for version:', CACHE_REFRESH_VERSION);

        // Clear stale settings from localStorage to force fresh database fetch
        STALE_SETTINGS_KEYS.forEach(key => {
          localStorage.removeItem(key);
        });

        // Clear Cache Storage (does NOT touch localStorage sessions/tokens)
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }

        // Ask any registered service worker to update (push notifications remain intact)
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.update()));
        }

        localStorage.setItem(CACHE_REFRESH_KEY, CACHE_REFRESH_VERSION);
        console.log('[CacheRefresh] Cache refresh complete');
      } catch (e) {
        console.error('[CacheRefresh] Error:', e);
      }
    };

    void run();
  }, []);

  return null;
}