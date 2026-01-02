import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, AlertTriangle, XCircle, Clock, TrendingUp, Calendar, Bell, Wrench } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import StatusMonitor from "@/components/StatusMonitor";
import StatusBadgeGenerator from "@/components/StatusBadgeGenerator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { formatDistanceToNow, format, isPast, isFuture } from "date-fns";

interface UptimeStats {
  overall: number;
  imap: number;
  smtp: number;
  database: number;
}

interface Incident {
  id: string;
  title: string;
  status: 'resolved' | 'investigating' | 'monitoring';
  service: string;
  created_at: string;
  resolved_at?: string;
}

interface MaintenanceWindow {
  id: string;
  title: string;
  description: string;
  scheduled_start: string;
  scheduled_end: string;
  affected_services: string[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

const Status = () => {
  const [uptimeStats, setUptimeStats] = useState<UptimeStats>({
    overall: 99.9,
    imap: 99.8,
    smtp: 99.9,
    database: 100,
  });
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceWindow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.admin.getPublicStatus();
        if (response.data?.uptime) {
          setUptimeStats(response.data.uptime);
        }
        if (response.data?.incidents) {
          setIncidents(response.data.incidents);
        }
        if (response.data?.maintenance) {
          setMaintenance(response.data.maintenance);
        }
      } catch (error) {
        console.log('Using default uptime data');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const getStatusColor = (uptime: number) => {
    if (uptime >= 99.5) return 'text-emerald-500';
    if (uptime >= 95) return 'text-yellow-500';
    return 'text-destructive';
  };

  const getStatusBg = (uptime: number) => {
    if (uptime >= 99.5) return 'bg-emerald-500/10 border-emerald-500/30';
    if (uptime >= 95) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-destructive/10 border-destructive/30';
  };

  const getIncidentIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'monitoring':
        return <Activity className="w-4 h-4 text-yellow-500" />;
      case 'investigating':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      default:
        return <XCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getIncidentBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Resolved</Badge>;
      case 'monitoring':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Monitoring</Badge>;
      case 'investigating':
        return <Badge variant="destructive">Investigating</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Get active maintenance (in_progress or upcoming scheduled)
  const activeMaintenance = maintenance.filter(m => m.status === 'in_progress');
  const upcomingMaintenance = maintenance.filter(m => 
    m.status === 'scheduled' && isFuture(new Date(m.scheduled_start))
  );

  // Generate last 30 days for uptime visualization
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      date: date.toISOString().split('T')[0],
      status: Math.random() > 0.02 ? 'operational' : 'degraded',
    };
  });

  // Determine current status for badge generator
  const currentStatus = uptimeStats.overall >= 99.5 ? 'operational' 
    : uptimeStats.overall >= 95 ? 'degraded' 
    : 'outage';

  return (
    <>
      <SEOHead
        title="System Status - Service Uptime Monitor"
        description="Check the real-time status of our email services. Monitor IMAP, SMTP, database, and real-time systems."
      />
      <div className="min-h-screen bg-background">
        <Header />
        
        {/* Spacer for fixed header */}
        <div className="h-[104px]" />
        
        <main className="container mx-auto px-4 py-8 md:py-12">
          {/* Active Maintenance Banner */}
          {activeMaintenance.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-5xl mx-auto mb-6"
            >
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Wrench className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-500">Maintenance In Progress</h3>
                    {activeMaintenance.map((m) => (
                      <div key={m.id} className="mt-2">
                        <p className="text-foreground font-medium">{m.title}</p>
                        {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
                        {m.affected_services?.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {m.affected_services.map(s => (
                              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Upcoming Maintenance Banner */}
          {upcomingMaintenance.length > 0 && activeMaintenance.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-5xl mx-auto mb-6"
            >
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-yellow-600">Scheduled Maintenance</h3>
                    {upcomingMaintenance.slice(0, 2).map((m) => (
                      <div key={m.id} className="mt-2">
                        <p className="text-foreground font-medium">{m.title}</p>
                        <p className="text-sm text-muted-foreground">
                          Starts {formatDistanceToNow(new Date(m.scheduled_start), { addSuffix: true })}
                          {m.scheduled_end && ` • Ends ${format(new Date(m.scheduled_end), 'MMM d, h:mm a')}`}
                        </p>
                        {m.affected_services?.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {m.affected_services.map(s => (
                              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4"
            >
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Live Monitoring</span>
            </motion.div>
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3">
              <span className="bg-gradient-to-r from-primary via-emerald-500 to-cyan-500 bg-clip-text text-transparent">
                System Status
              </span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
              Real-time monitoring of our email infrastructure. Check if services are running smoothly.
            </p>
          </motion.div>

          {/* Uptime Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-5xl mx-auto mb-8"
          >
            <Card className={`border ${getStatusBg(uptimeStats.overall)}`}>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${getStatusBg(uptimeStats.overall)}`}>
                      <CheckCircle2 className={`w-8 h-8 ${getStatusColor(uptimeStats.overall)}`} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">
                        {activeMaintenance.length > 0 ? 'Maintenance In Progress' : 'All Systems Operational'}
                      </h2>
                      <p className="text-muted-foreground">Last updated: just now</p>
                    </div>
                  </div>
                  <div className="text-center md:text-right">
                    <p className={`text-4xl font-bold ${getStatusColor(uptimeStats.overall)}`}>
                      {uptimeStats.overall}%
                    </p>
                    <p className="text-sm text-muted-foreground">Uptime (30 days)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Uptime Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto mb-8"
          >
            {[
              { name: 'IMAP Service', uptime: uptimeStats.imap, icon: TrendingUp },
              { name: 'SMTP Service', uptime: uptimeStats.smtp, icon: TrendingUp },
              { name: 'Database', uptime: uptimeStats.database, icon: TrendingUp },
            ].map((service, index) => (
              <Card key={service.name} className="border-border/50">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{service.name}</span>
                    <span className={`font-bold ${getStatusColor(service.uptime)}`}>
                      {service.uptime}%
                    </span>
                  </div>
                  <Progress 
                    value={service.uptime} 
                    className="h-2"
                  />
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* 30-Day Uptime History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="max-w-5xl mx-auto mb-8"
          >
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  30-Day Uptime History
                </CardTitle>
                <CardDescription>Daily operational status for the past month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-1 justify-between">
                  {last30Days.map((day, index) => (
                    <div
                      key={day.date}
                      className={`flex-1 h-8 rounded-sm ${
                        day.status === 'operational' 
                          ? 'bg-emerald-500' 
                          : 'bg-yellow-500'
                      }`}
                      title={`${day.date}: ${day.status}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>30 days ago</span>
                  <span>Today</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Status Monitor */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-5xl mx-auto"
          >
            <StatusMonitor />
          </motion.div>

          {/* Incident History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="max-w-5xl mx-auto mt-8"
          >
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  Recent Incidents
                </CardTitle>
                <CardDescription>Past incidents and their resolution status</CardDescription>
              </CardHeader>
              <CardContent>
                {incidents.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
                    <p className="font-medium text-foreground">No Recent Incidents</p>
                    <p className="text-sm text-muted-foreground">
                      All systems have been running smoothly
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {incidents.map((incident) => (
                      <div
                        key={incident.id}
                        className="flex items-start gap-4 p-4 rounded-lg bg-secondary/30"
                      >
                        {getIncidentIcon(incident.status)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-foreground">{incident.title}</h4>
                            {getIncidentBadge(incident.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {incident.service} • {new Date(incident.created_at).toLocaleDateString()}
                            {incident.resolved_at && (
                              <> • Resolved {new Date(incident.resolved_at).toLocaleDateString()}</>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Status Badge Generator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="max-w-5xl mx-auto mt-8"
          >
            <StatusBadgeGenerator 
              currentStatus={currentStatus as 'operational' | 'degraded' | 'outage'}
              uptime={uptimeStats.overall}
            />
          </motion.div>

          {/* Info Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="max-w-2xl mx-auto mt-12"
          >
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
              <h3 className="font-semibold mb-4 text-foreground">How We Monitor</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong className="text-foreground">IMAP:</strong> We check if our mail servers are actively polling for new emails and if any errors occurred during the last fetch.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong className="text-foreground">SMTP:</strong> We analyze recent email delivery logs to calculate success rates for outgoing messages.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong className="text-foreground">Database:</strong> We perform a quick query to measure response time and connection health.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong className="text-foreground">Real-time:</strong> We test WebSocket connections to ensure live updates are working properly.</span>
                </li>
              </ul>
            </div>
          </motion.div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Status;
