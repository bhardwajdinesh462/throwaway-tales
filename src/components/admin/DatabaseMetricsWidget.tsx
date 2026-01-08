import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Database, HardDrive, Mail, Users, Trash2, RefreshCw, Clock, FileText, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface DatabaseMetrics {
  tables: {
    received_emails: { count: number; size_estimate_mb: number };
    temp_emails: { count: number; size_estimate_mb: number };
    email_attachments: { count: number; storage_mb: number };
    profiles: { count: number; size_estimate_mb: number };
    rate_limits: { count: number; size_estimate_mb: number };
  };
  stats: {
    total_emails_generated: number;
    emails_today: number;
    inboxes_today: number;
  };
  cleanup: {
    last_run: string | null;
    stats: {
      emails_deleted?: number;
      attachments_deleted?: number;
      temp_emails_deleted?: number;
    } | null;
  };
  total_estimated_size_mb: number;
  fetched_at: string;
}

const DatabaseMetricsWidget = () => {
  const [metrics, setMetrics] = useState<DatabaseMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await api.functions.invoke<DatabaseMetrics>('get-database-metrics');
      if (error) throw error;
      setMetrics(data);
    } catch (error: any) {
      console.error('Error fetching database metrics:', error);
      toast.error('Failed to fetch database metrics');
    } finally {
      setIsLoading(false);
    }
  };

  const runCleanup = async () => {
    setIsRunningCleanup(true);
    try {
      const { data, error } = await api.functions.invoke('auto-delete-emails');
      if (error) throw error;
      
      toast.success('Cleanup completed successfully');
      // Refresh metrics after cleanup
      await fetchMetrics();
    } catch (error: any) {
      console.error('Error running cleanup:', error);
      toast.error('Failed to run cleanup');
    } finally {
      setIsRunningCleanup(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const formatBytes = (mb: number) => {
    if (mb < 1) return `${(mb * 1024).toFixed(1)} KB`;
    if (mb < 1024) return `${mb.toFixed(2)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // Estimate max storage (for progress bars) - assume 1GB limit
  const maxStorageMb = 1024;
  const usagePercent = metrics ? (metrics.total_estimated_size_mb / maxStorageMb) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Database Metrics</h2>
          {metrics && (
            <Badge variant="outline" className="ml-2">
              {formatBytes(metrics.total_estimated_size_mb)} total
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runCleanup}
            disabled={isRunningCleanup}
          >
            <Trash2 className={`w-4 h-4 mr-2 ${isRunningCleanup ? 'animate-pulse' : ''}`} />
            {isRunningCleanup ? 'Cleaning...' : 'Run Cleanup'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {metrics ? (
        <>
          {/* Storage Overview */}
          <div className="mb-6 p-4 rounded-lg bg-secondary/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-primary" />
                <span className="font-medium">Estimated Storage Usage</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatBytes(metrics.total_estimated_size_mb)} / {formatBytes(maxStorageMb)}
              </span>
            </div>
            <Progress value={Math.min(usagePercent, 100)} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Last updated: {new Date(metrics.fetched_at).toLocaleString()}
            </p>
          </div>

          {/* Table Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Received Emails */}
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-5 h-5 text-primary" />
                <span className="font-medium">Received Emails</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatNumber(metrics.tables.received_emails.count)}
              </p>
              <p className="text-sm text-muted-foreground">
                ~{formatBytes(metrics.tables.received_emails.size_estimate_mb)}
              </p>
            </div>

            {/* Temp Emails */}
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-accent" />
                <span className="font-medium">Temp Emails</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatNumber(metrics.tables.temp_emails.count)}
              </p>
              <p className="text-sm text-muted-foreground">
                ~{formatBytes(metrics.tables.temp_emails.size_estimate_mb)}
              </p>
            </div>

            {/* Attachments */}
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-neon-green" />
                <span className="font-medium">Attachments</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatNumber(metrics.tables.email_attachments.count)}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatBytes(metrics.tables.email_attachments.storage_mb)} storage
              </p>
            </div>

            {/* Profiles */}
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-neon-pink" />
                <span className="font-medium">User Profiles</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatNumber(metrics.tables.profiles.count)}
              </p>
              <p className="text-sm text-muted-foreground">
                ~{formatBytes(metrics.tables.profiles.size_estimate_mb)}
              </p>
            </div>

            {/* Rate Limits */}
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-yellow-500" />
                <span className="font-medium">Rate Limit Records</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {formatNumber(metrics.tables.rate_limits.count)}
              </p>
              <p className="text-sm text-muted-foreground">
                ~{formatBytes(metrics.tables.rate_limits.size_estimate_mb)}
              </p>
            </div>

            {/* Cleanup Info */}
            <div className="p-4 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="w-5 h-5 text-destructive" />
                <span className="font-medium">Last Cleanup</span>
              </div>
              <p className="text-sm text-foreground">
                {metrics.cleanup.last_run 
                  ? new Date(metrics.cleanup.last_run).toLocaleString()
                  : 'Never run'}
              </p>
              {metrics.cleanup.stats && (
                <p className="text-xs text-muted-foreground mt-1">
                  Deleted: {metrics.cleanup.stats.emails_deleted || 0} emails, {metrics.cleanup.stats.attachments_deleted || 0} attachments
                </p>
              )}
            </div>
          </div>

          {/* Stats Summary */}
          <div className="p-4 rounded-lg bg-secondary/30">
            <h3 className="font-medium mb-3">Email Statistics</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-bold text-primary">{formatNumber(metrics.stats.total_emails_generated)}</p>
                <p className="text-xs text-muted-foreground">Total Generated</p>
              </div>
              <div>
                <p className="text-xl font-bold text-accent">{formatNumber(metrics.stats.emails_today)}</p>
                <p className="text-xs text-muted-foreground">Emails Today</p>
              </div>
              <div>
                <p className="text-xl font-bold text-neon-green">{formatNumber(metrics.stats.inboxes_today)}</p>
                <p className="text-xs text-muted-foreground">Inboxes Today</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading metrics...</span>
            </div>
          ) : (
            <p>Failed to load database metrics</p>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default DatabaseMetricsWidget;
