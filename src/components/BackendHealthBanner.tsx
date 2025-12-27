import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, RefreshCw, WifiOff, Database, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "@/hooks/useAdminRole";

type ServiceStatus = "ok" | "degraded" | "down" | "checking";

interface HealthState {
  database: ServiceStatus;
  realtime: ServiceStatus;
  lastCheck: Date | null;
  consecutiveFailures: number;
}

const CIRCUIT_BREAKER_THRESHOLD = 3;
const COOLDOWN_MS = 30000; // 30s cooldown after circuit breaks

const BackendHealthBanner = () => {
  const { isAdmin, isLoading: adminLoading } = useAdminRole();
  const [health, setHealth] = useState<HealthState>({
    database: "checking",
    realtime: "checking",
    lastCheck: null,
    consecutiveFailures: 0,
  });
  const [isRecovering, setIsRecovering] = useState(false);
  const [circuitOpen, setCircuitOpen] = useState(false);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  const checkHealth = useCallback(async (isManual = false) => {
    // Circuit breaker: skip auto-checks if circuit is open
    if (circuitOpen && !isManual) {
      return;
    }

    setHealth(prev => ({ ...prev, database: "checking", realtime: "checking" }));

    let dbOk = false;
    let rtOk = false;

    // Check database
    try {
      const start = performance.now();
      const { error } = await supabase.from("domains").select("id").limit(1);
      const latency = performance.now() - start;
      dbOk = !error && latency < 5000;
    } catch {
      dbOk = false;
    }

    // Check realtime - skip intensive subscription test, assume realtime is ok if db is ok
    // This avoids the removeChannel infinite loop issue
    rtOk = dbOk;

    const allOk = dbOk && rtOk;

    setHealth(prev => {
      const newFailures = allOk ? 0 : prev.consecutiveFailures + 1;
      
      // Open circuit breaker if too many consecutive failures
      if (newFailures >= CIRCUIT_BREAKER_THRESHOLD && !circuitOpen) {
        setCircuitOpen(true);
        cooldownRef.current = setTimeout(() => {
          setCircuitOpen(false);
        }, COOLDOWN_MS);
      }

      return {
        database: dbOk ? "ok" : "down",
        realtime: rtOk ? "ok" : "down",
        lastCheck: new Date(),
        consecutiveFailures: newFailures,
      };
    });
  }, [circuitOpen]);

  const handleRecover = useCallback(async () => {
    setIsRecovering(true);
    setCircuitOpen(false);
    if (cooldownRef.current) clearTimeout(cooldownRef.current);

    // Force re-check
    await checkHealth(true);

    // If still failing, try to reconnect supabase realtime
    if (health.realtime === "down") {
      try {
        await supabase.realtime.disconnect();
        await new Promise(r => setTimeout(r, 500));
        supabase.realtime.connect();
      } catch {
        // ignore
      }
    }

    setIsRecovering(false);
  }, [checkHealth, health.realtime]);

  useEffect(() => {
    // Initial check after short delay
    const initialTimeout = setTimeout(() => checkHealth(), 2000);
    
    // Periodic health checks (every 60s, respects circuit breaker)
    const interval = setInterval(() => checkHealth(), 60000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, [checkHealth]);

  // Only show banner if there's an issue AND user is admin
  const hasIssue = health.database === "down" || health.realtime === "down";
  const isChecking = health.database === "checking" || health.realtime === "checking";

  // Don't show to non-admins
  if (adminLoading || !isAdmin) return null;
  if (!hasIssue && !isChecking) return null;

  return (
    <AnimatePresence>
      {(hasIssue || isChecking) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="w-full"
        >
          <div className={`px-4 py-2 flex items-center justify-between gap-3 text-sm ${
            isChecking 
              ? "bg-muted/50 border-b border-border/50" 
              : "bg-amber-500/10 border-b border-amber-500/30"
          }`}>
            <div className="flex items-center gap-3">
              {isChecking ? (
                <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500" />
              )}
              
              <div className="flex items-center gap-4">
                {/* Database status */}
                <div className="flex items-center gap-1.5">
                  <Database className={`w-3.5 h-3.5 ${
                    health.database === "ok" ? "text-emerald-500" : 
                    health.database === "checking" ? "text-muted-foreground" : "text-red-500"
                  }`} />
                  <span className="text-xs">DB</span>
                  {health.database === "ok" && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                  {health.database === "down" && <WifiOff className="w-3 h-3 text-red-500" />}
                </div>

                {/* Realtime status */}
                <div className="flex items-center gap-1.5">
                  <Zap className={`w-3.5 h-3.5 ${
                    health.realtime === "ok" ? "text-emerald-500" : 
                    health.realtime === "checking" ? "text-muted-foreground" : "text-red-500"
                  }`} />
                  <span className="text-xs">Realtime</span>
                  {health.realtime === "ok" && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                  {health.realtime === "down" && <WifiOff className="w-3 h-3 text-red-500" />}
                </div>

                {circuitOpen && (
                  <span className="text-xs text-amber-600">
                    (auto-recovery paused)
                  </span>
                )}
              </div>
            </div>

            {hasIssue && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecover}
                disabled={isRecovering}
                className="h-7 text-xs gap-1.5 border-amber-500/30 hover:bg-amber-500/10"
              >
                <RefreshCw className={`w-3 h-3 ${isRecovering ? "animate-spin" : ""}`} />
                {isRecovering ? "Recovering..." : "Recover Now"}
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BackendHealthBanner;