import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Database,
  Server,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Mail,
  Clock,
  HardDrive,
  Cpu,
  Shield,
  Activity,
  Loader2,
  Settings,
  FileCode,
} from "lucide-react";
import api from "@/lib/api";
import { Progress } from "@/components/ui/progress";

interface TableCheck {
  name: string;
  exists: boolean;
  row_count: number;
}

interface ExtensionCheck {
  name: string;
  loaded: boolean;
  required: boolean;
}

interface ConnectivityCheck {
  name: string;
  reachable: boolean;
  host?: string;
  port?: number;
  error?: string;
  latency_ms?: number;
}

interface DirectoryCheck {
  path: string;
  writable: boolean;
  exists: boolean;
}

interface ConfigCheck {
  key: string;
  is_set: boolean;
  is_default: boolean;
}

interface HealthData {
  database: {
    connected: boolean;
    version: string;
    tables: TableCheck[];
    missing_tables: string[];
  };
  php: {
    version: string;
    memory_limit: string;
    max_execution_time: number;
    extensions: ExtensionCheck[];
  };
  filesystem: DirectoryCheck[];
  connectivity: ConnectivityCheck[];
  configuration: ConfigCheck[];
  cron: {
    last_run: string | null;
    is_running: boolean;
  };
}

const AdminDeploymentHealth = () => {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHealthData = async () => {
    try {
      const response = await api.admin.getDeploymentHealth();
      if (response.data?.health) {
        setHealthData(response.data.health);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch health data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHealthData();
  };

  const getOverallStatus = () => {
    if (!healthData) return "unknown";

    const issues: string[] = [];

    if (!healthData.database.connected) issues.push("Database not connected");
    if (healthData.database.missing_tables.length > 0) issues.push("Missing tables");
    if (healthData.php.extensions.some((e) => e.required && !e.loaded)) issues.push("Missing PHP extensions");
    if (healthData.filesystem.some((d) => !d.writable)) issues.push("Directory permission issues");
    if (healthData.connectivity.some((c) => !c.reachable)) issues.push("Connectivity issues");
    if (healthData.configuration.some((c) => !c.is_set)) issues.push("Missing configuration");

    if (issues.length === 0) return "healthy";
    if (issues.length <= 2) return "warning";
    return "critical";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-emerald-500";
      case "warning":
        return "text-yellow-500";
      case "critical":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Healthy</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Warning</Badge>;
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const overallStatus = getOverallStatus();
  const passedChecks = healthData
    ? [
        healthData.database.connected,
        healthData.database.missing_tables.length === 0,
        healthData.php.extensions.every((e) => !e.required || e.loaded),
        healthData.filesystem.every((d) => d.writable),
        healthData.connectivity.every((c) => c.reachable),
        healthData.configuration.every((c) => c.is_set),
      ].filter(Boolean).length
    : 0;
  const totalChecks = 6;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Deployment Health Check</h2>
          <p className="text-sm text-muted-foreground">
            Verify all required components and configurations are properly set up
          </p>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(overallStatus)}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Overview Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Overall Health</span>
            <span className={`text-sm font-medium ${getStatusColor(overallStatus)}`}>
              {passedChecks} / {totalChecks} checks passed
            </span>
          </div>
          <Progress value={(passedChecks / totalChecks) * 100} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Database Status */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="w-5 h-5 text-primary" />
                Database
              </CardTitle>
              <CardDescription>Connection and table verification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Connection</span>
                {healthData?.database.connected ? (
                  <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                    <Check className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <X className="w-3 h-3 mr-1" />
                    Disconnected
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Version</span>
                <span className="text-sm text-muted-foreground">{healthData?.database.version || "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Tables</span>
                {healthData?.database.missing_tables.length === 0 ? (
                  <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                    {healthData?.database.tables.length} tables OK
                  </Badge>
                ) : (
                  <Badge variant="destructive">{healthData?.database.missing_tables.length} missing</Badge>
                )}
              </div>

              {healthData?.database.missing_tables && healthData.database.missing_tables.length > 0 && (
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-xs font-medium text-destructive mb-2">Missing Tables:</p>
                  <div className="flex flex-wrap gap-1">
                    {healthData.database.missing_tables.map((table) => (
                      <Badge key={table} variant="outline" className="text-xs">
                        {table}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* PHP Environment */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="w-5 h-5 text-primary" />
                PHP Environment
              </CardTitle>
              <CardDescription>PHP version and extensions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">PHP Version</span>
                <span className="text-sm font-mono">{healthData?.php.version || "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Memory Limit</span>
                <span className="text-sm text-muted-foreground">{healthData?.php.memory_limit || "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Max Execution Time</span>
                <span className="text-sm text-muted-foreground">{healthData?.php.max_execution_time || 0}s</span>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Extensions</p>
                <div className="flex flex-wrap gap-2">
                  {healthData?.php.extensions.map((ext) => (
                    <Badge
                      key={ext.name}
                      variant={ext.loaded ? "secondary" : "destructive"}
                      className={ext.loaded ? "bg-emerald-500/10 text-emerald-500" : ""}
                    >
                      {ext.loaded ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                      {ext.name}
                      {ext.required && !ext.loaded && " (required)"}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filesystem */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive className="w-5 h-5 text-primary" />
                Filesystem
              </CardTitle>
              <CardDescription>Directory permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {healthData?.filesystem.map((dir) => (
                <div key={dir.path} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
                  <span className="text-sm font-mono">{dir.path}</span>
                  <div className="flex gap-2">
                    {dir.exists ? (
                      <Badge variant="secondary" className="text-xs">
                        Exists
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        Missing
                      </Badge>
                    )}
                    {dir.writable ? (
                      <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-xs">
                        Writable
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        Not Writable
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Connectivity */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="w-5 h-5 text-primary" />
                Connectivity
              </CardTitle>
              <CardDescription>SMTP and IMAP connection tests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {healthData?.connectivity.map((conn) => (
                <div key={conn.name} className="p-3 bg-secondary/30 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{conn.name}</span>
                    </div>
                    {conn.reachable ? (
                      <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                        <Check className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <X className="w-3 h-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                  </div>
                  {conn.host && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        {conn.host}:{conn.port}
                      </span>
                      {conn.latency_ms !== undefined && <span>{conn.latency_ms}ms</span>}
                    </div>
                  )}
                  {conn.error && <p className="text-xs text-destructive">{conn.error}</p>}
                </div>
              ))}

              {(!healthData?.connectivity || healthData.connectivity.length === 0) && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No mailboxes configured
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Configuration */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="w-5 h-5 text-primary" />
                Configuration
              </CardTitle>
              <CardDescription>Required config values</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {healthData?.configuration.map((config) => (
                <div key={config.key} className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg">
                  <span className="text-sm font-mono">{config.key}</span>
                  <div className="flex gap-2">
                    {config.is_set ? (
                      <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-xs">Set</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        Missing
                      </Badge>
                    )}
                    {config.is_default && (
                      <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-500">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Default
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Cron Jobs */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-5 h-5 text-primary" />
                Cron Jobs
              </CardTitle>
              <CardDescription>Scheduled task status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status</span>
                {healthData?.cron.is_running ? (
                  <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                    <Activity className="w-3 h-3 mr-1" />
                    Running
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Not Running
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Last Run</span>
                <span className="text-sm text-muted-foreground">
                  {healthData?.cron.last_run
                    ? new Date(healthData.cron.last_run).toLocaleString()
                    : "Never"}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Table Details (Expandable) */}
      {healthData?.database.tables && healthData.database.tables.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCode className="w-5 h-5 text-primary" />
                Database Tables
              </CardTitle>
              <CardDescription>All required tables and their row counts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {healthData.database.tables.map((table) => (
                  <div
                    key={table.name}
                    className="flex items-center justify-between p-2 bg-secondary/30 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      {table.exists ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <X className="w-3 h-3 text-destructive" />
                      )}
                      <span className="text-xs font-mono truncate">{table.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {table.row_count}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default AdminDeploymentHealth;
