import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { Mail, Ban, Plus, Trash2, Clock, AlertTriangle, RefreshCw, Code } from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";

interface BlockedEmail {
  id: string;
  email_pattern: string;
  reason: string | null;
  blocked_by: string;
  blocked_at: string;
  expires_at: string | null;
  is_active: boolean;
  is_regex: boolean;
}

const AdminEmailBlocking = () => {
  const { user } = useAuth();
  const [blockedEmails, setBlockedEmails] = useState<BlockedEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [emailPattern, setEmailPattern] = useState("");
  const [reason, setReason] = useState("");
  const [expiration, setExpiration] = useState("permanent");
  const [isRegex, setIsRegex] = useState(false);

  useEffect(() => {
    loadBlockedEmails();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('blocked-emails-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocked_emails'
        },
        () => {
          loadBlockedEmails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadBlockedEmails = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("blocked_emails")
      .select("*")
      .order("blocked_at", { ascending: false });

    if (error) {
      console.error("Error loading blocked emails:", error);
      toast.error("Failed to load blocked emails");
    } else {
      setBlockedEmails(data || []);
    }
    setIsLoading(false);
  };

  const handleBlockEmail = async () => {
    if (!emailPattern.trim()) {
      toast.error("Please enter an email pattern");
      return;
    }

    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    // Validate regex if is_regex is true
    if (isRegex) {
      try {
        new RegExp(emailPattern);
      } catch (e) {
        toast.error("Invalid regex pattern");
        return;
      }
    }

    setIsSubmitting(true);

    // Calculate expiration
    let expiresAt: string | null = null;
    if (expiration !== "permanent") {
      const hours = parseInt(expiration);
      expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }

    const { error } = await supabase
      .from("blocked_emails")
      .insert([{
        email_pattern: emailPattern.trim().toLowerCase(),
        reason: reason.trim() || null,
        blocked_by: user.id,
        expires_at: expiresAt,
        is_regex: isRegex,
      }]);

    if (error) {
      if (error.code === "23505") {
        toast.error("This email pattern is already blocked");
      } else {
        toast.error("Failed to block email: " + error.message);
      }
    } else {
      toast.success(`Email pattern "${emailPattern}" has been blocked`);
      setEmailPattern("");
      setReason("");
      setExpiration("permanent");
      setIsRegex(false);
      setIsDialogOpen(false);
      loadBlockedEmails();
    }
    setIsSubmitting(false);
  };

  const handleUnblockEmail = async (id: string, pattern: string) => {
    const { error } = await supabase
      .from("blocked_emails")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast.error("Failed to unblock email");
    } else {
      toast.success(`Email pattern "${pattern}" has been unblocked`);
      loadBlockedEmails();
    }
  };

  const handleDeleteEmail = async (id: string) => {
    const { error } = await supabase
      .from("blocked_emails")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete record");
    } else {
      toast.success("Record deleted");
      loadBlockedEmails();
    }
  };

  const getExpirationStatus = (expiresAt: string | null, isActive: boolean) => {
    if (!isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (!expiresAt) {
      return <Badge variant="destructive">Permanent</Badge>;
    }
    const expiry = new Date(expiresAt);
    if (expiry < new Date()) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    return (
      <Badge variant="outline" className="text-amber-500 border-amber-500/30">
        {formatDistanceToNow(expiry, { addSuffix: true })}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Mail className="w-6 h-6 sm:w-8 sm:h-8 text-destructive" />
            Email Blocking
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">Block email addresses from registering on the site</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadBlockedEmails} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Block Email
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Ban className="w-5 h-5 text-destructive" />
                  Block Email Pattern
                </DialogTitle>
                <DialogDescription>
                  Add an email or pattern to the blocklist. Blocked emails cannot register on the site.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Pattern *</Label>
                  <Input
                    id="email"
                    value={emailPattern}
                    onChange={(e) => setEmailPattern(e.target.value)}
                    placeholder="spam@example.com or *@spam.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use * as wildcard (e.g., *@spam.com) or enable regex for complex patterns
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="regex"
                    checked={isRegex}
                    onCheckedChange={setIsRegex}
                  />
                  <Label htmlFor="regex" className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Use Regex Pattern
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for blocking this email..."
                    rows={2}
                    maxLength={500}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Block Duration</Label>
                  <Select value={expiration} onValueChange={setExpiration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="168">7 days</SelectItem>
                      <SelectItem value="720">30 days</SelectItem>
                      <SelectItem value="permanent">Permanent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleBlockEmail}
                  disabled={!emailPattern || isSubmitting}
                >
                  {isSubmitting ? "Blocking..." : "Block Email"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Warning */}
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-600 dark:text-amber-400">Email Blocking Notice</p>
            <p className="text-sm text-muted-foreground">
              Blocked email patterns will prevent users from registering with matching addresses.
              Use wildcards (*) for domain-wide blocking or regex for complex patterns.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{blockedEmails.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {blockedEmails.filter(e => e.is_active && (!e.expires_at || new Date(e.expires_at) > new Date())).length}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Regex Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {blockedEmails.filter(e => e.is_regex).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Blocked Emails Table */}
      <Card>
        <CardHeader>
          <CardTitle>Blocked Email Patterns</CardTitle>
          <CardDescription>Manage blocked email patterns</CardDescription>
        </CardHeader>
        <CardContent>
          {blockedEmails.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No blocked emails</p>
              <p className="text-sm text-muted-foreground">Click "Block Email" to add a pattern to the blocklist</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pattern</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="hidden md:table-cell">Reason</TableHead>
                    <TableHead className="hidden sm:table-cell">Blocked</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedEmails.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell className="font-mono text-xs sm:text-sm max-w-[150px] truncate">
                        {email.email_pattern}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {email.is_regex ? (
                          <Badge variant="outline" className="text-xs">
                            <Code className="w-3 h-3 mr-1" />
                            Regex
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Pattern</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate">
                        {email.reason || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                        {formatDistanceToNow(new Date(email.blocked_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>{getExpirationStatus(email.expires_at, email.is_active)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {email.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnblockEmail(email.id, email.email_pattern)}
                              className="text-xs"
                            >
                              Unblock
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEmail(email.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminEmailBlocking;