import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { User, Trash2, Search, ChevronLeft, ChevronRight, Ban, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  role: string;
  is_suspended?: boolean;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  
  // Suspension dialog state
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendingUser, setSuspendingUser] = useState<UserProfile | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendDuration, setSuspendDuration] = useState<string>("permanent");
  const [isSuspending, setIsSuspending] = useState(false);
  
  const pageSize = 10;

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_all_profiles_for_admin', {
        p_search: searchQuery || null,
        p_page: page,
        p_page_size: pageSize
      });

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch suspension status for all users
        const userIds = data.map((row: any) => row.user_id);
        const { data: suspensions } = await supabase
          .from('user_suspensions')
          .select('user_id')
          .in('user_id', userIds)
          .eq('is_active', true);
        
        const suspendedUserIds = new Set(suspensions?.map(s => s.user_id) || []);
        
        const usersData = data.map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          email: row.email,
          display_name: row.display_name,
          created_at: row.created_at,
          role: row.role || 'user',
          is_suspended: suspendedUserIds.has(row.user_id)
        }));
        setUsers(usersData);
        setTotalCount(Number(data[0]?.total_count) || 0);
      } else {
        setUsers([]);
        setTotalCount(0);
      }
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error(error.message || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, searchQuery]);

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: newRole as "admin" | "moderator" | "user",
      });

      if (error) throw error;

      setUsers(users.map(u => 
        u.user_id === userId ? { ...u, role: newRole } : u
      ));
      toast.success("User role updated");
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  const deleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    try {
      const { error } = await supabase.rpc('delete_user_as_admin', {
        target_user_id: userId
      });

      if (error) throw error;

      toast.success("User deleted successfully");
      setSelectedUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      fetchUsers();
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
      const { data, error } = await supabase.rpc('bulk_delete_users', {
        user_ids: Array.from(selectedUsers)
      });

      if (error) throw error;

      toast.success(`${data} users deleted successfully`);
      setSelectedUsers(new Set());
      setShowBulkDeleteDialog(false);
      fetchUsers();
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

      const { error } = await supabase.rpc('suspend_user', {
        target_user_id: suspendingUser.user_id,
        suspension_reason: suspendReason || null,
        suspend_until: suspendUntil
      });

      if (error) throw error;

      toast.success(`${suspendingUser.display_name || suspendingUser.email} has been suspended`);
      setSuspendDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error suspending user:", error);
      toast.error(error.message || "Failed to suspend user");
    } finally {
      setIsSuspending(false);
    }
  };

  const unsuspendUser = async (userId: string) => {
    try {
      const { error } = await supabase.rpc('unsuspend_user', {
        target_user_id: userId
      });

      if (error) throw error;

      toast.success("User suspension lifted");
      fetchUsers();
    } catch (error: any) {
      console.error("Error unsuspending user:", error);
      toast.error(error.message || "Failed to unsuspend user");
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
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Joined</th>
                <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
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
                                className="text-orange-500"
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
                                  <Trash2 className="w-4 h-4" />
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
                                    className="bg-destructive hover:bg-destructive/90"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
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
      </motion.div>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Delete Users</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUsers.size} users? This action cannot be undone.
              Admin users will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive hover:bg-destructive/90"
              onClick={bulkDeleteUsers}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete {selectedUsers.size} Users
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
              <Label htmlFor="duration">Suspension Duration</Label>
              <Select value={suspendDuration} onValueChange={setSuspendDuration}>
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Day</SelectItem>
                  <SelectItem value="3">3 Days</SelectItem>
                  <SelectItem value="7">1 Week</SelectItem>
                  <SelectItem value="14">2 Weeks</SelectItem>
                  <SelectItem value="30">1 Month</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for suspension..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)} disabled={isSuspending}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={suspendUser}
              disabled={isSuspending}
            >
              {isSuspending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
              Suspend User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;