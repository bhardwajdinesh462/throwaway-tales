import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Mail, Globe, TrendingUp, Activity, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw, Server } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Stats {
  totalUsers: number;
  totalEmails: number;
  totalDomains: number;
  activeEmails: number;
  emailsToday: number;
  userGrowth: number;
}

interface HealthCheckResult {
  smtp: {
    configured: boolean;
    status: 'healthy' | 'unhealthy' | 'unconfigured';
    lastCheck: string;
    message: string;
  };
  imap: {
    configured: boolean;
    status: 'healthy' | 'unhealthy' | 'unconfigured';
    lastCheck: string;
    message: string;
  };
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalEmails: 0,
    totalDomains: 0,
    activeEmails: 0,
    emailsToday: 0,
    userGrowth: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [healthCheck, setHealthCheck] = useState<HealthCheckResult | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch counts
        const [usersRes, tempEmailsRes, domainsRes, receivedRes] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("temp_emails").select("*", { count: "exact", head: true }),
          supabase.from("domains").select("*", { count: "exact", head: true }),
          supabase.from("received_emails").select("*", { count: "exact", head: true }),
        ]);

        // Active temp emails
        const activeRes = await supabase
          .from("temp_emails")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true);

        // Emails received today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const emailsTodayRes = await supabase
          .from("received_emails")
          .select("*", { count: "exact", head: true })
          .gte("received_at", today.toISOString());

        setStats({
          totalUsers: usersRes.count || 0,
          totalEmails: tempEmailsRes.count || 0,
          totalDomains: domainsRes.count || 0,
          activeEmails: activeRes.count || 0,
          emailsToday: emailsTodayRes.count || 0,
          userGrowth: 12, // Placeholder
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchHealthCheck = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "email_health_check")
          .single();
        
        if (data?.value) {
          setHealthCheck(data.value as unknown as HealthCheckResult);
        }
      } catch (error) {
        console.error("Error fetching health check:", error);
      }
    };

    fetchStats();
    fetchHealthCheck();
  }, []);

  const runHealthCheck = async () => {
    setIsCheckingHealth(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-health-check');
      if (error) throw error;
      setHealthCheck(data);
      toast.success("Health check completed");
    } catch (error: any) {
      console.error("Health check error:", error);
      toast.error("Failed to run health check");
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'unhealthy':
      case 'unconfigured':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return <XCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500">Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500">Degraded</Badge>;
      case 'unhealthy':
        return <Badge variant="destructive">Unhealthy</Badge>;
      case 'unconfigured':
        return <Badge variant="outline">Not Configured</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const statCards = [
    { title: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { title: "Temp Emails Generated", value: stats.totalEmails, icon: Mail, color: "text-accent" },
    { title: "Active Domains", value: stats.totalDomains, icon: Globe, color: "text-neon-green" },
    { title: "Active Emails", value: stats.activeEmails, icon: Activity, color: "text-neon-pink" },
    { title: "Emails Today", value: stats.emailsToday, icon: Clock, color: "text-yellow-400" },
    { title: "User Growth", value: `+${stats.userGrowth}%`, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      {/* Email System Health */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Email System Health</h2>
            {healthCheck && getStatusBadge(healthCheck.overall)}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runHealthCheck}
            disabled={isCheckingHealth}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isCheckingHealth ? 'animate-spin' : ''}`} />
            {isCheckingHealth ? 'Checking...' : 'Run Health Check'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SMTP Status */}
          <div className="p-4 rounded-lg bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                <span className="font-medium">SMTP (Outgoing)</span>
              </div>
              {healthCheck ? getStatusIcon(healthCheck.smtp.status) : <XCircle className="w-5 h-5 text-muted-foreground" />}
            </div>
            <p className="text-sm text-muted-foreground">
              {healthCheck?.smtp.message || 'No health check data available'}
            </p>
            {healthCheck?.smtp.lastCheck && (
              <p className="text-xs text-muted-foreground mt-2">
                Last checked: {new Date(healthCheck.smtp.lastCheck).toLocaleString()}
              </p>
            )}
          </div>

          {/* IMAP Status */}
          <div className="p-4 rounded-lg bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                <span className="font-medium">IMAP (Incoming)</span>
              </div>
              {healthCheck ? getStatusIcon(healthCheck.imap.status) : <XCircle className="w-5 h-5 text-muted-foreground" />}
            </div>
            <p className="text-sm text-muted-foreground">
              {healthCheck?.imap.message || 'No health check data available'}
            </p>
            {healthCheck?.imap.lastCheck && (
              <p className="text-xs text-muted-foreground mt-2">
                Last checked: {new Date(healthCheck.imap.lastCheck).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {!healthCheck && (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Click "Run Health Check" to check email system status
          </p>
        )}
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{stat.title}</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  {isLoading ? "..." : stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-xl bg-secondary/50 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <a href="/admin/users" className="p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
            <Users className="w-5 h-5 text-primary mb-2" />
            <p className="font-medium text-foreground">Manage Users</p>
            <p className="text-sm text-muted-foreground">View and manage user accounts</p>
          </a>
          <a href="/admin/domains" className="p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
            <Globe className="w-5 h-5 text-accent mb-2" />
            <p className="font-medium text-foreground">Add Domain</p>
            <p className="text-sm text-muted-foreground">Configure email domains</p>
          </a>
          <a href="/admin/email-setup" className="p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
            <Mail className="w-5 h-5 text-neon-green mb-2" />
            <p className="font-medium text-foreground">Email Setup</p>
            <p className="text-sm text-muted-foreground">Configure SMTP/IMAP</p>
          </a>
          <a href="/admin/settings" className="p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
            <Activity className="w-5 h-5 text-neon-pink mb-2" />
            <p className="font-medium text-foreground">System Settings</p>
            <p className="text-sm text-muted-foreground">Configure app settings</p>
          </a>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
