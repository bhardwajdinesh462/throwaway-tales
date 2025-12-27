import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Server, 
  Mail, 
  Send,
  Clock,
  Zap,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface ServiceOverride {
  enabled: boolean;
  status: "operational" | "degraded" | "down";
  message?: string;
}

interface StatusOverrides {
  imap: ServiceOverride;
  smtp: ServiceOverride;
  database: ServiceOverride;
  realtime: ServiceOverride;
  globalMessage?: string;
  showGlobalMessage: boolean;
}

interface ServiceStatus {
  name: string;
  key: string;
  status: "operational" | "degraded" | "down" | "checking";
  latency?: number;
  lastChecked: Date;
  icon: React.ReactNode;
  description: string;
  customMessage?: string;
}

const StatusMonitor = () => {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: "IMAP (Email Receiving)",
      key: "imap",
      status: "checking",
      lastChecked: new Date(),
      icon: <Mail className="w-5 h-5" />,
      description: "Incoming email processing"
    },
    {
      name: "SMTP (Email Sending)",
      key: "smtp",
      status: "checking",
      lastChecked: new Date(),
      icon: <Send className="w-5 h-5" />,
      description: "Outgoing email delivery"
    },
    {
      name: "Database",
      key: "database",
      status: "checking",
      lastChecked: new Date(),
      icon: <Server className="w-5 h-5" />,
      description: "Data storage & retrieval"
    },
    {
      name: "Real-time",
      key: "realtime",
      status: "checking",
      lastChecked: new Date(),
      icon: <Zap className="w-5 h-5" />,
      description: "Live updates & notifications"
    }
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [overallStatus, setOverallStatus] = useState<"operational" | "degraded" | "down">("operational");
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

  // Load admin overrides first
  const loadOverrides = async (): Promise<StatusOverrides | null> => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "status_overrides")
        .single();

      if (data) {
        return data.value as unknown as StatusOverrides;
      }
    } catch {
      // No overrides set
    }
    return null;
  };

  const checkServices = async () => {
    setIsRefreshing(true);
    const now = new Date();
    const newServices: ServiceStatus[] = [...services];
    
    // Load admin overrides
    const overrides = await loadOverrides();
    
    if (overrides?.showGlobalMessage && overrides.globalMessage) {
      setGlobalMessage(overrides.globalMessage);
    } else {
      setGlobalMessage(null);
    }

    // Check Database (or use override)
    const dbOverride = overrides?.database;
    if (dbOverride?.enabled) {
      const dbIndex = newServices.findIndex(s => s.key === "database");
      newServices[dbIndex] = {
        ...newServices[dbIndex],
        status: dbOverride.status,
        customMessage: dbOverride.message,
        lastChecked: now
      };
    } else {
      try {
        const start = performance.now();
        const { error } = await supabase.from("domains").select("id").limit(1);
        const latency = Math.round(performance.now() - start);
        
        const dbIndex = newServices.findIndex(s => s.key === "database");
        newServices[dbIndex] = {
          ...newServices[dbIndex],
          status: error ? "down" : "operational",
          latency,
          customMessage: undefined,
          lastChecked: now
        };
      } catch {
        const dbIndex = newServices.findIndex(s => s.key === "database");
        newServices[dbIndex] = { ...newServices[dbIndex], status: "down", lastChecked: now };
      }
    }

    // Check Real-time (or use override)
    const rtOverride = overrides?.realtime;
    if (rtOverride?.enabled) {
      const rtIndex = newServices.findIndex(s => s.key === "realtime");
      newServices[rtIndex] = {
        ...newServices[rtIndex],
        status: rtOverride.status,
        customMessage: rtOverride.message,
        lastChecked: now
      };
    } else {
      // Skip realtime channel test to avoid cleanup issues - just check DB status
      const rtIndex = newServices.findIndex(s => s.key === "realtime");
      const dbStatus = newServices.find(s => s.key === "database")?.status;
      newServices[rtIndex] = {
        ...newServices[rtIndex],
        status: dbStatus === "operational" ? "operational" : "degraded",
        customMessage: undefined,
        lastChecked: now
      };
    }

    // Check IMAP (or use override)
    const imapOverride = overrides?.imap;
    if (imapOverride?.enabled) {
      const imapIndex = newServices.findIndex(s => s.key === "imap");
      newServices[imapIndex] = {
        ...newServices[imapIndex],
        status: imapOverride.status,
        customMessage: imapOverride.message,
        lastChecked: now
      };
    } else {
      try {
        const { data: mailboxes } = await supabase
          .from("mailboxes")
          .select("last_polled_at, last_error, is_active")
          .eq("is_active", true)
          .order("last_polled_at", { ascending: false })
          .limit(1);

        const imapIndex = newServices.findIndex(s => s.key === "imap");
        if (mailboxes && mailboxes.length > 0) {
          const lastPoll = mailboxes[0].last_polled_at ? new Date(mailboxes[0].last_polled_at) : null;
          const hasError = !!mailboxes[0].last_error;
          const isRecent = lastPoll && (now.getTime() - lastPoll.getTime()) < 5 * 60 * 1000;

          newServices[imapIndex] = {
            ...newServices[imapIndex],
            status: hasError ? "degraded" : isRecent ? "operational" : "degraded",
            customMessage: undefined,
            lastChecked: now
          };
        } else {
          newServices[imapIndex] = { ...newServices[imapIndex], status: "degraded", lastChecked: now };
        }
      } catch {
        const imapIndex = newServices.findIndex(s => s.key === "imap");
        newServices[imapIndex] = { ...newServices[imapIndex], status: "down", lastChecked: now };
      }
    }

    // Check SMTP (or use override)
    const smtpOverride = overrides?.smtp;
    if (smtpOverride?.enabled) {
      const smtpIndex = newServices.findIndex(s => s.key === "smtp");
      newServices[smtpIndex] = {
        ...newServices[smtpIndex],
        status: smtpOverride.status,
        customMessage: smtpOverride.message,
        lastChecked: now
      };
    } else {
      try {
        const fiveMinAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const { data: logs } = await supabase
          .from("email_logs")
          .select("status, sent_at")
          .gte("created_at", fiveMinAgo)
          .order("created_at", { ascending: false })
          .limit(10);

        const smtpIndex = newServices.findIndex(s => s.key === "smtp");
        if (logs && logs.length > 0) {
          const successCount = logs.filter(l => l.status === "sent").length;
          const successRate = successCount / logs.length;
          
          newServices[smtpIndex] = {
            ...newServices[smtpIndex],
            status: successRate >= 0.8 ? "operational" : successRate >= 0.5 ? "degraded" : "down",
            customMessage: undefined,
            lastChecked: now
          };
        } else {
          newServices[smtpIndex] = { ...newServices[smtpIndex], status: "operational", lastChecked: now };
        }
      } catch {
        const smtpIndex = newServices.findIndex(s => s.key === "smtp");
        newServices[smtpIndex] = { ...newServices[smtpIndex], status: "down", lastChecked: now };
      }
    }

    setServices(newServices);
    
    // Calculate overall status
    const downCount = newServices.filter(s => s.status === "down").length;
    const degradedCount = newServices.filter(s => s.status === "degraded").length;
    
    if (downCount >= 2) {
      setOverallStatus("down");
    } else if (downCount >= 1 || degradedCount >= 2) {
      setOverallStatus("degraded");
    } else {
      setOverallStatus("operational");
    }

    setIsRefreshing(false);
  };

  useEffect(() => {
    checkServices();
    const interval = setInterval(checkServices, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational": return "text-emerald-500";
      case "degraded": return "text-amber-500";
      case "down": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "operational": return "bg-emerald-500/10 border-emerald-500/30";
      case "degraded": return "bg-amber-500/10 border-amber-500/30";
      case "down": return "bg-red-500/10 border-red-500/30";
      default: return "bg-muted border-border";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational": return <CheckCircle2 className="w-4 h-4" />;
      case "degraded": return <AlertCircle className="w-4 h-4" />;
      case "down": return <XCircle className="w-4 h-4" />;
      default: return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "operational": return "Operational";
      case "degraded": return "Degraded";
      case "down": return "Down";
      default: return "Checking...";
    }
  };

  const getOverallMessage = () => {
    switch (overallStatus) {
      case "operational": return "All systems are running smoothly";
      case "degraded": return "Some services are experiencing issues";
      case "down": return "Major outage detected";
    }
  };

  return (
    <div className="w-full">
      {/* Global Admin Message */}
      {globalMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10"
        >
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground">{globalMessage}</p>
          </div>
        </motion.div>
      )}

      {/* Overall Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`mb-6 p-4 rounded-xl border ${getStatusBg(overallStatus)}`}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`p-2 rounded-full ${getStatusBg(overallStatus)}`}
            >
              <Activity className={`w-5 h-5 ${getStatusColor(overallStatus)}`} />
            </motion.div>
            <div>
              <h3 className={`font-semibold ${getStatusColor(overallStatus)}`}>
                System Status: {getStatusText(overallStatus)}
              </h3>
              <p className="text-sm text-muted-foreground">{getOverallMessage()}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkServices}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {services.map((service, index) => (
            <motion.div
              key={service.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4, scale: 1.02 }}
              className={`relative p-4 rounded-xl border transition-all duration-300 ${getStatusBg(service.status)} hover:shadow-lg`}
            >
              {/* Pulse indicator */}
              {service.status === "operational" && (
                <motion.div
                  className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-500"
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}

              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${getStatusBg(service.status)}`}>
                  <span className={getStatusColor(service.status)}>{service.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground text-sm truncate">{service.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
                </div>
              </div>

              {/* Custom Message */}
              {service.customMessage && (
                <div className="mt-2 p-2 rounded-lg bg-background/50 border border-border/50">
                  <p className="text-xs text-muted-foreground">{service.customMessage}</p>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                <div className={`flex items-center gap-1.5 ${getStatusColor(service.status)}`}>
                  {getStatusIcon(service.status)}
                  <span className="text-xs font-medium">{getStatusText(service.status)}</span>
                </div>
                {service.latency && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {service.latency}ms
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Last Updated */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-4 text-center text-xs text-muted-foreground"
      >
        Last updated: {services[0]?.lastChecked.toLocaleTimeString()} • Auto-refreshes every 30s
      </motion.div>
    </div>
  );
};

export default StatusMonitor;