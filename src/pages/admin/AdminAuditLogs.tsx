import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Clock, User, Database, Eye, RefreshCw, Search, Ban, CheckCircle, Trash2, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  admin_user_id: string;
  admin_email?: string | null;
  admin_name?: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  details: unknown;
  ip_address: string | null;
  created_at: string;
  total_count?: number;
}

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      // Try the new RPC function first for better data
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_admin_audit_logs', {
        p_page: page,
        p_page_size: pageSize,
        p_action_filter: searchTerm || null
      });

      if (!rpcError && rpcData) {
        setLogs(rpcData.map((row: any) => ({
          id: row.id,
          admin_user_id: '',
          admin_email: row.admin_email,
          admin_name: row.admin_name,
          action: row.action,
          table_name: row.table_name,
          record_id: row.record_id,
          details: row.details,
          ip_address: null,
          created_at: row.created_at
        })));
        setTotalCount(Number(rpcData[0]?.total_count) || 0);
        return;
      }

      // Fallback to direct query
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('permission')) {
          toast.error('Access denied. Admin privileges required.');
        } else {
          throw error;
        }
        return;
      }

      setLogs(data || []);
      setTotalCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to fetch audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, searchTerm]);

  const filteredLogs = logs;

  const totalPages = Math.ceil(totalCount / pageSize);

  const getActionBadgeVariant = (action: string): "default" | "secondary" | "destructive" | "outline" => {
    if (action.includes('VIEW')) return 'secondary';
    if (action.includes('CREATE') || action.includes('INSERT') || action.includes('ADD')) return 'default';
    if (action.includes('UPDATE') || action.includes('UNSUSPEND')) return 'outline';
    if (action.includes('DELETE') || action.includes('SUSPEND') || action.includes('REMOVE')) return 'destructive';
    return 'secondary';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('VIEW')) return <Eye className="w-3 h-3" />;
    if (action.includes('DELETE') || action.includes('BULK_DELETE')) return <Trash2 className="w-3 h-3" />;
    if (action.includes('SUSPEND')) return <Ban className="w-3 h-3" />;
    if (action.includes('UNSUSPEND')) return <CheckCircle className="w-3 h-3" />;
    if (action.includes('ROLE')) return <Shield className="w-3 h-3" />;
    if (action.includes('SETTING')) return <Settings className="w-3 h-3" />;
    if (action.includes('CREATE') || action.includes('INSERT')) return <Database className="w-3 h-3" />;
    return <Shield className="w-3 h-3" />;
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="glass-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Admin Audit Logs
                </CardTitle>
                <CardDescription>
                  Track all admin actions for security monitoring
                </CardDescription>
              </div>
              <Button variant="outline" onClick={fetchLogs} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by action, table, or user ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-secondary/50"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                <p className="text-2xl font-bold text-foreground">{logs.length}</p>
                <p className="text-sm text-muted-foreground">Total Logs</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                <p className="text-2xl font-bold text-foreground">
                  {logs.filter(l => l.action.includes('VIEW')).length}
                </p>
                <p className="text-sm text-muted-foreground">View Actions</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                <p className="text-2xl font-bold text-foreground">
                  {logs.filter(l => l.action.includes('UPDATE') || l.action.includes('CREATE')).length}
                </p>
                <p className="text-sm text-muted-foreground">Modifications</p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                <p className="text-2xl font-bold text-foreground">
                  {new Set(logs.map(l => l.admin_user_id)).size}
                </p>
                <p className="text-sm text-muted-foreground">Unique Admins</p>
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No audit logs found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Admin actions will be logged here for security monitoring
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/30">
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Admin ID</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow 
                        key={log.id} 
                        className="hover:bg-secondary/20 cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-foreground">
                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(log.action)} className="gap-1">
                            {getActionIcon(log.action)}
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Database className="w-3 h-3 text-muted-foreground" />
                            <span className="font-mono text-sm">{log.table_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <div>
                              <span className="text-sm text-foreground">
                                {log.admin_name || 'Unknown'}
                              </span>
                              {log.admin_email && (
                                <p className="text-xs text-muted-foreground">{log.admin_email}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.details ? (
                            <Button variant="ghost" size="sm" onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}>
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({totalCount} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Details Modal */}
            {selectedLog && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
                onClick={() => setSelectedLog(null)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  className="glass-card p-6 max-w-2xl w-full max-h-[80vh] overflow-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Audit Log Details
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Action</p>
                        <Badge variant={getActionBadgeVariant(selectedLog.action)}>
                          {selectedLog.action}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Table</p>
                        <p className="font-mono text-foreground">{selectedLog.table_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Admin ID</p>
                        <p className="font-mono text-xs text-foreground">{selectedLog.admin_user_id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Timestamp</p>
                        <p className="text-foreground">
                          {format(new Date(selectedLog.created_at), 'PPpp')}
                        </p>
                      </div>
                      {selectedLog.record_id && (
                        <div>
                          <p className="text-sm text-muted-foreground">Record ID</p>
                          <p className="font-mono text-xs text-foreground">{selectedLog.record_id}</p>
                        </div>
                      )}
                      {selectedLog.ip_address && (
                        <div>
                          <p className="text-sm text-muted-foreground">IP Address</p>
                          <p className="font-mono text-foreground">{selectedLog.ip_address}</p>
                        </div>
                      )}
                    </div>
                    {selectedLog.details && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Details</p>
                        <pre className="p-4 rounded-lg bg-secondary/50 border border-border overflow-x-auto text-xs text-foreground">
                          {JSON.stringify(selectedLog.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button variant="outline" onClick={() => setSelectedLog(null)}>
                      Close
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AdminAuditLogs;
