import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { 
  Mail, Search, RefreshCw, Loader2, CheckCircle, XCircle, AlertTriangle,
  ChevronLeft, ChevronRight, Filter, BarChart3, Clock, Server
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";

interface EmailLog {
  id: string;
  mailbox_id: string | null;
  mailbox_name: string | null;
  recipient_email: string;
  subject: string | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
  smtp_response: string | null;
  smtp_host: string | null;
  config_source: string | null;
  message_id: string | null;
  attempt_count: number;
  created_at: string;
  sent_at: string | null;
  failed_at: string | null;
  total_count: number;
}

interface EmailStats {
  total_sent: number;
  total_failed: number;
  total_bounced: number;
  sent_today: number;
  failed_today: number;
  success_rate: number;
}

const AdminEmailLogs = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const pageSize = 20;

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [page, statusFilter]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await api.admin.getEmailLogs({
        page,
        pageSize,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined
      });

      if (error) throw new Error(error.message);

      setLogs(data || []);
      if (data && data.length > 0) {
        setTotalCount(Number(data[0].total_count) || 0);
      } else {
        setTotalCount(0);
      }
    } catch (error: any) {
      console.error("Error fetching logs:", error);
      toast.error("Failed to load email logs");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const { data, error } = await api.admin.getEmailStats();
      if (error) throw new Error(error.message);
      if (data && data.length > 0) {
        setStats(data[0]);
      }
    } catch (error: any) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'bounced':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30"><AlertTriangle className="w-3 h-3 mr-1" />Bounced</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getConfigSourceBadge = (source: string | null) => {
    switch (source) {
      case 'DATABASE_MAILBOX':
        return <Badge variant="outline" className="text-xs"><Server className="w-3 h-3 mr-1" />DB</Badge>;
      case 'REQUEST':
        return <Badge variant="outline" className="text-xs">Request</Badge>;
      case 'ENV_VARIABLES':
        return <Badge variant="outline" className="text-xs">ENV</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="w-8 h-8 text-primary" />
            Email Logs
          </h1>
          <p className="text-muted-foreground">Monitor email sends, errors, and bounces</p>
        </div>
        <Button variant="outline" onClick={() => { fetchLogs(); fetchStats(); }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{isLoadingStats ? '-' : stats?.total_sent || 0}</p>
                <p className="text-xs text-muted-foreground">Total Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{isLoadingStats ? '-' : stats?.total_failed || 0}</p>
                <p className="text-xs text-muted-foreground">Total Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{isLoadingStats ? '-' : stats?.total_bounced || 0}</p>
                <p className="text-xs text-muted-foreground">Bounced</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <div>
                <p className="text-2xl font-bold">{isLoadingStats ? '-' : stats?.sent_today || 0}</p>
                <p className="text-xs text-muted-foreground">Sent Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{isLoadingStats ? '-' : stats?.failed_today || 0}</p>
                <p className="text-xs text-muted-foreground">Failed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <div>
                <p className="text-2xl font-bold">{isLoadingStats ? '-' : `${stats?.success_rate || 0}%`}</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by recipient, subject, or error..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Email History</CardTitle>
          <CardDescription>
            {totalCount} total logs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No email logs found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Host</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell className="font-mono text-sm max-w-[200px] truncate">
                          {log.recipient_email}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {log.subject || '-'}
                        </TableCell>
                        <TableCell>{getConfigSourceBadge(log.config_source)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {log.smtp_host || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), 'MMM d, HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                                Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle>Email Log Details</DialogTitle>
                                <DialogDescription>
                                  Full details for this email attempt
                                </DialogDescription>
                              </DialogHeader>
                              {selectedLog && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                                      <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Attempts</p>
                                      <p className="mt-1">{selectedLog.attempt_count}</p>
                                    </div>
                                  </div>

                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">Recipient</p>
                                    <p className="mt-1 font-mono text-sm">{selectedLog.recipient_email}</p>
                                  </div>

                                  <div>
                                    <p className="text-sm font-medium text-muted-foreground">Subject</p>
                                    <p className="mt-1">{selectedLog.subject || '-'}</p>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">SMTP Host</p>
                                      <p className="mt-1 font-mono text-sm">{selectedLog.smtp_host || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Config Source</p>
                                      <p className="mt-1">{selectedLog.config_source || '-'}</p>
                                    </div>
                                  </div>

                                  {selectedLog.error_code && (
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Error Code</p>
                                      <p className="mt-1 font-mono text-destructive">{selectedLog.error_code}</p>
                                    </div>
                                  )}

                                  {selectedLog.error_message && (
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Error Message</p>
                                      <p className="mt-1 text-sm text-destructive bg-destructive/10 p-2 rounded">
                                        {selectedLog.error_message}
                                      </p>
                                    </div>
                                  )}

                                  {selectedLog.message_id && (
                                    <div>
                                      <p className="text-sm font-medium text-muted-foreground">Message ID</p>
                                      <p className="mt-1 font-mono text-xs break-all">{selectedLog.message_id}</p>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">Created</p>
                                      <p>{format(new Date(selectedLog.created_at), 'PPpp')}</p>
                                    </div>
                                    {selectedLog.sent_at && (
                                      <div>
                                        <p className="text-muted-foreground">Sent</p>
                                        <p>{format(new Date(selectedLog.sent_at), 'PPpp')}</p>
                                      </div>
                                    )}
                                    {selectedLog.failed_at && (
                                      <div>
                                        <p className="text-muted-foreground">Failed</p>
                                        <p>{format(new Date(selectedLog.failed_at), 'PPpp')}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminEmailLogs;
