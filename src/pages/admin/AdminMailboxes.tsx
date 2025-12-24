import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Server,
  Send,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminMailboxes, useMailboxMutations } from "@/hooks/useAdminQueries";
import { AdminMailboxCardSkeleton } from "@/components/admin/AdminSkeletons";

interface Mailbox {
  id: string;
  name: string;
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_from: string | null;
  imap_host: string | null;
  imap_port: number;
  imap_user: string | null;
  imap_password: string | null;
  receiving_email: string | null;
  hourly_limit: number;
  daily_limit: number;
  emails_sent_this_hour: number;
  emails_sent_today: number;
  auto_delete_after_store: boolean;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  is_active: boolean;
  priority: number;
  last_error: string | null;
  last_error_at: string | null;
  last_polled_at: string | null;
  last_sent_at: string | null;
  created_at: string;
}

const defaultMailbox: Partial<Mailbox> = {
  name: "",
  smtp_host: "",
  smtp_port: 587,
  smtp_user: "",
  smtp_password: "",
  smtp_from: "",
  imap_host: "",
  imap_port: 993,
  imap_user: "",
  imap_password: "",
  receiving_email: "",
  hourly_limit: 100,
  daily_limit: 1000,
  auto_delete_after_store: true,
  is_active: true,
  priority: 1,
};

