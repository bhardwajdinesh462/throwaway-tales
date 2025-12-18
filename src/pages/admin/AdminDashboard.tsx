import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Mail, Globe, TrendingUp, Activity, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalUsers: number;
  totalEmails: number;
  totalDomains: number;
  activeEmails: number;
  emailsToday: number;
  userGrowth: number;
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

    fetchStats();
  }, []);

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <a href="/admin/settings" className="p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
            <Activity className="w-5 h-5 text-neon-green mb-2" />
            <p className="font-medium text-foreground">System Settings</p>
            <p className="text-sm text-muted-foreground">Configure app settings</p>
          </a>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
