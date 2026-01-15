import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { 
  FileText, RefreshCw, Trash2, Search, 
  AlertCircle, AlertTriangle, Info, Bug, Filter, 
  CheckCircle, XCircle, ExternalLink, Database, Server, Folder, FileCode
} from "lucide-react";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  ip: string;
  method: string;
  uri: string;
  context: Record<string, any>;
}

interface LogStats {
  total_files: number;
  total_size_bytes: number;
  error_count_today: number;
  warning_count_today: number;
  oldest_log: string | null;
  newest_log: string | null;
}

interface DiagnosticResult {
  timestamp: string;
  status: string;
  issue_count: number;
  issues: string[];
  files: Record<string, { exists: boolean; readable: boolean }>;
  directories: Record<string, { exists: boolean; writable: boolean }>;
  route_tests: Record<string, { url: string; status: string; http_code?: number; response?: any }>;
  database: { connected: boolean; tables?: Record<string, { exists: boolean; count?: number }> };
  htaccess: Record<string, any>;
  mod_rewrite: { enabled: boolean | string };
}

const AdminErrorLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiagLoading, setIsDiagLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [limit, setLimit] = useState(100);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [activeTab, setActiveTab] = useState('logs');

  const isPhpBackend = api.isPHP;

  useEffect(() => {
    loadLogs();
    loadStats();
  }, [levelFilter, typeFilter, limit]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const response = await api.admin.getErrorLogs({
        type: typeFilter !== 'all' ? typeFilter : undefined,
        limit,
        search: searchTerm || undefined,
        level: levelFilter !== 'all' ? levelFilter : undefined,
      });
      
      if (response.data?.logs) {
        setLogs(response.data.logs);
      } else if (Array.isArray(response.data)) {
        setLogs(response.data);
      }
    } catch (e) {
      console.error('Error loading logs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.admin.getLogStats();
      if (response.data) {
        setStats(response.data);
      }
    } catch (e) {
      console.error('Error loading log stats:', e);
    }
  };

  const loadDiagnostics = useCallback(async () => {
    setIsDiagLoading(true);
    try {
      // Fetch diagnostics from routes-test.php
      const response = await fetch(`${api.baseUrl}/routes-test.php`);
      if (response.ok) {
        const data = await response.json();
        setDiagnostics(data);
      } else {
        toast.error('Failed to load diagnostics - routes-test.php may not be deployed');
      }
    } catch (e) {
      console.error('Error loading diagnostics:', e);
      toast.error('Failed to load diagnostics');
    } finally {
      setIsDiagLoading(false);
    }
  }, []);

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs? This cannot be undone.')) return;
    
    setIsClearing(true);
    try {
      await api.admin.clearLogs(typeFilter !== 'all' ? typeFilter : 'all');
      toast.success('Logs cleared successfully');
      loadLogs();
      loadStats();
    } catch (e) {
      toast.error('Failed to clear logs');
    } finally {
      setIsClearing(false);
    }
  };

  const handleSearch = () => {
    loadLogs();
  };

  const getLevelIcon = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
      case 'CRITICAL':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'INFO':
        return <Info className="w-4 h-4 text-blue-500" />;
      case 'DEBUG':
        return <Bug className="w-4 h-4 text-muted-foreground" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getLevelBadge = (level: string) => {
    const variant = {
      'CRITICAL': 'destructive',
      'ERROR': 'destructive',
      'WARNING': 'secondary',
      'INFO': 'outline',
      'DEBUG': 'outline',
    }[level.toUpperCase()] || 'outline';

    return (
      <Badge variant={variant as any} className="text-xs">
        {level}
      </Badge>
    );
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const StatusIcon = ({ ok }: { ok: boolean }) => ok 
    ? <CheckCircle className="w-4 h-4 text-green-500" /> 
    : <XCircle className="w-4 h-4 text-red-500" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="w-8 h-8 text-primary" />
            Error Logs & Diagnostics
          </h1>
          <p className="text-muted-foreground">View error logs and run system diagnostics</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="logs">Error Logs</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>

        {/* Error Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => { loadLogs(); loadStats(); }} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="destructive" onClick={handleClearLogs} disabled={isClearing}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Logs
            </Button>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-500">{stats.error_count_today || 0}</div>
                  <p className="text-sm text-muted-foreground">Errors Today</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-amber-500">{stats.warning_count_today || 0}</div>
                  <p className="text-sm text-muted-foreground">Warnings Today</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stats.total_files || 0}</div>
                  <p className="text-sm text-muted-foreground">Log Files</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{formatBytes(stats.total_size_bytes || 0)}</div>
                  <p className="text-sm text-muted-foreground">Total Size</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Label>Search</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch}>
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="w-[150px]">
                  <Label>Level</Label>
                  <Select value={levelFilter} onValueChange={setLevelFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-[150px]">
                  <Label>Type</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="error">Errors Only</SelectItem>
                      <SelectItem value="app">App Logs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-[100px]">
                  <Label>Limit</Label>
                  <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logs List */}
          <Card>
            <CardHeader>
              <CardTitle>Log Entries ({logs.length})</CardTitle>
              <CardDescription>Recent log entries from the PHP backend</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No log entries found</p>
                  <p className="text-sm mt-2">Logs will appear here when errors occur</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedLog === log ? 'bg-muted border-primary' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedLog(selectedLog === log ? null : log)}
                      >
                        <div className="flex items-start gap-3">
                          {getLevelIcon(log.level)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {getLevelBadge(log.level)}
                              <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                              {log.method && log.uri && (
                                <>
                                  <span className="text-xs text-muted-foreground">•</span>
                                  <span className="text-xs text-muted-foreground">{log.method} {log.uri}</span>
                                </>
                              )}
                            </div>
                            <p className="text-sm font-mono truncate">{log.message}</p>
                            
                            {selectedLog === log && log.context && Object.keys(log.context).length > 0 && (
                              <div className="mt-3 p-3 bg-background rounded border">
                                <p className="text-xs font-semibold mb-2">Context:</p>
                                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(log.context, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                          {log.ip && <span className="text-xs text-muted-foreground shrink-0">{log.ip}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diagnostics Tab */}
        <TabsContent value="diagnostics" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">Run diagnostics to check API routing, files, and database connectivity</p>
            <Button onClick={loadDiagnostics} disabled={isDiagLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isDiagLoading ? 'animate-spin' : ''}`} />
              Run Diagnostics
            </Button>
          </div>

          {!diagnostics && !isDiagLoading && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Click "Run Diagnostics" to check your PHP backend installation. This will test API routes, files, directories, and database connectivity.
              </AlertDescription>
            </Alert>
          )}

          {diagnostics && (
            <div className="space-y-6">
              {/* Overall Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    Overall Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {diagnostics.status === 'healthy' ? (
                      <Badge className="bg-green-500 text-white text-lg px-4 py-2">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Healthy
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-lg px-4 py-2">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        {diagnostics.issue_count} Issue{diagnostics.issue_count !== 1 ? 's' : ''} Found
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      Last checked: {diagnostics.timestamp}
                    </span>
                  </div>

                  {diagnostics.issues && diagnostics.issues.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {diagnostics.issues.map((issue, i) => (
                        <Alert key={i} variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{issue}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Route Tests */}
              {diagnostics.route_tests && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ExternalLink className="w-5 h-5" />
                      API Route Tests
                    </CardTitle>
                    <CardDescription>Testing if API endpoints are accessible</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(diagnostics.route_tests).map(([name, test]) => (
                        <div key={name} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <StatusIcon ok={test.status === 'ok'} />
                            <div>
                              <p className="font-medium">{name}</p>
                              <p className="text-xs text-muted-foreground">{test.url}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={test.status === 'ok' ? 'outline' : 'destructive'}>
                              {test.http_code ? `HTTP ${test.http_code}` : test.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Files & Directories */}
              <div className="grid md:grid-cols-2 gap-6">
                {diagnostics.files && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileCode className="w-5 h-5" />
                        Key Files
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(diagnostics.files).map(([name, status]) => (
                          <div key={name} className="flex items-center justify-between py-1">
                            <span className="font-mono text-sm">{name}</span>
                            <StatusIcon ok={status.exists && status.readable} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {diagnostics.directories && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Folder className="w-5 h-5" />
                        Directories
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(diagnostics.directories).map(([name, status]) => (
                          <div key={name} className="flex items-center justify-between py-1">
                            <span className="font-mono text-sm">{name}/</span>
                            <div className="flex items-center gap-2">
                              {status.writable ? (
                                <Badge variant="outline" className="text-green-600">writable</Badge>
                              ) : status.exists ? (
                                <Badge variant="secondary">read-only</Badge>
                              ) : (
                                <Badge variant="destructive">missing</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Database */}
              {diagnostics.database && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      Database
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 mb-4">
                      <StatusIcon ok={diagnostics.database.connected} />
                      <span className="font-medium">
                        {diagnostics.database.connected ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>
                    
                    {diagnostics.database.tables && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(diagnostics.database.tables).map(([table, info]) => (
                          <div key={table} className="flex items-center justify-between p-2 rounded border">
                            <span className="font-mono text-sm">{table}</span>
                            {info.exists ? (
                              <Badge variant="outline">{info.count} rows</Badge>
                            ) : (
                              <Badge variant="destructive">missing</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* .htaccess Status */}
              {diagnostics.htaccess && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      .htaccess Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(diagnostics.htaccess).map(([name, info]: [string, any]) => (
                        <div key={name} className="p-3 rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <StatusIcon ok={info.exists} />
                            <span className="font-medium">{name}</span>
                          </div>
                          {info.exists && (
                            <div className="flex flex-wrap gap-2 ml-6">
                              {info.has_rewrite_engine && <Badge variant="outline">RewriteEngine</Badge>}
                              {info.has_api_routing && <Badge variant="outline">API Routing</Badge>}
                              {info.has_spa_routing && <Badge variant="outline">SPA Routing</Badge>}
                            </div>
                          )}
                        </div>
                      ))}
                      
                      <div className="flex items-center gap-2 p-3 rounded-lg border">
                        <StatusIcon ok={diagnostics.mod_rewrite?.enabled === true} />
                        <span className="font-medium">mod_rewrite</span>
                        <Badge variant={diagnostics.mod_rewrite?.enabled === true ? 'outline' : 'secondary'}>
                          {diagnostics.mod_rewrite?.enabled === true ? 'enabled' : 
                           diagnostics.mod_rewrite?.enabled === 'unknown' ? 'unknown' : 'disabled'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminErrorLogs;
