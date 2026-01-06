import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { Mail, Users, Globe, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { tooltips } from "@/lib/tooltips";

const STATS_STORAGE_KEY = 'trashmails_live_stats';

interface Stats {
  emailsToday: number;        // Rolling 24h - can fluctuate
  totalEmails: number;        // All-time received (monotonic)
  activeAddresses: number;    // Currently active (can fluctuate)
  totalInboxesCreated: number; // All-time inboxes (monotonic)
  activeDomains: number;
  totalEmailsGenerated: number; // Monotonic counter
}

// Helper to parse stat values safely
const parseStatValue = (val: unknown): number => {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof val === 'bigint') return Number(val);
  return 0;
};

// Load cached stats from localStorage
const loadCachedStats = (): Stats => {
  try {
    const cached = localStorage.getItem(STATS_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        emailsToday: parseStatValue(parsed.emailsToday),
        totalEmails: parseStatValue(parsed.totalEmails),
        activeAddresses: parseStatValue(parsed.activeAddresses),
        totalInboxesCreated: parseStatValue(parsed.totalInboxesCreated),
        activeDomains: parseStatValue(parsed.activeDomains),
        totalEmailsGenerated: parseStatValue(parsed.totalEmailsGenerated),
      };
    }
  } catch {
    // ignore parse errors
  }
  return { 
    emailsToday: 0, 
    totalEmails: 0, 
    activeAddresses: 0, 
    totalInboxesCreated: 0, 
    activeDomains: 0, 
    totalEmailsGenerated: 0 
  };
};

// Save stats to localStorage
const saveCachedStats = (stats: Stats) => {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore storage errors
  }
};

// Animated counter component with spring animation
const AnimatedCounter = ({ value, isAnimating }: { value: number; isAnimating: boolean }) => {
  const spring = useSpring(0, { stiffness: 100, damping: 30 });
  const display = useTransform(spring, (current) => {
    if (current >= 1000000) return `${(current / 1000000).toFixed(1)}M`;
    if (current >= 1000) return `${(current / 1000).toFixed(1)}K`;
    return Math.floor(current).toString();
  });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return (
    <motion.span
      animate={isAnimating ? { scale: [1, 1.15, 1], color: ["inherit", "hsl(var(--primary))", "inherit"] } : {}}
      transition={{ duration: 0.4 }}
    >
      <motion.span>{display}</motion.span>
    </motion.span>
  );
};

