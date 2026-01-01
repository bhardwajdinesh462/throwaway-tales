import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/lib/api";
import { 
  Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw, 
  Mail, Clock, TrendingUp, Shield, Zap, AlertCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface MailboxHealth {
  id: string;
  name: string;
  smtp_from: string | null;
  smtp_host: string | null;
  is_active: boolean | null;
  emails_sent_today: number | null;
  emails_sent_this_hour: number | null;
  daily_limit: number | null;
  hourly_limit: number | null;
  last_error: string | null;
  last_error_at: string | null;
  last_sent_at: string | null;
  status: 'healthy' | 'warning' | 'error' | 'inactive';
  recentFailures: number;
  recentSuccesses: number;
  recent_failures?: number;
  recent_successes?: number;
}

interface EmailLogSummary {
  mailbox_id: string;
  mailbox_name: string;
  status: string;
  count: number;
  last_error?: string;
}

const AdminMailboxHealth = () => {
  const [mailboxes, setMailboxes] = useState<MailboxHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<{ type: 'error' | 'warning'; message: string; mailbox: string }[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalSent: 0,
    totalFailed: 0,
    successRate: 100,
    activeMailboxes: 0,
    healthyMailboxes: 0,
  });

  useEffect(() => {
    fetchHealthData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealthData = async () => {
    try {
      // Try PHP backend first
      if (api.isPHP) {
        const { data, error } = await api.admin.getMailboxHealth();
        if (data && !error) {
          const newAlerts: typeof alerts = [];
          const healthyMailboxes = (data.mailboxes || []).map((mailbox: any) => {
            // Check for alert conditions
            if (mailbox.status === 'error' && mailbox.last_error) {
              if (mailbox.last_error.includes('535') || mailbox.last_error.includes('authentication')) {
                newAlerts.push({ type: 'error', message: `Authentication failed: ${mailbox.last_error}`, mailbox: mailbox.name });
              } else if (mailbox.last_error.includes('550') || mailbox.last_error.includes('rate')) {
                newAlerts.push({ type: 'error', message: `Rate limited or blocked: ${mailbox.last_error}`, mailbox: mailbox.name });
              }
            }
            
            const hourlyUsage = (mailbox.emails_sent_this_hour || 0) / (mailbox.hourly_limit || 100);
            const dailyUsage = (mailbox.emails_sent_today || 0) / (mailbox.daily_limit || 1000);
            if (hourlyUsage > 0.9 || dailyUsage > 0.9) {
              newAlerts.push({ type: 'warning', message: `Approaching rate limit (${Math.round(Math.max(hourlyUsage, dailyUsage) * 100)}% used)`, mailbox: mailbox.name });
            }
            
            return {
              ...mailbox,
              recentFailures: mailbox.recent_failures || 0,
              recentSuccesses: mailbox.recent_successes || 0,
            };
          });
          
          setMailboxes(healthyMailboxes);
          setAlerts(newAlerts);
          setOverallStats({
            totalSent: data.stats?.total_sent_24h || 0,
            totalFailed: data.stats?.total_failed_24h || 0,
            successRate: data.stats?.success_rate || 100,
            activeMailboxes: data.stats?.active_mailboxes || 0,
            healthyMailboxes: data.stats?.healthy_mailboxes || 0,
          });
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }
      }

      // Calculate health status for each mailbox
      const newAlerts: typeof alerts = [];
      const healthyMailboxes: MailboxHealth[] = (mailboxData || []).map((mailbox) => {
        const mailboxLogs = (logData || []).filter(l => l.mailbox_id === mailbox.id || l.mailbox_name === mailbox.smtp_from);
        const failures = mailboxLogs.filter(l => l.status === 'failed' || l.status === 'bounced');
        const successes = mailboxLogs.filter(l => l.status === 'sent');

        // Determine status
        let status: MailboxHealth['status'] = 'healthy';
        
        if (!mailbox.is_active) {
          status = 'inactive';
        } else if (mailbox.last_error && mailbox.last_error_at) {
          const errorAge = Date.now() - new Date(mailbox.last_error_at).getTime();
          // If error is within last 30 minutes, it's an error status
          if (errorAge < 30 * 60 * 1000) {
            status = 'error';
            
            // Check for specific error types
            if (mailbox.last_error.includes('535') || mailbox.last_error.includes('authentication')) {
              newAlerts.push({
                type: 'error',
                message: `Authentication failed: ${mailbox.last_error}`,
                mailbox: mailbox.name,
              });
            } else if (mailbox.last_error.includes('550') || mailbox.last_error.includes('rate') || mailbox.last_error.includes('suspicious')) {
              newAlerts.push({
                type: 'error',
                message: `Rate limited or blocked: ${mailbox.last_error}`,
                mailbox: mailbox.name,
              });
            }
          } else if (errorAge < 2 * 60 * 60 * 1000) {
            status = 'warning';
          }
        }

        // Check usage limits
        const hourlyUsage = (mailbox.emails_sent_this_hour || 0) / (mailbox.hourly_limit || 100);
        const dailyUsage = (mailbox.emails_sent_today || 0) / (mailbox.daily_limit || 1000);
        
        if (hourlyUsage > 0.9 || dailyUsage > 0.9) {
          if (status === 'healthy') status = 'warning';
          newAlerts.push({
            type: 'warning',
            message: `Approaching rate limit (${Math.round(Math.max(hourlyUsage, dailyUsage) * 100)}% used)`,
            mailbox: mailbox.name,
          });
        }

        return {
          ...mailbox,
          status,
          recentFailures: failures.length,
          recentSuccesses: successes.length,
        } as MailboxHealth;
      });

      setMailboxes(healthyMailboxes);
      setAlerts(newAlerts);

      // Calculate overall stats
      const totalSent = (logData || []).filter(l => l.status === 'sent').length;
      const totalFailed = (logData || []).filter(l => l.status === 'failed' || l.status === 'bounced').length;
      const successRate = totalSent + totalFailed > 0 
        ? Math.round((totalSent / (totalSent + totalFailed)) * 100) 
        : 100;

      setOverallStats({
        totalSent,
        totalFailed,
        successRate,
        activeMailboxes: healthyMailboxes.filter(m => m.is_active).length,
        healthyMailboxes: healthyMailboxes.filter(m => m.status === 'healthy').length,
      });

    } catch (error: any) {
      console.error("Error fetching health data:", error);
      toast.error("Failed to fetch mailbox health data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHealthData();
  };

  const clearMailboxError = async (mailboxId: string) => {
    try {
      const { error } = await supabase
        .from('mailboxes')
        .update({ last_error: null, last_error_at: null })
        .eq('id', mailboxId);

      if (error) throw error;
      toast.success("Error cleared");
      fetchHealthData();
    } catch (error: any) {
      toast.error("Failed to clear error");
    }
  };

  const getStatusIcon = (status: MailboxHealth['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'inactive':
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: MailboxHealth['status']) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Warning</Badge>;
      case 'error':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Error</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Mailbox Health Monitor
          </h1>
          <p className="text-muted-foreground">Real-time monitoring of email delivery health</p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <Alert key={index} variant={alert.type === 'error' ? 'destructive' : 'default'}>
              {alert.type === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertTitle>{alert.mailbox}</AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{overallStats.totalSent}</p>
                <p className="text-xs text-muted-foreground">Sent (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{overallStats.totalFailed}</p>
                <p className="text-xs text-muted-foreground">Failed (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{overallStats.successRate}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{overallStats.activeMailboxes}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{overallStats.healthyMailboxes}</p>
                <p className="text-xs text-muted-foreground">Healthy</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mailbox Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {mailboxes.map((mailbox) => (
          <Card key={mailbox.id} className={`border-2 ${
            mailbox.status === 'error' ? 'border-red-500/50' :
            mailbox.status === 'warning' ? 'border-yellow-500/50' :
            mailbox.status === 'healthy' ? 'border-green-500/30' :
            'border-border'
          }`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(mailbox.status)}
                  <CardTitle className="text-lg">{mailbox.name}</CardTitle>
                </div>
                {getStatusBadge(mailbox.status)}
              </div>
              <CardDescription className="font-mono text-xs">
                {mailbox.smtp_from} via {mailbox.smtp_host}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Usage bars */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Hourly: {mailbox.emails_sent_this_hour || 0} / {mailbox.hourly_limit || 100}</span>
                  <span>{Math.round(((mailbox.emails_sent_this_hour || 0) / (mailbox.hourly_limit || 100)) * 100)}%</span>
                </div>
                <Progress 
                  value={((mailbox.emails_sent_this_hour || 0) / (mailbox.hourly_limit || 100)) * 100} 
                  className="h-2"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Daily: {mailbox.emails_sent_today || 0} / {mailbox.daily_limit || 1000}</span>
                  <span>{Math.round(((mailbox.emails_sent_today || 0) / (mailbox.daily_limit || 1000)) * 100)}%</span>
                </div>
                <Progress 
                  value={((mailbox.emails_sent_today || 0) / (mailbox.daily_limit || 1000)) * 100} 
                  className="h-2"
                />
              </div>

              {/* Stats */}
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>{mailbox.recentSuccesses} sent</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span>{mailbox.recentFailures} failed</span>
                </div>
              </div>

              {/* Last activity */}
              {mailbox.last_sent_at && (
                <p className="text-xs text-muted-foreground">
                  Last sent: {formatDistanceToNow(new Date(mailbox.last_sent_at), { addSuffix: true })}
                </p>
              )}

              {/* Error display */}
              {mailbox.last_error && mailbox.status === 'error' && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-red-500">Error</p>
                      <p className="text-xs text-red-400 mt-1">{mailbox.last_error}</p>
                      {mailbox.last_error_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(mailbox.last_error_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => clearMailboxError(mailbox.id)}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {mailboxes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No mailboxes configured</p>
            <Button className="mt-4" onClick={() => window.location.href = '/admin/smtp'}>
              Configure SMTP
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminMailboxHealth;
