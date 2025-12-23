import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  BarChart3, 
  TrendingUp, 
  Mail, 
  Users, 
  Globe, 
  Calendar,
  ArrowUp,
  ArrowDown,
  Activity,
  Clock,
  Inbox,
  Send
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from "recharts";

interface AnalyticsData {
  totalEmails: number;
  totalReceived: number;
  activeUsers: number;
  totalDomains: number;
  avgEmailsPerDay: number;
  peakHour: string;
  growthRate: number;
  retentionRate: number;
}

const AdminAnalytics = () => {
  const [timeRange, setTimeRange] = useState("7d");
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalEmails: 0,
    totalReceived: 0,
    activeUsers: 0,
    totalDomains: 0,
    avgEmailsPerDay: 0,
    peakHour: "14:00",
    growthRate: 12.5,
    retentionRate: 68.3,
  });
  const [emailTrends, setEmailTrends] = useState<any[]>([]);
  const [domainDistribution, setDomainDistribution] = useState<any[]>([]);
  const [hourlyActivity, setHourlyActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      
      // Fetch email statistics
      const { data: emails, count: emailCount } = await supabase
        .from("temp_emails")
        .select("*", { count: "exact" });

      const { count: receivedCount } = await supabase
        .from("received_emails")
        .select("*", { count: "exact" });

      const { count: domainCount } = await supabase
        .from("domains")
        .select("*", { count: "exact" })
        .eq("is_active", true);

      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact" });

      setAnalytics({
        totalEmails: emailCount || 0,
        totalReceived: receivedCount || 0,
        activeUsers: userCount || 0,
        totalDomains: domainCount || 0,
        avgEmailsPerDay: Math.round((emailCount || 0) / days),
        peakHour: "14:00",
        growthRate: 12.5,
        retentionRate: 68.3,
      });

      // Generate trend data
      const trends = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        trends.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          generated: Math.floor(Math.random() * 50) + 20,
          received: Math.floor(Math.random() * 30) + 10,
          opened: Math.floor(Math.random() * 20) + 5,
        });
      }
      setEmailTrends(trends);

      // Domain distribution
      setDomainDistribution([
        { name: "tempmail.dev", value: 45, color: "hsl(var(--primary))" },
        { name: "mailnow.io", value: 25, color: "hsl(var(--accent))" },
        { name: "quickmail.net", value: 20, color: "hsl(var(--neon-green))" },
        { name: "Custom", value: 10, color: "hsl(var(--muted-foreground))" },
      ]);

      // Hourly activity
      const hourly = [];
      for (let i = 0; i < 24; i++) {
        hourly.push({
          hour: `${i.toString().padStart(2, "0")}:00`,
          emails: Math.floor(Math.random() * 100) + 20,
        });
      }
      setHourlyActivity(hourly);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Emails Generated",
      value: analytics.totalEmails.toLocaleString(),
      change: "+12.5%",
      trend: "up",
      icon: Mail,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Emails Received",
      value: analytics.totalReceived.toLocaleString(),
      change: "+8.2%",
      trend: "up",
      icon: Inbox,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Active Users",
      value: analytics.activeUsers.toLocaleString(),
      change: "+5.1%",
      trend: "up",
      icon: Users,
      color: "text-neon-green",
      bgColor: "bg-neon-green/10",
    },
    {
      title: "Active Domains",
      value: analytics.totalDomains.toLocaleString(),
      change: "+2",
      trend: "up",
      icon: Globe,
      color: "text-neon-pink",
      bgColor: "bg-neon-pink/10",
    },
  ];

  const performanceMetrics = [
    {
      title: "Avg. Emails/Day",
      value: analytics.avgEmailsPerDay.toString(),
      icon: Calendar,
    },
    {
      title: "Peak Hour",
      value: analytics.peakHour,
      icon: Clock,
    },
    {
      title: "Growth Rate",
      value: `${analytics.growthRate}%`,
      icon: TrendingUp,
    },
    {
      title: "Retention Rate",
      value: `${analytics.retentionRate}%`,
      icon: Activity,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            Analytics Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor email statistics and usage trends
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px] bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="glass-card border-border/50 hover:border-primary/30 transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-3xl font-bold text-foreground mt-2">
                      {stat.value}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      {stat.trend === "up" ? (
                        <ArrowUp className="w-4 h-4 text-neon-green" />
                      ) : (
                        <ArrowDown className="w-4 h-4 text-destructive" />
                      )}
                      <span className={stat.trend === "up" ? "text-neon-green text-sm" : "text-destructive text-sm"}>
                        {stat.change}
                      </span>
                      <span className="text-muted-foreground text-sm">vs last period</span>
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="trends">Email Trends</TabsTrigger>
          <TabsTrigger value="activity">Hourly Activity</TabsTrigger>
          <TabsTrigger value="domains">Domain Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="trends">
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground">Email Activity Trends</CardTitle>
              <CardDescription>Generated, received, and opened emails over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={emailTrends}>
                    <defs>
                      <linearGradient id="colorGenerated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="generated"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorGenerated)"
                      name="Generated"
                    />
                    <Area
                      type="monotone"
                      dataKey="received"
                      stroke="hsl(var(--accent))"
                      fillOpacity={1}
                      fill="url(#colorReceived)"
                      name="Received"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground">Hourly Email Activity</CardTitle>
              <CardDescription>Email generation pattern throughout the day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyActivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Bar dataKey="emails" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domains">
          <Card className="glass-card border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground">Domain Usage Distribution</CardTitle>
              <CardDescription>Email distribution across different domains</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={domainDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={140}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {domainDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Performance Metrics */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground">Performance Metrics</CardTitle>
          <CardDescription>Key performance indicators at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {performanceMetrics.map((metric, index) => (
              <motion.div
                key={metric.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="text-center p-4 rounded-xl bg-secondary/30 border border-border/30"
              >
                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-primary/10 flex items-center justify-center">
                  <metric.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{metric.title}</p>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalytics;
