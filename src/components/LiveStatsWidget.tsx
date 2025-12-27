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
  const initialLoadRef = useRef(true);

  // Update stats - only clamp monotonic counters (totalEmails, totalInboxesCreated, totalEmailsGenerated)
  const updateStats = useCallback((incoming: Partial<Stats>) => {
    setStats(prev => {
      const next: Stats = {
        // Rolling 24h - allow natural fluctuation
        emailsToday: parseStatValue(incoming.emailsToday ?? prev.emailsToday),
        // Monotonic - only increase
        totalEmails: Math.max(prev.totalEmails, parseStatValue(incoming.totalEmails ?? prev.totalEmails)),
        // Active count - allow natural fluctuation as inboxes expire
        activeAddresses: parseStatValue(incoming.activeAddresses ?? prev.activeAddresses),
        // Monotonic - total ever created, only increase
        totalInboxesCreated: Math.max(prev.totalInboxesCreated, parseStatValue(incoming.totalInboxesCreated ?? prev.totalInboxesCreated)),
        // Domains can change
        activeDomains: parseStatValue(incoming.activeDomains ?? prev.activeDomains),
        // Monotonic - only increase
        totalEmailsGenerated: Math.max(prev.totalEmailsGenerated, parseStatValue(incoming.totalEmailsGenerated ?? prev.totalEmailsGenerated)),
      };
      saveCachedStats(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-public-stats');
        
        if (!error && data) {
          updateStats({
            emailsToday: data.emailsToday,
            totalEmails: data.totalEmails,
            activeAddresses: data.activeAddresses,
            totalInboxesCreated: data.totalInboxesCreated,
            activeDomains: data.activeDomains,
            totalEmailsGenerated: data.totalEmailsGenerated,
          });
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

  // Subscribe to realtime changes on email_stats for live counter updates (persistent counter)
  useEffect(() => {
    const channel = supabase
      .channel('email-stats-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'email_stats',
          filter: 'stat_key=eq.total_emails_generated'
        },
        (payload) => {
          // Only animate after initial load
          if (!initialLoadRef.current && payload.new) {
            const newValue = parseStatValue((payload.new as { stat_value?: number }).stat_value);
            updateStats({ totalEmailsGenerated: newValue });
            // Trigger animation on "Emails Generated" (index 1)
            setAnimatingIndex(1);
            setTimeout(() => setAnimatingIndex(null), 500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateStats]);

  const statItems = [
    {
      icon: Mail,
      label: "Emails (24h)",
      value: stats.emailsToday,
      color: "text-primary",
      bgColor: "bg-primary/20",
      tooltip: "Emails received in the last 24 hours",
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
              <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 hover:border-primary/30 transition-all duration-300">
                {/* Pulse effect */}
                <div className="absolute top-2 right-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                </div>

                <div className={`inline-flex p-2 rounded-lg ${item.bgColor} mb-3`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>

                <div className="space-y-1">
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
              </div>
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
