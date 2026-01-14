import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

type BackendStatus = "healthy" | "degraded" | "down" | "checking";

// Detect self-hosted mode
const IS_SELF_HOSTED = import.meta.env.VITE_SELF_HOSTED === 'true' || 
                       Boolean(import.meta.env.VITE_PHP_API_URL);

const PHP_API_URL = import.meta.env.VITE_PHP_API_URL || 
  (IS_SELF_HOSTED && typeof window !== 'undefined' 
    ? `${window.location.origin}/api` 
    : '');

interface BackendStatusContextType {
  status: BackendStatus;
  isHealthy: boolean;
  consecutiveFailures: number;
  lastCheck: Date | null;
  forceCheck: () => Promise<void>;
}

const BackendStatusContext = createContext<BackendStatusContextType | undefined>(undefined);

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CHECK_INTERVAL = 60000; // 60s
const BACKOFF_MULTIPLIER = 2;
const MAX_BACKOFF = 300000; // 5 minutes

export const BackendStatusProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<BackendStatus>("checking");
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const currentBackoff = useRef(CHECK_INTERVAL);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkHealth = useCallback(async (isForced = false): Promise<void> => {
    // Skip if circuit is open and not forced
    if (!isForced && consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      return;
    }

    setStatus("checking");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const start = performance.now();
      
      let isHealthy = false;
      
      if (IS_SELF_HOSTED) {
        // Use PHP API health endpoint for self-hosted
        const response = await fetch(`${PHP_API_URL}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        
        if (response.ok) {
          const data = await response.json();
          isHealthy = data.status === 'ok' && data.db_connected === true;
        }
      } else {
        // Use Supabase for Cloud mode - dynamically import to avoid crashes
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          if (supabase) {
            const { error } = await supabase
              .from("domains")
              .select("id")
              .limit(1)
              .abortSignal(controller.signal);
            
            clearTimeout(timeout);
            isHealthy = !error;
          } else {
            clearTimeout(timeout);
            isHealthy = true; // Assume healthy if Supabase not available
          }
        } catch (importError) {
          console.warn("[BackendStatus] Supabase not available:", importError);
          clearTimeout(timeout);
          isHealthy = true; // Fallback to healthy when Supabase can't load
        }
      }
      
      const latency = performance.now() - start;

      if (isHealthy && latency < 5000) {
        setStatus("healthy");
        setConsecutiveFailures(0);
        currentBackoff.current = CHECK_INTERVAL;
      } else if (isHealthy && latency >= 5000) {
        setStatus("degraded");
        setConsecutiveFailures(prev => prev + 1);
      } else {
        throw new Error("Health check failed");
      }
    } catch (err) {
      console.warn("[BackendStatus] Health check failed:", err);
      setConsecutiveFailures(prev => {
        const newVal = prev + 1;
        if (newVal >= CIRCUIT_BREAKER_THRESHOLD) {
          setStatus("down");
          currentBackoff.current = Math.min(
            currentBackoff.current * BACKOFF_MULTIPLIER,
            MAX_BACKOFF
          );
        } else {
          setStatus("degraded");
        }
        return newVal;
      });
    } finally {
      setLastCheck(new Date());
    }
  }, [consecutiveFailures]);

  const scheduleNextCheck = useCallback(() => {
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    checkTimeoutRef.current = setTimeout(() => {
      checkHealth().then(scheduleNextCheck);
    }, currentBackoff.current);
  }, [checkHealth]);

  const forceCheck = useCallback(async () => {
    setConsecutiveFailures(0);
    currentBackoff.current = CHECK_INTERVAL;
    await checkHealth(true);
    scheduleNextCheck();
  }, [checkHealth, scheduleNextCheck]);

  useEffect(() => {
    // Initial check after mount
    const initialDelay = setTimeout(() => {
      checkHealth(true).then(scheduleNextCheck);
    }, 1000);

    return () => {
      clearTimeout(initialDelay);
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, [checkHealth, scheduleNextCheck]);

  const value: BackendStatusContextType = {
    status,
    isHealthy: status === "healthy",
    consecutiveFailures,
    lastCheck,
    forceCheck,
  };

  return (
    <BackendStatusContext.Provider value={value}>
      {children}
    </BackendStatusContext.Provider>
  );
};

export const useBackendStatus = (): BackendStatusContextType => {
  const context = useContext(BackendStatusContext);
  if (!context) {
    // Return a safe default when used outside provider
    return {
      status: "healthy",
      isHealthy: true,
      consecutiveFailures: 0,
      lastCheck: null,
      forceCheck: async () => {},
    };
  }
  return context;
};
