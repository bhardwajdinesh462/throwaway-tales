import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Clock, TrendingUp, Calendar, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
  duplicateCount: number;
}

const AdminEmails = () => {
  const [stats, setStats] = useState<EmailStats>({
    totalGenerated: 0,
    totalReceived: 0,
    activeEmails: 0,
    avgPerDay: 0,
    duplicateCount: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const [generatedRes, receivedRes, activeRes] = await Promise.all([
        api.db.query<any[]>("temp_emails"),
        api.db.query<any[]>("received_emails"),
        api.db.query<any[]>("temp_emails", { filter: { is_active: { eq: true } } }),
      ]);

      // Count duplicates
      const { data: allEmails } = await api.db.query<{ temp_email_id: string; from_address: string; subject: string; received_at: string }[]>(
        "received_emails",
        { select: "temp_email_id, from_address, subject, received_at" }
      );

      const emailMap = new Map<string, number>();
      let duplicateCount = 0;
      
      for (const email of allEmails || []) {
        const key = `${email.temp_email_id}|${email.from_address}|${email.subject}|${email.received_at}`.toLowerCase();
        const count = emailMap.get(key) || 0;
        emailMap.set(key, count + 1);
        if (count >= 1) {
          duplicateCount++;
        }
      }

      // Generate chart data (last 7 days)
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const { data: genData } = await api.db.query<any[]>("temp_emails", {
          filter: { created_at: { gte: dayStart.toISOString(), lte: dayEnd.toISOString() } }
        });

        const { data: recData } = await api.db.query<any[]>("received_emails", {
          filter: { received_at: { gte: dayStart.toISOString(), lte: dayEnd.toISOString() } }
        });

        days.push({
          name: date.toLocaleDateString("en-US", { weekday: "short" }),
          generated: genData?.length || 0,
          received: recData?.length || 0,
        });
      }

      const totalGenerated = generatedRes.data?.length || 0;
      const avgPerDay = Math.round(totalGenerated / 7);

      setStats({
        totalGenerated,
        totalReceived: receivedRes.data?.length || 0,
        activeEmails: activeRes.data?.length || 0,
        avgPerDay,
        duplicateCount,
      });
      setChartData(days);
    } catch (error) {
      console.error("Error fetching email stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleDeleteDuplicates = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await api.functions.invoke("delete-duplicate-emails");
      
      if (error) throw error;
      
      const result = data as { success?: boolean; deleted?: number; error?: string } | null;
      if (result?.success) {
        toast.success(`Deleted ${result.deleted} duplicate emails`);
        // Refresh stats
        fetchStats();
      } else {
        toast.error(result?.error || "Failed to delete duplicates");
      }
    } catch (error: any) {
      console.error("Error deleting duplicates:", error);
      toast.error("Failed to delete duplicate emails");
    } finally {
      setIsDeleting(false);
    }
  };

  const statCards = [
    { title: "Total Generated", value: stats.totalGenerated, icon: Mail, color: "text-primary" },
    { title: "Total Received", value: stats.totalReceived, icon: TrendingUp, color: "text-accent" },
    { title: "Active Emails", value: stats.activeEmails, icon: Clock, color: "text-neon-green" },
    { title: "Avg Per Day", value: stats.avgPerDay, icon: Calendar, color: "text-neon-pink" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading Skeleton for Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="glass-card p-6 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-8 w-16 bg-muted rounded" />
                </div>
                <div className="p-3 rounded-xl bg-muted w-12 h-12" />
              </div>
            </div>
          ))}
        </div>
        
        {/* Loading Skeleton for Chart */}
        <div className="glass-card p-6 animate-pulse">
          <div className="h-6 w-48 bg-muted rounded mb-4" />
          <div className="h-64 bg-muted rounded" />
        </div>
        
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading email statistics...</span>
        </div>
      </div>
    );
  }

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
                  {stat.value.toLocaleString()}
                </p>
              </div>
              <div className={`p-3 rounded-xl bg-secondary/50 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Duplicate Emails Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${stats.duplicateCount > 0 ? 'bg-destructive/20' : 'bg-neon-green/20'}`}>
              {stats.duplicateCount > 0 ? (
                <AlertTriangle className="w-6 h-6 text-destructive" />
              ) : (
                <Mail className="w-6 h-6 text-neon-green" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Duplicate Emails</h3>
              <p className="text-muted-foreground text-sm">
                {stats.duplicateCount > 0 
                  ? `${stats.duplicateCount} duplicate email(s) found`
                  : "No duplicate emails detected"}
              </p>
            </div>
          </div>
          {stats.duplicateCount > 0 && (
            <Button
              variant="destructive"
              onClick={handleDeleteDuplicates}
              disabled={isDeleting}
              className="gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Duplicates
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <h3 className="text-lg font-semibold text-foreground mb-4">Email Activity (Last 7 Days)</h3>
        <div className="h-[300px]">
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
        </div>
      </motion.div>
    </div>
  );
};

export default AdminEmails;
