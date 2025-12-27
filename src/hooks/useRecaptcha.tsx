import { useEffect, useCallback, useState } from 'react';
import { useCaptchaSettings } from '@/hooks/useCaptchaSettings';

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

export const useRecaptcha = () => {
  const { settings, isLoading } = useCaptchaSettings();
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isScriptLoading, setIsScriptLoading] = useState(false);

  const isEnabled = settings.enabled && settings.provider === 'recaptcha' && !!settings.siteKey;

  useEffect(() => {
    if (isLoading || !isEnabled) {
      return;
    }

    // Check if script already loaded
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => {
        setIsReady(true);
        setLoadError(null);
      });
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(`script[src*="recaptcha"]`);
    if (existingScript) {
      // Wait for it to load
      const checkReady = setInterval(() => {
        if (window.grecaptcha) {
          clearInterval(checkReady);
          window.grecaptcha.ready(() => {
            setIsReady(true);
            setLoadError(null);
          });
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkReady);
        if (!window.grecaptcha) {
          setLoadError('reCAPTCHA script failed to initialize');
        }
      }, 10000);
      return;
    }

    setIsScriptLoading(true);
    setLoadError(null);

    // Load reCAPTCHA script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${settings.siteKey}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      setIsScriptLoading(false);
      if (window.grecaptcha) {
        window.grecaptcha.ready(() => {
          setIsReady(true);
          setLoadError(null);
          console.log('reCAPTCHA v3 loaded successfully');
        });
      } else {
        setLoadError('reCAPTCHA loaded but grecaptcha not available');
      }
    };

    script.onerror = () => {
      setIsScriptLoading(false);
      setLoadError('Failed to load reCAPTCHA script');
      console.error('Failed to load reCAPTCHA script');
    };
    
    document.head.appendChild(script);

    // Cleanup timeout
    const timeout = setTimeout(() => {
      if (!isReady && !loadError) {
        setLoadError('reCAPTCHA script load timeout');
        setIsScriptLoading(false);
      }
    }, 15000);

    return () => {
      clearTimeout(timeout);
    };
  }, [settings.enabled, settings.provider, settings.siteKey, isLoading, isEnabled, isReady, loadError]);

  const executeRecaptcha = useCallback(async (action: string): Promise<string | null> => {
    // If not enabled, skip verification
    if (!isEnabled) {
      console.log('reCAPTCHA not enabled, skipping verification');
      return 'skip';
    }

    // If there's a load error, we can't proceed
    if (loadError) {
      console.error('reCAPTCHA load error:', loadError);
      return null;
    }

    // Wait for ready state (avoid false failures right after page load)
    if (!isReady || !window.grecaptcha) {
      const startedAt = Date.now();
      while ((!window.grecaptcha || !isReady) && Date.now() - startedAt < 8000) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (!window.grecaptcha) {
        console.error('reCAPTCHA not available after waiting');
        return null;
      }
    }

    try {
      const token = await window.grecaptcha.execute(settings.siteKey, { action });
      console.log(`reCAPTCHA token generated for action: ${action}`);
      return token;
    } catch (error) {
      console.error('reCAPTCHA execution failed:', error);
      return null;
    }
  }, [isEnabled, settings.siteKey, isReady, loadError]);

  return {
    executeRecaptcha,
    isReady,
    isEnabled,
    isLoading: isLoading || isScriptLoading,
    loadError,
    settings,
  };
};

export default useRecaptcha;
