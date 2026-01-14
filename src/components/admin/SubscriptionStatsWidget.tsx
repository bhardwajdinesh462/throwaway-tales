import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Users, TrendingUp, Clock, CreditCard, ArrowUpRight, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { format, subDays, startOfDay } from "date-fns";
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  proSubscribers: number;
  businessSubscribers: number;
  recentAssignments: {
    id: string;
    user_email: string;
    tier_name: string;
    assigned_at: string;
    expires_at: string;
  }[];
}

interface TrendData {
  date: string;
  label: string;
  total: number;
  pro: number;
  business: number;
}

const SubscriptionStatsWidget = () => {
  const [stats, setStats] = useState<SubscriptionStats>({
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    proSubscribers: 0,
    businessSubscribers: 0,
    recentAssignments: [],
  });
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [trendPeriod, setTrendPeriod] = useState<'7' | '30' | '90'>('30');

  const fetchStats = async () => {
    try {
      // Fetch subscription counts
      const { data: subsData, error: subsError } = await api.db.query<any[]>('user_subscriptions', {
        select: `
          id,
          status,
          current_period_end,
          created_at,
          user_id,
          subscription_tiers (
            id,
            name
          )
        `,
        order: { column: 'created_at', ascending: false }
      });

      if (subsError) throw subsError;

      const subscriptions = subsData || [];
      const activeCount = subscriptions.filter(s => s.status === 'active').length;
      
      // Count by tier
      let proCount = 0;
      let businessCount = 0;
      subscriptions.forEach(sub => {
        const tierName = (sub.subscription_tiers as any)?.name?.toLowerCase() || '';
        if (sub.status === 'active') {
          if (tierName === 'pro') proCount++;
          if (tierName === 'business') businessCount++;
        }
      });

      // Get recent assignments with user emails
      const recentSubs = subscriptions.slice(0, 5);
      const userIds = recentSubs.map(s => s.user_id).filter(Boolean);
      
      let userEmails: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await api.db.query<{ user_id: string; email: string; display_name: string }[]>('profiles', {
          select: 'user_id, email, display_name',
          filter: { user_id: { in: userIds } }
        });
        
        if (profilesData) {
          profilesData.forEach(p => {
            userEmails[p.user_id] = p.email || p.display_name || 'Unknown';
          });
        }
      }

      const recentAssignments = recentSubs.map(sub => ({
        id: sub.id,
        user_email: userEmails[sub.user_id] || 'Unknown User',
        tier_name: (sub.subscription_tiers as any)?.name || 'Unknown',
        assigned_at: sub.created_at,
        expires_at: sub.current_period_end,
      }));

      setStats({
        totalSubscriptions: subscriptions.length,
        activeSubscriptions: activeCount,
        proSubscribers: proCount,
        businessSubscribers: businessCount,
        recentAssignments,
      });

      // Calculate trend data
      const days = parseInt(trendPeriod);
      const trendMap: Record<string, TrendData> = {};
      
      for (let i = days - 1; i >= 0; i--) {
        const date = startOfDay(subDays(new Date(), i));
        const dateStr = format(date, 'yyyy-MM-dd');
        const label = days <= 7 ? format(date, 'EEE') : format(date, 'MMM d');
        trendMap[dateStr] = { date: dateStr, label, total: 0, pro: 0, business: 0 };
      }

      subscriptions.forEach(sub => {
        const createdDate = format(new Date(sub.created_at), 'yyyy-MM-dd');
        if (trendMap[createdDate]) {
          trendMap[createdDate].total++;
          const tierName = (sub.subscription_tiers as any)?.name?.toLowerCase() || '';
          if (tierName === 'pro') trendMap[createdDate].pro++;
          if (tierName === 'business') trendMap[createdDate].business++;
        }
      });

      setTrendData(Object.values(trendMap));
    } catch (error) {
      console.error('Error fetching subscription stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Set up realtime subscription
    let channel: any;
    const setupChannel = async () => {
      channel = await api.realtime.channel('subscription_stats');
      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_subscriptions'
          },
          () => {
            fetchStats();
          }
        )
        .subscribe();
    };
    setupChannel();

    return () => {
      if (channel) api.realtime.removeChannel(channel);
    };
  }, [trendPeriod]);

  const getTierColor = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'business':
        return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
      case 'pro':
        return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <Crown className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Subscription Stats</h2>
            <p className="text-sm text-muted-foreground">Real-time subscription metrics</p>
          </div>
        </div>
        <a 
          href="/admin/subscriptions" 
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Manage <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {isLoading ? '...' : stats.totalSubscriptions}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
          <p className="text-2xl font-bold text-green-500">
            {isLoading ? '...' : stats.activeSubscriptions}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Pro</span>
          </div>
          <p className="text-2xl font-bold text-purple-500">
            {isLoading ? '...' : stats.proSubscribers}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Business</span>
          </div>
          <p className="text-2xl font-bold text-amber-500">
            {isLoading ? '...' : stats.businessSubscribers}
          </p>
        </div>
      </div>

      {/* Trends Chart */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Subscription Trends
          </h3>
          <Tabs value={trendPeriod} onValueChange={(v) => setTrendPeriod(v as '7' | '30' | '90')}>
            <TabsList className="h-8">
              <TabsTrigger value="7" className="text-xs px-2 h-6">7D</TabsTrigger>
              <TabsTrigger value="30" className="text-xs px-2 h-6">30D</TabsTrigger>
              <TabsTrigger value="90" className="text-xs px-2 h-6">90D</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {isLoading ? (
          <div className="h-48 bg-secondary/30 rounded-lg animate-pulse" />
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#colorTotal)"
                  strokeWidth={2}
                  name="Total"
                />
                <Area 
                  type="monotone" 
                  dataKey="pro" 
                  stroke="#a855f7" 
                  fillOpacity={1} 
                  fill="url(#colorPro)"
                  strokeWidth={2}
                  name="Pro"
                />
                <Line 
                  type="monotone" 
                  dataKey="business" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={false}
                  name="Business"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Assignments */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Recent Assignments
        </h3>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-secondary/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : stats.recentAssignments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No subscriptions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.recentAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-medium">
                    {assignment.user_email.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground truncate max-w-[150px]">
                      {assignment.user_email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(assignment.assigned_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={getTierColor(assignment.tier_name)}>
                    {assignment.tier_name}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    Expires {format(new Date(assignment.expires_at), 'MMM d')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SubscriptionStatsWidget;