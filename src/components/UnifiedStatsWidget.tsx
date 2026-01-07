import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { Mail, Users, Globe, Zap, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { tooltips } from "@/lib/tooltips";
import { useNotificationSounds } from "@/hooks/useNotificationSounds";
import { useHomepageContent } from "@/hooks/useHomepageContent";

const STATS_STORAGE_KEY = 'trashmails_live_stats';

interface Stats {
  emailsToday: number;
  totalEmails: number;
  activeAddresses: number;
  totalInboxesCreated: number;
  activeDomains: number;
  totalEmailsGenerated: number;
}

interface StatsWidgetSettings {
  showEmailsToday: boolean;
  showEmailsGenerated: boolean;
  showInboxesCreated: boolean;
  showDomains: boolean;
  customLabels: {
    emailsToday?: string;
    emailsGenerated?: string;
    inboxesCreated?: string;
    domains?: string;
  };
  layout: 'horizontal' | 'vertical';
}

const defaultSettings: StatsWidgetSettings = {
  showEmailsToday: true,
  showEmailsGenerated: true,
  showInboxesCreated: true,
  showDomains: true,
  customLabels: {},
  layout: 'horizontal',
};

const parseStatValue = (val: unknown): number => {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof val === 'bigint') return Number(val);
  return 0;
};

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
  return { emailsToday: 0, totalEmails: 0, activeAddresses: 0, totalInboxesCreated: 0, activeDomains: 0, totalEmailsGenerated: 0 };
};

const saveCachedStats = (stats: Stats) => {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore storage errors
  }
};

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