const LiveStatsWidget = () => {
  const [stats, setStats] = useState<Stats>(loadCachedStats);
  const [isLoading, setIsLoading] = useState(true);
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
  const [pulsingIndex, setPulsingIndex] = useState<number | null>(null);
  const initialLoadRef = useRef(true);

  // Trigger pulse animation for a specific card
  const triggerPulse = (index: number) => {
    setPulsingIndex(index);
    setAnimatingIndex(index);
    setTimeout(() => {
      setPulsingIndex(null);
      setAnimatingIndex(null);
    }, 800);
  };

  // Update stats - for API responses, trust the server value for monotonic counters
  // Only use Math.max for realtime incremental updates
  const updateStats = useCallback((incoming: Partial<Stats>, isApiResponse = false) => {
    setStats(prev => {
      // For API responses, trust the server value directly for monotonic counters
      // This fixes the issue where cached values are higher than actual DB values
      const incomingTotalInboxes = parseStatValue(incoming.totalInboxesCreated);
      const incomingTotalEmails = parseStatValue(incoming.totalEmails);
      const incomingTotalGenerated = parseStatValue(incoming.totalEmailsGenerated);
      
      const next: Stats = {
        // Rolling 24h - allow natural fluctuation
        emailsToday: parseStatValue(incoming.emailsToday ?? prev.emailsToday),
        // Monotonic - for API responses, use server value if provided; for realtime, use max
        totalEmails: isApiResponse && incoming.totalEmails !== undefined 
          ? incomingTotalEmails 
          : Math.max(prev.totalEmails, incomingTotalEmails || prev.totalEmails),
        // Active count - allow natural fluctuation as inboxes expire
        activeAddresses: parseStatValue(incoming.activeAddresses ?? prev.activeAddresses),
        // Monotonic - for API responses, use server value if provided; for realtime, use max
        totalInboxesCreated: isApiResponse && incoming.totalInboxesCreated !== undefined
          ? incomingTotalInboxes
          : Math.max(prev.totalInboxesCreated, incomingTotalInboxes || prev.totalInboxesCreated),
        // Domains can change
        activeDomains: parseStatValue(incoming.activeDomains ?? prev.activeDomains),
        // Monotonic - for API responses, use server value if provided; for realtime, use max
        totalEmailsGenerated: isApiResponse && incoming.totalEmailsGenerated !== undefined
          ? incomingTotalGenerated
          : Math.max(prev.totalEmailsGenerated, incomingTotalGenerated || prev.totalEmailsGenerated),
      };
      
      console.log('[LiveStatsWidget] Stats updated:', { isApiResponse, incoming, prev, next });
      saveCachedStats(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-public-stats');
        
        if (!error && data) {
          console.log('[LiveStatsWidget] API response:', data);
          // Pass isApiResponse=true so we trust server values over cached
          updateStats({
            emailsToday: data.emailsToday,
            totalEmails: data.totalEmails,
            activeAddresses: data.activeAddresses,
            totalInboxesCreated: data.totalInboxesCreated,
            activeDomains: data.activeDomains,
            totalEmailsGenerated: data.totalEmailsGenerated,
          }, true);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // Defer initial fetch to not block main thread
    const timeoutId = setTimeout(() => {
      fetchStats();
      initialLoadRef.current = false;
    }, 100);
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [updateStats]);

  // Subscribe to realtime changes on email_stats and temp_emails for live counter updates
  useEffect(() => {
    // Channel for email_stats updates
    const statsChannel = supabase
      .channel('email-stats-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'email_stats',
          filter: 'stat_key=eq.total_temp_emails_created'
        },
        (payload) => {
          if (!initialLoadRef.current && payload.new) {
            const newValue = parseStatValue((payload.new as { stat_value?: number }).stat_value);
            updateStats({ totalEmailsGenerated: newValue });
            triggerPulse(1);
          }
        }
      )
      .subscribe();

    // Channel for real-time temp_emails inserts
    const tempEmailsChannel = supabase
      .channel('temp-emails-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'temp_emails'
        },
        () => {
          if (!initialLoadRef.current) {
            // Increment the counter on new temp email creation
            setStats(prev => {
              const next = {
                ...prev,
                totalEmailsGenerated: prev.totalEmailsGenerated + 1,
                totalInboxesCreated: prev.totalInboxesCreated + 1,
                activeAddresses: prev.activeAddresses + 1,
              };
              saveCachedStats(next);
              return next;
            });
            triggerPulse(1);
          }
        }
      )
      .subscribe();

    // Channel for received_emails inserts  
    const receivedEmailsChannel = supabase
      .channel('received-emails-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'received_emails'
        },
        () => {
          if (!initialLoadRef.current) {
            setStats(prev => {
              const next = {
                ...prev,
                emailsToday: prev.emailsToday + 1,
                totalEmails: prev.totalEmails + 1,
              };
              saveCachedStats(next);
              return next;
            });
            triggerPulse(0);
          }
        }
      )
      .subscribe();

    return () => {
      statsChannel.unsubscribe();
      tempEmailsChannel.unsubscribe();
      receivedEmailsChannel.unsubscribe();
    };
  }, [updateStats]);

  const statItems = [
    {
      icon: Mail,
      label: "Today (IST)",
      value: stats.emailsToday,
      color: "text-primary",
      bgColor: "bg-primary/20",
      tooltip: "Emails received since midnight IST",
    },
    {
      icon: Zap,
      label: "Emails Generated",
      value: stats.totalEmailsGenerated,
      color: "text-accent",
      bgColor: "bg-accent/20",
      tooltip: tooltips.stats.emailsGenerated,
    },
    {
      icon: Users,
      label: "Inboxes Created",
      value: stats.totalInboxesCreated,
      color: "text-green-500",
      bgColor: "bg-green-500/20",
      tooltip: "Total temporary inboxes created",
    },
    {
      icon: Globe,
      label: "Domains",
      value: stats.activeDomains,
      color: "text-blue-500",
      bgColor: "bg-blue-500/20",
      tooltip: tooltips.stats.domains,
    },
  ];

  // Get pulse color based on item color class
  const getPulseColor = (colorClass: string) => {
    if (colorClass === 'text-primary') return 'hsl(var(--primary))';
    if (colorClass === 'text-green-500') return 'rgb(34, 197, 94)';
    if (colorClass === 'text-blue-500') return 'rgb(59, 130, 246)';
    if (colorClass === 'text-accent') return 'hsl(var(--accent))';
    return 'hsl(var(--primary))';
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item, index) => (
        <Tooltip key={item.label}>
          <TooltipTrigger asChild>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative group cursor-help"
            >
              {/* Outer glow pulse effect */}
              <motion.div
                className="absolute -inset-1 rounded-xl pointer-events-none"
                initial={{ opacity: 0 }}
                animate={pulsingIndex === index ? {
                  opacity: [0, 0.8, 0],
                  boxShadow: [
                    `0 0 0 0 transparent`,
                    `0 0 30px 8px ${getPulseColor(item.color)}`,
                    `0 0 0 0 transparent`
                  ]
                } : { opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
              
              <motion.div 
                className="relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 hover:border-primary/30 transition-all duration-300"
                animate={pulsingIndex === index ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                {/* Flash background on update */}
                <motion.div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={pulsingIndex === index ? {
                    opacity: [0, 0.25, 0],
                    backgroundColor: getPulseColor(item.color)
                  } : { opacity: 0 }}
                  transition={{ duration: 0.5 }}
                />

                {/* Live indicator pulse */}
                <div className="absolute top-2 right-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                </div>

                <div className={`inline-flex p-2 rounded-lg ${item.bgColor} mb-3 relative z-10`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>

                <div className="space-y-1 relative z-10">
                  <p className="text-2xl md:text-3xl font-bold text-foreground">
                    {isLoading ? (
                      <span className="inline-block w-12 h-8 bg-secondary animate-pulse rounded" />
                    ) : (
                      <AnimatedCounter value={item.value} isAnimating={animatingIndex === index} />
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>

                {/* Hover gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              </motion.div>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{item.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
};

export default LiveStatsWidget;
