import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { 
  FileText, RefreshCw, Trash2, Download, Search, 
  AlertCircle, AlertTriangle, Info, Bug, Filter
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

const AdminErrorLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [limit, setLimit] = useState(100);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const isPhpBackend = api.isPHP;

  useEffect(() => {
    if (isPhpBackend) {
      loadLogs();
      loadStats();
    }
  }, [isPhpBackend, levelFilter, typeFilter, limit]);

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
      }
    } catch (e) {
      console.error('Error loading logs:', e);
      toast.error('Failed to load error logs');
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
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isPhpBackend) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="w-8 h-8 text-primary" />
          Error Logs
        </h1>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error logs are only available for self-hosted PHP backend installations.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="w-8 h-8 text-primary" />
            Error Logs
          </h1>
          <p className="text-muted-foreground">View and manage PHP backend error logs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { loadLogs(); loadStats(); }} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="destructive" onClick={handleClearLogs} disabled={isClearing}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Logs
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-500">{stats.error_count_today}</div>
              <p className="text-sm text-muted-foreground">Errors Today</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-amber-500">{stats.warning_count_today}</div>
              <p className="text-sm text-muted-foreground">Warnings Today</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total_files}</div>
              <p className="text-sm text-muted-foreground">Log Files</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{formatBytes(stats.total_size_bytes)}</div>
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
                        <div className="flex items-center gap-2 mb-1">
                          {getLevelBadge(log.level)}
                          <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{log.method} {log.uri}</span>
                        </div>
                        <p className="text-sm font-mono truncate">{log.message}</p>
                        
                        {selectedLog === log && Object.keys(log.context).length > 0 && (
                          <div className="mt-3 p-3 bg-background rounded border">
                            <p className="text-xs font-semibold mb-2">Context:</p>
                            <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(log.context, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{log.ip}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminErrorLogs;
