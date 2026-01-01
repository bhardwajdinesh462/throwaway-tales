import { useState } from "react";
import { motion } from "framer-motion";
import { User, Trash2, Search, ChevronLeft, ChevronRight, Ban, CheckCircle, Loader2, MailCheck, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminUsers } from "@/hooks/useAdminQueries";
import { AdminTableSkeleton } from "@/components/admin/AdminSkeletons";
import { queryKeys } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  role: string;
  is_suspended?: boolean;
  email_verified?: boolean;
}

const AdminUsers = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);
  const [resendingEmailUserId, setResendingEmailUserId] = useState<string | null>(null);
  
  // Suspension dialog state
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendingUser, setSuspendingUser] = useState<UserProfile | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendDuration, setSuspendDuration] = useState<string>("permanent");
  const [isSuspending, setIsSuspending] = useState(false);
  
  const pageSize = 10;

  // Use React Query hook for caching
  const { data, isLoading, refetch } = useAdminUsers(page, searchQuery, pageSize);
  const users = data?.users || [];
  const totalCount = data?.totalCount || 0;

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.users(page, searchQuery) });
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      await api.db.delete("user_roles", { user_id: userId });
      
      const { error } = await api.db.insert("user_roles", {
        user_id: userId,
        role: newRole as "admin" | "moderator" | "user",
      });

      if (error) throw error;

      toast.success("User role updated");
      invalidateUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  const deleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    try {
      const { data, error } = await api.functions.invoke<{error?: string}>('delete-user-complete', {
        body: { userId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("User deleted successfully");
      setSelectedUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      invalidateUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  };

  const bulkDeleteUsers = async () => {
    if (selectedUsers.size === 0) return;
    
    setIsBulkDeleting(true);
    try {
      const { data, error } = await api.db.rpc('bulk_delete_users', {
        user_ids: Array.from(selectedUsers)
      });

      if (error) throw error;

      toast.success(`${data} users deleted successfully`);
      setSelectedUsers(new Set());
      setShowBulkDeleteDialog(false);
      invalidateUsers();
    } catch (error: any) {
      console.error("Error bulk deleting users:", error);
      toast.error(error.message || "Failed to delete users");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const openSuspendDialog = (user: UserProfile) => {
    setSuspendingUser(user);
    setSuspendReason("");
    setSuspendDuration("permanent");
    setSuspendDialogOpen(true);
  };

  const suspendUser = async () => {
    if (!suspendingUser) return;
    
    setIsSuspending(true);
    try {
      let suspendUntil: string | null = null;
      
      if (suspendDuration !== "permanent") {
        const now = new Date();
        const days = parseInt(suspendDuration);
        now.setDate(now.getDate() + days);
        suspendUntil = now.toISOString();
      }

      const { error } = await api.db.rpc('suspend_user', {
        target_user_id: suspendingUser.user_id,
        suspension_reason: suspendReason || null,
        suspend_until: suspendUntil
      });

      if (error) throw error;

      toast.success(`${suspendingUser.display_name || suspendingUser.email} has been suspended`);
      setSuspendDialogOpen(false);
      invalidateUsers();
    } catch (error: any) {
      console.error("Error suspending user:", error);
      toast.error(error.message || "Failed to suspend user");
    } finally {
      setIsSuspending(false);
    }
  };

  const unsuspendUser = async (userId: string) => {
    try {
      const { error } = await api.db.rpc('unsuspend_user', {
        target_user_id: userId
      });

      if (error) throw error;

      toast.success("User suspension lifted");
      invalidateUsers();
    } catch (error: any) {
      console.error("Error unsuspending user:", error);
      toast.error(error.message || "Failed to unsuspend user");
    }
  };

  const manuallyVerifyEmail = async (userId: string) => {
    setVerifyingUserId(userId);
    try {
      const { error } = await api.db.update('profiles', 
        { email_verified: true },
        { user_id: userId }
      );

      if (error) throw error;

      toast.success("Email marked as verified");
      invalidateUsers();
    } catch (error: any) {
      console.error("Error verifying email:", error);
      toast.error(error.message || "Failed to verify email");
    } finally {
      setVerifyingUserId(null);
    }
  };

  const resendVerificationEmail = async (user: UserProfile) => {
    if (!user.email) {
      toast.error("User has no email address");
      return;
    }
    
    setResendingEmailUserId(user.user_id);
    try {
      const { data, error } = await api.functions.invoke<{error?: string}>('create-verification-and-send', {
        body: {
          userId: user.user_id,
          email: user.email,
          name: user.display_name || user.email.split('@')[0]
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Verification email sent to ${user.email}`);
    } catch (error: any) {
      console.error("Error sending verification email:", error);
      toast.error(error.message || "Failed to send verification email");
    } finally {
      setResendingEmailUserId(null);
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.filter(u => u.role !== 'admin').length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.filter(u => u.role !== 'admin').map(u => u.user_id)));
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const selectableUsers = users.filter(u => u.role !== 'admin');
  const allSelected = selectableUsers.length > 0 && selectedUsers.size === selectableUsers.length;

  return (
    <div className="space-y-6">
      {/* Search Bar and Bulk Actions */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-10 bg-secondary/50"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Badge variant="secondary">{totalCount} users</Badge>
        
        {selectedUsers.size > 0 && (
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => setShowBulkDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete {selectedUsers.size} selected
          </Button>
        )}
      </div>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/30 border-b border-border">
              <tr>
                <th className="p-4 w-12">
                  <Checkbox 
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">User</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email Verified</th>
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Joined</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <AdminTableSkeleton rows={5} />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-secondary/20">
                    <td className="p-4">
                      {user.role !== 'admin' && (
                        <Checkbox 
                          checked={selectedUsers.has(user.user_id)}
                          onCheckedChange={() => toggleSelectUser(user.user_id)}
                          aria-label={`Select ${user.display_name || user.email}`}
                        />
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">
                          {user.display_name || "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">{user.email || "N/A"}</td>
                    <td className="p-4">
                      <Select
                        value={user.role}
                        onValueChange={(value) => updateUserRole(user.user_id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="moderator">Moderator</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-4">
                      {user.is_suspended ? (
                        <Badge variant="destructive" className="gap-1">
                          <Ban className="w-3 h-3" /> Suspended
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-green-500/20 text-green-500">
                          <CheckCircle className="w-3 h-3" /> Active
                        </Badge>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {user.email_verified ? (
                          <Badge variant="secondary" className="gap-1 bg-green-500/20 text-green-500">
                            <MailCheck className="w-3 h-3" /> Verified
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-500">
                              <Mail className="w-3 h-3" /> Pending
                            </Badge>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-green-500"
                                  onClick={() => manuallyVerifyEmail(user.user_id)}
                                  disabled={verifyingUserId === user.user_id}
                                >
                                  {verifyingUserId === user.user_id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-3 h-3" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Mark as verified</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-primary"
                                  onClick={() => resendVerificationEmail(user)}
                                  disabled={resendingEmailUserId === user.user_id}
                                >
                                  {resendingEmailUserId === user.user_id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Resend verification email</TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.role !== 'admin' && (
                          <>
                            {user.is_suspended ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => unsuspendUser(user.user_id)}
                                className="text-green-500"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openSuspendDialog(user)}
                                className="text-amber-500"
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  disabled={deletingUserId === user.user_id}
                                >
                                  {deletingUserId === user.user_id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {user.display_name || user.email}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive"
                                    onClick={() => deleteUser(user.user_id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Delete Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedUsers.size} Users</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUsers.size} users? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive"
              onClick={bulkDeleteUsers}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend User Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend User</DialogTitle>
            <DialogDescription>
              Suspend {suspendingUser?.display_name || suspendingUser?.email} from accessing the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={suspendDuration} onValueChange={setSuspendDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Day</SelectItem>
                  <SelectItem value="7">7 Days</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="Enter a reason for the suspension..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuspendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={suspendUser}
              disabled={isSuspending}
            >
              {isSuspending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Suspend User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
