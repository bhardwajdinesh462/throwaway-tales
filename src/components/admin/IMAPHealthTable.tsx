import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  RefreshCw,
  Star,
  Loader2
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MailboxHealth {
  id: string;
  name: string;
  imap_host: string | null;
  imap_user: string | null;
  is_active: boolean | null;
  is_primary: boolean | null;
  last_polled_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
}

interface IMAPHealthTableProps {
  onRefresh?: () => void;
}

export const IMAPHealthTable = ({ onRefresh }: IMAPHealthTableProps) => {
  const [mailboxes, setMailboxes] = useState<MailboxHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchMailboxes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await api.admin.getMailboxes();
      if (error) throw new Error(error.message);
      
      // Sort: primary first, then active, then by last_polled_at
      const sorted = (data || []).sort((a: MailboxHealth, b: MailboxHealth) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        if (a.is_active && !b.is_active) return -1;
        if (!a.is_active && b.is_active) return 1;
        return 0;
      });
      
      setMailboxes(sorted as MailboxHealth[]);
    } catch (error: any) {
      console.error("Error fetching mailboxes:", error);
      toast.error("Failed to load mailbox health data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMailboxes();
  }, []);

  const getHealthStatus = (mailbox: MailboxHealth) => {
    if (!mailbox.is_active) return "inactive";
    if (!mailbox.imap_host) return "unconfigured";
    
    // Check for recent errors (within 15 minutes)
    if (mailbox.last_error_at) {
      const errorAge = differenceInMinutes(new Date(), new Date(mailbox.last_error_at));
      if (errorAge < 15) return "error";
    }
    
    // Check for stale polling (no poll in last 10 minutes)
    if (mailbox.last_polled_at) {
      const pollAge = differenceInMinutes(new Date(), new Date(mailbox.last_polled_at));
      if (pollAge > 10) return "stale";
    }
    
    // Check if never polled
    if (!mailbox.last_polled_at) return "never_polled";
    
    return "healthy";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge variant="default" className="bg-green-500/20 text-green-600 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Healthy</Badge>;
      case "error":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Error</Badge>;
      case "stale":
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30"><AlertTriangle className="w-3 h-3 mr-1" /> Stale</Badge>;
      case "inactive":
        return <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" /> Inactive</Badge>;
      case "unconfigured":
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> Not Configured</Badge>;
      case "never_polled":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Never Polled</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const handleTestMailbox = async (mailbox: MailboxHealth) => {
    if (!mailbox.imap_host) {
      toast.error("IMAP not configured for this mailbox");
      return;
    }

    setTestingId(mailbox.id);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-imap-emails", {
        body: { mailboxId: mailbox.id, mode: "latest", limit: 5 },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Mailbox ${mailbox.name} is working! Found ${data.stats?.stored || 0} new emails.`);
      } else {
        toast.error(data?.error || "Test failed");
      }
      
      // Refresh the table
      await fetchMailboxes();
      onRefresh?.();
    } catch (error: any) {
      console.error("Error testing mailbox:", error);
      toast.error(error.message || "Test failed");
    } finally {
      setTestingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading mailbox health...</p>
        </CardContent>
      </Card>
    );
  }

  const healthyCount = mailboxes.filter((m) => getHealthStatus(m) === "healthy").length;
  const errorCount = mailboxes.filter((m) => getHealthStatus(m) === "error").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              IMAP Mailbox Health
            </CardTitle>
            <CardDescription>
              Real-time status of all configured IMAP mailboxes
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-600">
              {healthyCount} healthy
            </Badge>
            {errorCount > 0 && (
              <Badge variant="destructive">
                {errorCount} errors
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={fetchMailboxes}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mailboxes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No mailboxes configured. Add a mailbox in SMTP Settings first.
          </div>
        ) : (
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mailbox</TableHead>
                  <TableHead>IMAP Host</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Poll</TableHead>
                  <TableHead>Last Error</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mailboxes.map((mailbox) => {
                  const status = getHealthStatus(mailbox);
                  const isInCooldown = mailbox.last_error_at && 
                    differenceInMinutes(new Date(), new Date(mailbox.last_error_at)) < 15;
                  
                  return (
                    <TableRow key={mailbox.id} className={status === "error" ? "bg-destructive/5" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {mailbox.is_primary && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          )}
                          <span className="font-medium">{mailbox.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {mailbox.imap_host ? (
                          <span>{mailbox.imap_host}</span>
                        ) : (
                          <span className="italic">Not configured</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(status)}</TableCell>
                      <TableCell className="text-sm">
                        {mailbox.last_polled_at ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-muted-foreground">
                                {formatDistanceToNow(new Date(mailbox.last_polled_at), { addSuffix: true })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {new Date(mailbox.last_polled_at).toLocaleString()}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground italic">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px]">
                        {mailbox.last_error ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-1">
                                <span className="text-destructive truncate max-w-[150px]">
                                  {mailbox.last_error.slice(0, 30)}...
                                </span>
                                {isInCooldown && (
                                  <Badge variant="outline" className="text-[10px] px-1">
                                    Cooldown
                                  </Badge>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="text-sm">{mailbox.last_error}</p>
                              {mailbox.last_error_at && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(new Date(mailbox.last_error_at), { addSuffix: true })}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground italic">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestMailbox(mailbox)}
                          disabled={testingId === mailbox.id || !mailbox.imap_host}
                        >
                          {testingId === mailbox.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          <span className="ml-1">Test</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
};

export default IMAPHealthTable;