const UnifiedStatsWidget = () => {
  const [stats, setStats] = useState<Stats>(loadCachedStats);
  const [isLoading, setIsLoading] = useState(true);
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
  const [pulsingIndex, setPulsingIndex] = useState<number | null>(null);
  const initialLoadRef = useRef(true);
  const { playSound } = useNotificationSounds();
  const { quickTips, isSectionEnabled, getSection } = useHomepageContent();

  // Get stats widget settings from database
  const statsWidgetSection = getSection('stats_widget');
  const settings: StatsWidgetSettings = statsWidgetSection?.content || defaultSettings;

  const triggerPulse = (index: number) => {
    setPulsingIndex(index);
    setAnimatingIndex(index);
    playSound('pop');
    setTimeout(() => {
      setPulsingIndex(null);
      setAnimatingIndex(null);
    }, 800);
  };

  const updateStats = useCallback((incoming: Partial<Stats>, isApiResponse = false) => {
    setStats(prev => {
      const incomingTotalInboxes = parseStatValue(incoming.totalInboxesCreated);
      const incomingTotalEmails = parseStatValue(incoming.totalEmails);
      const incomingTotalGenerated = parseStatValue(incoming.totalEmailsGenerated);
      
      const next: Stats = {
        emailsToday: parseStatValue(incoming.emailsToday ?? prev.emailsToday),
        totalEmails: isApiResponse && incoming.totalEmails !== undefined 
          ? incomingTotalEmails 
          : Math.max(prev.totalEmails, incomingTotalEmails || prev.totalEmails),
        activeAddresses: parseStatValue(incoming.activeAddresses ?? prev.activeAddresses),
        totalInboxesCreated: isApiResponse && incoming.totalInboxesCreated !== undefined
          ? incomingTotalInboxes
          : Math.max(prev.totalInboxesCreated, incomingTotalInboxes || prev.totalInboxesCreated),
        activeDomains: parseStatValue(incoming.activeDomains ?? prev.activeDomains),
        totalEmailsGenerated: isApiResponse && incoming.totalEmailsGenerated !== undefined
          ? incomingTotalGenerated
          : Math.max(prev.totalEmailsGenerated, incomingTotalGenerated || prev.totalEmailsGenerated),
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
          }, true);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchStats();
      initialLoadRef.current = false;
    }, 100);
    
    const interval = setInterval(fetchStats, 60000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [updateStats]);

  // Subscribe to realtime changes
  useEffect(() => {
    const statsChannel = supabase
      .channel('unified-stats-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'email_stats', filter: 'stat_key=eq.total_temp_emails_created' }, (payload) => {
        if (!initialLoadRef.current && payload.new) {
          const newValue = parseStatValue((payload.new as { stat_value?: number }).stat_value);
          updateStats({ totalEmailsGenerated: newValue });
          triggerPulse(1);
        }
      })
      .subscribe();

    const tempEmailsChannel = supabase
      .channel('unified-temp-emails')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'temp_emails' }, () => {
        if (!initialLoadRef.current) {
          setStats(prev => {
            const next = { ...prev, totalEmailsGenerated: prev.totalEmailsGenerated + 1, totalInboxesCreated: prev.totalInboxesCreated + 1, activeAddresses: prev.activeAddresses + 1 };
            saveCachedStats(next);
            return next;
          });
          triggerPulse(1);
        }
      })
      .subscribe();

    const receivedEmailsChannel = supabase
      .channel('unified-received-emails')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'received_emails' }, () => {
        if (!initialLoadRef.current) {
          setStats(prev => {
            const next = { ...prev, emailsToday: prev.emailsToday + 1, totalEmails: prev.totalEmails + 1 };
            saveCachedStats(next);
            return next;
          });
          triggerPulse(0);
        }
      })
      .subscribe();

    return () => {
      statsChannel.unsubscribe();
      tempEmailsChannel.unsubscribe();
      receivedEmailsChannel.unsubscribe();
    };
  }, [updateStats]);

  const allStatItems = [
    { key: 'emailsToday', show: settings.showEmailsToday, icon: Mail, label: settings.customLabels.emailsToday || "Today (IST)", value: stats.emailsToday, color: "text-primary", bgColor: "bg-primary/20", tooltip: "Emails received since midnight IST" },
    { key: 'emailsGenerated', show: settings.showEmailsGenerated, icon: Zap, label: settings.customLabels.emailsGenerated || "Emails Generated", value: stats.totalEmailsGenerated, color: "text-accent", bgColor: "bg-accent/20", tooltip: tooltips.stats.emailsGenerated },
    { key: 'inboxesCreated', show: settings.showInboxesCreated, icon: Users, label: settings.customLabels.inboxesCreated || "Inboxes Created", value: stats.totalInboxesCreated, color: "text-green-500", bgColor: "bg-green-500/20", tooltip: "Total temporary inboxes created" },
    { key: 'domains', show: settings.showDomains, icon: Globe, label: settings.customLabels.domains || "Domains", value: stats.activeDomains, color: "text-blue-500", bgColor: "bg-blue-500/20", tooltip: tooltips.stats.domains },
  ];

  const visibleStatItems = allStatItems.filter(item => item.show);
  const showQuickTips = isSectionEnabled('quick_tips');

  const getPulseColor = (colorClass: string) => {
    if (colorClass === 'text-primary') return 'hsl(var(--primary))';
    if (colorClass === 'text-green-500') return 'rgb(34, 197, 94)';
    if (colorClass === 'text-blue-500') return 'rgb(59, 130, 246)';
    if (colorClass === 'text-accent') return 'hsl(var(--accent))';
    return 'hsl(var(--primary))';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card/80 via-background to-card/80 backdrop-blur-sm shadow-lg"
    >
      {/* Background decorations */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl pointer-events-none" />

      <div className={`relative z-10 p-4 sm:p-6 flex flex-col ${settings.layout === 'horizontal' ? 'lg:flex-row lg:gap-6' : 'gap-4'}`}>
        {/* Stats Grid */}
        <div className={`flex-1 ${settings.layout === 'horizontal' ? 'lg:border-r lg:border-border/30 lg:pr-6' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Stats</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {visibleStatItems.map((item, index) => (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative group cursor-help"
                  >
                    <motion.div
                      className="absolute -inset-0.5 rounded-lg pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={pulsingIndex === index ? { opacity: [0, 0.6, 0], boxShadow: [`0 0 0 0 transparent`, `0 0 20px 4px ${getPulseColor(item.color)}`, `0 0 0 0 transparent`] } : { opacity: 0 }}
                      transition={{ duration: 0.5 }}
                    />
                    <div className="relative overflow-hidden rounded-lg border border-border/40 bg-card/60 p-3 hover:border-primary/30 transition-all">
                      <motion.div
                        className="absolute inset-0 rounded-lg pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={pulsingIndex === index ? { opacity: [0, 0.2, 0], backgroundColor: getPulseColor(item.color) } : { opacity: 0 }}
                        transition={{ duration: 0.4 }}
                      />
                      <div className="flex items-center gap-2 relative z-10">
                        <div className={`p-1.5 rounded-md ${item.bgColor}`}>
                          <item.icon className={`w-4 h-4 ${item.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-lg sm:text-xl font-bold text-foreground leading-none">
                            {isLoading ? <span className="inline-block w-8 h-5 bg-secondary animate-pulse rounded" /> : <AnimatedCounter value={item.value} isAnimating={animatingIndex === index} />}
                          </p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">{item.label}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent><p>{item.tooltip}</p></TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Quick Tips Section */}
        {showQuickTips && (
          <div className={`${settings.layout === 'horizontal' ? 'lg:w-72 lg:pl-2' : 'border-t border-border/30 pt-4'}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-md bg-primary/20">
                <Lightbulb className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">{quickTips.title}</span>
            </div>
            <ul className="space-y-2">
              {quickTips.tips.map((tip, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-[10px]">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{tip}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default UnifiedStatsWidget;
