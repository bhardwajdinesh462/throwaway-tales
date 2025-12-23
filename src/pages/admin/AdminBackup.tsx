import { useState, useEffect } from "react";
import { 
  Download, 
  Clock, 
  HardDrive, 
  AlertTriangle,
  CheckCircle,
  Loader2,
  Database,
  Trash2,
  RefreshCw,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";

interface BackupHistory {
  id: string;
  backup_type: string;
  status: string | null;
  file_size_bytes: number | null;
  tables_included: string[] | null;
  row_counts: Record<string, number> | null;
  created_at: string | null;
  expires_at: string | null;
  created_by: string | null;
}

const AdminBackup = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<BackupHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('backup_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      // Map database response to BackupHistory interface
      const mappedData: BackupHistory[] = (data || []).map((item) => ({
        id: item.id,
        backup_type: item.backup_type,
        status: item.status,
        file_size_bytes: item.file_size_bytes,
        tables_included: item.tables_included,
        row_counts: item.row_counts as Record<string, number> | null,
        created_at: item.created_at,
        expires_at: item.expires_at,
        created_by: item.created_by,
      }));
      setHistory(mappedData);
    } catch (error) {
      console.error('Error fetching backup history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const generateBackup = async () => {
    setIsGenerating(true);
    setProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const { data, error } = await supabase.functions.invoke('generate-backup');

      clearInterval(progressInterval);

      if (error) throw error;

      setProgress(100);

      // Create downloadable file
      const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Backup downloaded successfully!');
      fetchHistory();
    } catch (error) {
      console.error('Error generating backup:', error);
      toast.error('Failed to generate backup');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const deleteBackupRecord = async (id: string) => {
    if (!confirm('Delete this backup record?')) return;

    try {
      const { error } = await supabase
        .from('backup_history')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Backup record deleted');
      fetchHistory();
    } catch (error) {
      console.error('Error deleting backup:', error);
      toast.error('Failed to delete backup record');
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Backup & Recovery</h1>
          <p className="text-muted-foreground">Download complete database backups to your device</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={fetchHistory} variant="outline" size="icon">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Refresh backup history</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Warning Alert */}
      <Alert className="border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-600">Important Notice</AlertTitle>
        <AlertDescription className="text-amber-600/80">
          Backups are generated on-demand and downloaded directly to your device. 
          Backup records are automatically deleted after 24 hours. Store your backups safely.
        </AlertDescription>
      </Alert>

      {/* Generate Backup Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Generate New Backup
          </CardTitle>
          <CardDescription>
            Download a complete backup of all database tables
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <p className="text-muted-foreground">Tables</p>
                  <p className="font-semibold text-foreground">15+</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>All user and system tables are included</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <p className="text-muted-foreground">Format</p>
                  <p className="font-semibold text-foreground">JSON</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Backup is exported as JSON file</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <p className="text-muted-foreground">Storage</p>
                  <p className="font-semibold text-foreground">Local</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Downloaded directly to your device</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <p className="text-muted-foreground">Expiry</p>
                  <p className="font-semibold text-foreground">24 hours</p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Backup records auto-delete after 24 hours</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Generating backup...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={generateBackup} 
                disabled={isGenerating}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Backup...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download Backup Now
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Generate and download complete database backup</p>
            </TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Backup History
          </CardTitle>
          <CardDescription>
            Recent backup records (auto-delete after 24 hours)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <HardDrive className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-foreground mb-2">No backup history</h3>
              <p className="text-muted-foreground text-sm">Generate your first backup to see it here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((backup) => (
                <div 
                  key={backup.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    isExpired(backup.expires_at) ? 'opacity-50 bg-secondary/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      backup.status === 'completed' ? 'bg-green-500/20' : 'bg-amber-500/20'
                    }`}>
                      {backup.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                          Backup - {format(new Date(backup.created_at), 'MMM d, yyyy HH:mm')}
                        </p>
                        <Badge variant={backup.backup_type === 'manual' ? 'default' : 'secondary'}>
                          {backup.backup_type}
                        </Badge>
                        {isExpired(backup.expires_at) && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>{formatBytes(backup.file_size_bytes)}</span>
                        <span>•</span>
                        <span>
                          {isExpired(backup.expires_at) 
                            ? 'Expired' 
                            : `Expires ${formatDistanceToNow(new Date(backup.expires_at), { addSuffix: true })}`
                          }
                        </span>
                        {backup.row_counts && (
                          <>
                            <span>•</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1 cursor-help">
                                  <Info className="w-3 h-3" />
                                  {Object.values(backup.row_counts).reduce((a, b) => a + b, 0)} rows
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs">
                                  {Object.entries(backup.row_counts).map(([table, count]) => (
                                    <div key={table}>{table}: {count}</div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteBackupRecord(backup.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete backup record</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What's Included</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• User profiles and settings</li>
              <li>• Temporary emails and history</li>
              <li>• Domains and configuration</li>
              <li>• Blog posts and pages</li>
              <li>• Subscriptions and payments</li>
              <li>• All app settings</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Important Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Backups do not include user passwords</li>
              <li>• File attachments are not included</li>
              <li>• Store backups securely offline</li>
              <li>• Records auto-delete after 24 hours</li>
              <li>• Generate backups regularly</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminBackup;
