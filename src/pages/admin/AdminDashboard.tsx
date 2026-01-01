import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Mail, Globe, TrendingUp, Activity, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw, Server, Shield, Key } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import SubscriptionStatsWidget from "@/components/admin/SubscriptionStatsWidget";

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

interface EncryptionHealthResult {
  encryption_key: {
    configured: boolean;
    status: 'healthy' | 'unhealthy' | 'unconfigured';
    message: string;
  };
  database_encryption: {
    encrypt_function: boolean;
    decrypt_function: boolean;
    round_trip_test: boolean;
    status: 'healthy' | 'unhealthy' | 'unconfigured';
    message: string;
  };
  encrypted_data: {
    mailboxes_smtp: { total: number; encrypted: number; plaintext: number };
    mailboxes_imap: { total: number; encrypted: number; plaintext: number };
    user_2fa: { total: number; encrypted: number; plaintext: number };
  };
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checked_at: string;
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
  const [isLoading, setIsLoading] = useState(false);
  const [healthCheck, setHealthCheck] = useState<HealthCheckResult | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [encryptionHealth, setEncryptionHealth] = useState<EncryptionHealthResult | null>(null);
  const [isCheckingEncryption, setIsCheckingEncryption] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch counts in parallel - use email_stats for permanent counter
        const [usersRes, emailStatsRes, domainsRes, receivedRes, activeRes, emailsTodayRes] = await Promise.all([
          api.db.query<{id: string}[]>("profiles", { select: "id", limit: 1000 }),
          api.db.query<{stat_value: number}[]>("email_stats", { filter: { stat_key: "total_emails_generated" }, limit: 1 }),
          api.db.query<{id: string}[]>("domains", { select: "id", limit: 1000 }),
          api.db.query<{id: string}[]>("received_emails", { select: "id", limit: 1000 }),
          api.db.query<{id: string}[]>("temp_emails", { filter: { is_active: true }, select: "id", limit: 1000 }),
          api.db.query<{id: string}[]>("received_emails", { select: "id", limit: 1000 }),
        ]);

        setStats({
          totalUsers: usersRes.data?.length || 0,
          totalEmails: emailStatsRes.data?.[0]?.stat_value || 0,
          totalDomains: domainsRes.data?.length || 0,
          activeEmails: activeRes.data?.length || 0,
          emailsToday: emailsTodayRes.data?.length || 0,
          userGrowth: 12,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchHealthCheck = async () => {
      try {
        const { data: settingsData } = await api.db.query("app_settings", {
          filter: { key: "email_health_check" },
          limit: 1
        });
        const data = settingsData?.[0];
        
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
      const { data, error } = await api.functions.invoke<HealthCheckResult>('email-health-check');
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

  const runEncryptionHealthCheck = async () => {
    setIsCheckingEncryption(true);
    try {
      const { data, error } = await api.functions.invoke<EncryptionHealthResult>('encryption-health-check');
      if (error) throw error;
      setEncryptionHealth(data);
      toast.success("Encryption health check completed");
    } catch (error: any) {
      console.error("Encryption health check error:", error);
      toast.error("Failed to run encryption health check");
    } finally {
      setIsCheckingEncryption(false);
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

      {/* Encryption Security Health */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Encryption Security</h2>
            {encryptionHealth && getStatusBadge(encryptionHealth.overall)}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runEncryptionHealthCheck}
            disabled={isCheckingEncryption}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isCheckingEncryption ? 'animate-spin' : ''}`} />
            {isCheckingEncryption ? 'Checking...' : 'Check Encryption'}
          </Button>
        </div>

        {encryptionHealth ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Encryption Key Status */}
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  <span className="font-medium">Encryption Key</span>
                </div>
                {getStatusIcon(encryptionHealth.encryption_key.status)}
              </div>
              <p className="text-sm text-muted-foreground">
                {encryptionHealth.encryption_key.message}
              </p>
            </div>

            {/* Database Functions Status */}
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  <span className="font-medium">DB Functions</span>
                </div>
                {getStatusIcon(encryptionHealth.database_encryption.status)}
              </div>
              <p className="text-sm text-muted-foreground">
                {encryptionHealth.database_encryption.message}
              </p>
            </div>

            {/* Encrypted Data Status */}
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Data Encryption</span>
                {encryptionHealth.encrypted_data.mailboxes_smtp.plaintext === 0 && 
                 encryptionHealth.encrypted_data.mailboxes_imap.plaintext === 0 &&
                 encryptionHealth.encrypted_data.user_2fa.plaintext === 0 ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                )}
              </div>
              <div className="text-xs space-y-1 text-muted-foreground">
                <p>SMTP: {encryptionHealth.encrypted_data.mailboxes_smtp.encrypted} encrypted, {encryptionHealth.encrypted_data.mailboxes_smtp.plaintext} plaintext</p>
                <p>IMAP: {encryptionHealth.encrypted_data.mailboxes_imap.encrypted} encrypted, {encryptionHealth.encrypted_data.mailboxes_imap.plaintext} plaintext</p>
                <p>2FA: {encryptionHealth.encrypted_data.user_2fa.encrypted} encrypted, {encryptionHealth.encrypted_data.user_2fa.plaintext} plaintext</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center">
            Click "Check Encryption" to verify encryption status
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
                  {stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-xl bg-secondary/50 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Subscription Stats Widget */}
      <SubscriptionStatsWidget />

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