const AdminMailboxes = () => {
  const { data: mailboxes = [], isLoading, refetch } = useAdminMailboxes();
  const { toggleActive, deleteMailbox: deleteMailboxMutation } = useMailboxMutations();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<Partial<Mailbox> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);

  const openDialog = (mailbox?: Mailbox) => {
    if (mailbox) {
      setEditingMailbox({ ...mailbox });
    } else {
      setEditingMailbox({ ...defaultMailbox });
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingMailbox(null);
  };

  const saveMailbox = async () => {
    if (!editingMailbox?.name) {
      toast.error("Name is required");
      return;
    }

    setIsSaving(true);
    try {
      if (editingMailbox.id) {
        // Update existing
        const { error } = await supabase
          .from("mailboxes")
          .update({
            name: editingMailbox.name,
            smtp_host: editingMailbox.smtp_host || null,
            smtp_port: editingMailbox.smtp_port,
            smtp_user: editingMailbox.smtp_user || null,
            smtp_password: editingMailbox.smtp_password || null,
            smtp_from: editingMailbox.smtp_from || null,
            imap_host: editingMailbox.imap_host || null,
            imap_port: editingMailbox.imap_port,
            imap_user: editingMailbox.imap_user || null,
            imap_password: editingMailbox.imap_password || null,
            receiving_email: editingMailbox.receiving_email || null,
            hourly_limit: editingMailbox.hourly_limit,
            daily_limit: editingMailbox.daily_limit,
            auto_delete_after_store: editingMailbox.auto_delete_after_store,
            is_active: editingMailbox.is_active,
            priority: editingMailbox.priority,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingMailbox.id);

        if (error) throw error;
        toast.success("Mailbox updated");
      } else {
        // Create new
        const { error } = await supabase.from("mailboxes").insert({
          name: editingMailbox.name,
          smtp_host: editingMailbox.smtp_host || null,
          smtp_port: editingMailbox.smtp_port,
          smtp_user: editingMailbox.smtp_user || null,
          smtp_password: editingMailbox.smtp_password || null,
          smtp_from: editingMailbox.smtp_from || null,
          imap_host: editingMailbox.imap_host || null,
          imap_port: editingMailbox.imap_port,
          imap_user: editingMailbox.imap_user || null,
          imap_password: editingMailbox.imap_password || null,
          receiving_email: editingMailbox.receiving_email || null,
          hourly_limit: editingMailbox.hourly_limit,
          daily_limit: editingMailbox.daily_limit,
          auto_delete_after_store: editingMailbox.auto_delete_after_store,
          is_active: editingMailbox.is_active,
          priority: editingMailbox.priority,
        });

        if (error) throw error;
        toast.success("Mailbox created");
      }

      closeDialog();
      refetch();
    } catch (error: any) {
      console.error("Error saving mailbox:", error);
      toast.error(error.message || "Failed to save mailbox");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMailbox = async (id: string) => {
    try {
      await deleteMailboxMutation.mutateAsync(id);
    } catch (error: any) {
      console.error("Error deleting mailbox:", error);
    }
  };

  const testSmtpConnection = async (mailbox: Mailbox) => {
    if (!mailbox.smtp_host || !mailbox.smtp_user) {
      toast.error("SMTP not configured for this mailbox");
      return;
    }

    setIsTesting(mailbox.id);
    try {
      const { data, error } = await supabase.functions.invoke("smtp-connectivity-test", {
        body: {
          host: mailbox.smtp_host,
          port: mailbox.smtp_port,
          username: mailbox.smtp_user,
          password: mailbox.smtp_password,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("SMTP connection successful");
      } else {
        toast.error(data?.error || "SMTP connection failed");
      }
    } catch (error: any) {
      console.error("Error testing SMTP:", error);
      toast.error("Failed to test SMTP connection");
    } finally {
      setIsTesting(null);
    }
  };

  const handleToggleMailboxActive = async (mailbox: Mailbox) => {
    try {
      await toggleActive.mutateAsync({ id: mailbox.id, isActive: mailbox.is_active });
    } catch (error: any) {
      console.error("Error toggling mailbox:", error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStoragePercentage = (used: number, limit: number) => {
    return Math.min(100, (used / limit) * 100);
  };

  const getHourlyUsagePercentage = (sent: number, limit: number) => {
    return Math.min(100, (sent / limit) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mailboxes</h1>
          <p className="text-muted-foreground">
            Manage multiple mailboxes for load balancing email sending and receiving
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => openDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Mailbox
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <AdminMailboxCardSkeleton key={i} />
          ))}
        </div>
      ) : mailboxes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Mailboxes Configured</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              Add mailboxes to enable multi-mailbox load balancing. The system will
              automatically rotate between mailboxes to avoid rate limits.
            </p>
            <Button onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Mailbox
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {mailboxes.map((mailbox) => (
            <motion.div
              key={mailbox.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className={!mailbox.is_active ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          mailbox.is_active
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {mailbox.name}
                          <Badge variant="outline">Priority {mailbox.priority}</Badge>
                          {mailbox.is_active ? (
                            <Badge className="bg-green-500/20 text-green-500">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {mailbox.smtp_user || "No SMTP configured"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={mailbox.is_active}
                        onCheckedChange={() => handleToggleMailboxActive(mailbox)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => testSmtpConnection(mailbox)}
                        disabled={isTesting === mailbox.id}
                      >
                        {isTesting === mailbox.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Server className="w-4 h-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openDialog(mailbox)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Mailbox</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{mailbox.name}"? This action
                              cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90"
                              onClick={() => handleDeleteMailbox(mailbox.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Sending Stats */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Send className="w-4 h-4" />
                        Sending
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Hourly</span>
                          <span>
                            {mailbox.emails_sent_this_hour} / {mailbox.hourly_limit}
                          </span>
                        </div>
                        <Progress
                          value={getHourlyUsagePercentage(
                            mailbox.emails_sent_this_hour,
                            mailbox.hourly_limit
                          )}
                          className="h-2"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Daily</span>
                          <span>
                            {mailbox.emails_sent_today} / {mailbox.daily_limit}
                          </span>
                        </div>
                        <Progress
                          value={getHourlyUsagePercentage(
                            mailbox.emails_sent_today,
                            mailbox.daily_limit
                          )}
                          className="h-2"
                        />
                      </div>
                    </div>

                    {/* Receiving Stats */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Inbox className="w-4 h-4" />
                        Receiving
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Storage</span>
                          <span>
                            {formatBytes(mailbox.storage_used_bytes)} /{" "}
                            {formatBytes(mailbox.storage_limit_bytes)}
                          </span>
                        </div>
                        <Progress
                          value={getStoragePercentage(
                            mailbox.storage_used_bytes,
                            mailbox.storage_limit_bytes
                          )}
                          className="h-2"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {mailbox.auto_delete_after_store ? (
                          <Badge variant="outline" className="text-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Auto-delete
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-500">
                            <XCircle className="w-3 h-3 mr-1" />
                            Keep on server
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <AlertTriangle className="w-4 h-4" />
                        Status
                      </div>
                      {mailbox.last_error ? (
                        <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">
                          {mailbox.last_error}
                          <div className="text-xs text-muted-foreground mt-1">
                            {mailbox.last_error_at &&
                              new Date(mailbox.last_error_at).toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-green-500">
                          <CheckCircle className="w-4 h-4" />
                          No errors
                        </div>
                      )}
                      {mailbox.last_sent_at && (
                        <div className="text-xs text-muted-foreground">
                          Last sent: {new Date(mailbox.last_sent_at).toLocaleString()}
                        </div>
                      )}
                      {mailbox.last_polled_at && (
                        <div className="text-xs text-muted-foreground">
                          Last polled: {new Date(mailbox.last_polled_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMailbox?.id ? "Edit Mailbox" : "Add New Mailbox"}
            </DialogTitle>
            <DialogDescription>
              Configure SMTP for sending and IMAP for receiving emails
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="smtp">SMTP (Sending)</TabsTrigger>
              <TabsTrigger value="imap">IMAP (Receiving)</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={editingMailbox?.name || ""}
                  onChange={(e) =>
                    setEditingMailbox({ ...editingMailbox, name: e.target.value })
                  }
                  placeholder="Primary Mailbox"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    min="1"
                    value={editingMailbox?.priority || 1}
                    onChange={(e) =>
                      setEditingMailbox({
                        ...editingMailbox,
                        priority: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower number = higher priority
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hourly_limit">Hourly Limit</Label>
                  <Input
                    id="hourly_limit"
                    type="number"
                    min="1"
                    value={editingMailbox?.hourly_limit || 100}
                    onChange={(e) =>
                      setEditingMailbox({
                        ...editingMailbox,
                        hourly_limit: parseInt(e.target.value) || 100,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="daily_limit">Daily Limit</Label>
                  <Input
                    id="daily_limit"
                    type="number"
                    min="1"
                    value={editingMailbox?.daily_limit || 1000}
                    onChange={(e) =>
                      setEditingMailbox({
                        ...editingMailbox,
                        daily_limit: parseInt(e.target.value) || 1000,
                      })
                    }
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="is_active"
                    checked={editingMailbox?.is_active ?? true}
                    onCheckedChange={(checked) =>
                      setEditingMailbox({ ...editingMailbox, is_active: checked })
                    }
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="smtp" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp_host">SMTP Host</Label>
                  <Input
                    id="smtp_host"
                    value={editingMailbox?.smtp_host || ""}
                    onChange={(e) =>
                      setEditingMailbox({ ...editingMailbox, smtp_host: e.target.value })
                    }
                    placeholder="smtp.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp_port">SMTP Port</Label>
                  <Input
                    id="smtp_port"
                    type="number"
                    value={editingMailbox?.smtp_port || 587}
                    onChange={(e) =>
                      setEditingMailbox({
                        ...editingMailbox,
                        smtp_port: parseInt(e.target.value) || 587,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_user">SMTP Username</Label>
                <Input
                  id="smtp_user"
                  value={editingMailbox?.smtp_user || ""}
                  onChange={(e) =>
                    setEditingMailbox({ ...editingMailbox, smtp_user: e.target.value })
                  }
                  placeholder="user@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_password">SMTP Password</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  value={editingMailbox?.smtp_password || ""}
                  onChange={(e) =>
                    setEditingMailbox({ ...editingMailbox, smtp_password: e.target.value })
                  }
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_from">From Address</Label>
                <Input
                  id="smtp_from"
                  value={editingMailbox?.smtp_from || ""}
                  onChange={(e) =>
                    setEditingMailbox({ ...editingMailbox, smtp_from: e.target.value })
                  }
                  placeholder="noreply@example.com"
                />
              </div>
            </TabsContent>

            <TabsContent value="imap" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="imap_host">IMAP Host</Label>
                  <Input
                    id="imap_host"
                    value={editingMailbox?.imap_host || ""}
                    onChange={(e) =>
                      setEditingMailbox({ ...editingMailbox, imap_host: e.target.value })
                    }
                    placeholder="imap.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imap_port">IMAP Port</Label>
                  <Input
                    id="imap_port"
                    type="number"
                    value={editingMailbox?.imap_port || 993}
                    onChange={(e) =>
                      setEditingMailbox({
                        ...editingMailbox,
                        imap_port: parseInt(e.target.value) || 993,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="imap_user">IMAP Username</Label>
                <Input
                  id="imap_user"
                  value={editingMailbox?.imap_user || ""}
                  onChange={(e) =>
                    setEditingMailbox({ ...editingMailbox, imap_user: e.target.value })
                  }
                  placeholder="user@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imap_password">IMAP Password</Label>
                <Input
                  id="imap_password"
                  type="password"
                  value={editingMailbox?.imap_password || ""}
                  onChange={(e) =>
                    setEditingMailbox({ ...editingMailbox, imap_password: e.target.value })
                  }
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiving_email">Receiving Email Address</Label>
                <Input
                  id="receiving_email"
                  value={editingMailbox?.receiving_email || ""}
                  onChange={(e) =>
                    setEditingMailbox({
                      ...editingMailbox,
                      receiving_email: e.target.value,
                    })
                  }
                  placeholder="inbox@example.com"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="auto_delete"
                  checked={editingMailbox?.auto_delete_after_store ?? true}
                  onCheckedChange={(checked) =>
                    setEditingMailbox({
                      ...editingMailbox,
                      auto_delete_after_store: checked,
                    })
                  }
                />
                <Label htmlFor="auto_delete">
                  Auto-delete from IMAP after storing in database
                </Label>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={saveMailbox} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingMailbox?.id ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMailboxes;
