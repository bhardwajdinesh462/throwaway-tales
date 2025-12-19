import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mail, Users, Globe, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  emailsToday: number;
  totalEmails: number;
  activeAddresses: number;
  activeDomains: number;
}

const LiveStatsWidget = () => {
  const [stats, setStats] = useState<Stats>({
    emailsToday: 0,
    totalEmails: 0,
    activeAddresses: 0,
    activeDomains: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-public-stats');
        
        if (!error && data) {
          setStats({
            emailsToday: data.emailsToday || 0,
            totalEmails: data.totalEmails || 0,
            activeAddresses: data.activeAddresses || 0,
            activeDomains: data.activeDomains || 0,
          });
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // Defer initial fetch to not block main thread
    const timeoutId = setTimeout(fetchStats, 100);
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, []);

  const statItems = [
    {
      icon: Mail,
      label: "Emails Today",
      value: stats.emailsToday,
      color: "text-primary",
      bgColor: "bg-primary/20",
    },
    {
      icon: Zap,
      label: "Total Processed",
      value: stats.totalEmails,
      color: "text-accent",
      bgColor: "bg-accent/20",
    },
    {
      icon: Users,
      label: "Active Inboxes",
      value: stats.activeAddresses,
      color: "text-green-500",
      bgColor: "bg-green-500/20",
    },
    {
      icon: Globe,
      label: "Domains",
      value: stats.activeDomains,
      color: "text-blue-500",
      bgColor: "bg-blue-500/20",
    },
  ];

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className="relative group"
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
              <motion.p
                className="text-2xl md:text-3xl font-bold text-foreground"
                key={item.value}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {isLoading ? (
                  <span className="inline-block w-12 h-8 bg-secondary animate-pulse rounded" />
                ) : (
                  formatNumber(item.value)
                )}
              </motion.p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>

            {/* Hover gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default LiveStatsWidget;
