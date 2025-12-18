import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Clock, TrendingUp, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface EmailStats {
  totalGenerated: number;
  totalReceived: number;
  activeEmails: number;
  avgPerDay: number;
}

const AdminEmails = () => {
  const [stats, setStats] = useState<EmailStats>({
    totalGenerated: 0,
    totalReceived: 0,
    activeEmails: 0,
    avgPerDay: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [generatedRes, receivedRes, activeRes] = await Promise.all([
          supabase.from("temp_emails").select("*", { count: "exact", head: true }),
          supabase.from("received_emails").select("*", { count: "exact", head: true }),
          supabase.from("temp_emails").select("*", { count: "exact", head: true }).eq("is_active", true),
        ]);

        // Generate chart data (last 7 days)
        const days = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dayStart = new Date(date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(date);
          dayEnd.setHours(23, 59, 59, 999);

          const { count: generatedCount } = await supabase
            .from("temp_emails")
            .select("*", { count: "exact", head: true })
            .gte("created_at", dayStart.toISOString())
            .lte("created_at", dayEnd.toISOString());

          const { count: receivedCount } = await supabase
            .from("received_emails")
            .select("*", { count: "exact", head: true })
            .gte("received_at", dayStart.toISOString())
            .lte("received_at", dayEnd.toISOString());

          days.push({
            name: date.toLocaleDateString("en-US", { weekday: "short" }),
            generated: generatedCount || 0,
            received: receivedCount || 0,
          });
        }

        const totalGenerated = generatedRes.count || 0;
        const avgPerDay = Math.round(totalGenerated / 7);

        setStats({
          totalGenerated,
          totalReceived: receivedRes.count || 0,
          activeEmails: activeRes.count || 0,
          avgPerDay,
        });
        setChartData(days);
      } catch (error) {
        console.error("Error fetching email stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { title: "Total Generated", value: stats.totalGenerated, icon: Mail, color: "text-primary" },
    { title: "Total Received", value: stats.totalReceived, icon: TrendingUp, color: "text-accent" },
    { title: "Active Emails", value: stats.activeEmails, icon: Clock, color: "text-neon-green" },
    { title: "Avg Per Day", value: stats.avgPerDay, icon: Calendar, color: "text-neon-pink" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  {isLoading ? "..." : stat.value.toLocaleString()}
                </p>
              </div>
              <div className={`p-3 rounded-xl bg-secondary/50 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4">Email Activity (Last 7 Days)</h3>
        <div className="h-[300px]">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Loading chart...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorGenerated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(175, 80%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(175, 80%, 50%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(280, 70%, 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(280, 70%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
                <XAxis dataKey="name" stroke="hsl(215, 20%, 55%)" />
                <YAxis stroke="hsl(215, 20%, 55%)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222, 47%, 8%)",
                    border: "1px solid hsl(222, 30%, 18%)",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="generated"
                  stroke="hsl(175, 80%, 50%)"
                  fillOpacity={1}
                  fill="url(#colorGenerated)"
                  name="Generated"
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  stroke="hsl(280, 70%, 55%)"
                  fillOpacity={1}
                  fill="url(#colorReceived)"
                  name="Received"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AdminEmails;
