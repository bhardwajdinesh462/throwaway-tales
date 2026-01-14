import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Shield, Plus, Trash2, Crown, Loader2 } from "lucide-react";
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

interface AdminUser {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  created_at: string;
}

const AdminAdmins = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "moderator">("admin");
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<{
    user_id: string;
    email: string;
    display_name: string;
    current_role: string;
  } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await api.db.rpc<AdminUser[]>('get_admin_users');

      if (error) throw error;

      if (data) {
        setAdmins(data.map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          email: row.email,
          display_name: row.display_name,
          role: row.role,
          created_at: row.created_at
        })));
      }
    } catch (error: any) {
      console.error("Error fetching admins:", error);
      toast.error(error.message || "Failed to load admins");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const searchUser = async () => {
    if (!searchEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setIsSearching(true);
    setFoundUser(null);

    try {
      const { data, error } = await api.db.rpc<{ found_user_id: string; found_email: string; found_display_name: string; found_role: string }[]>('find_user_by_email', {
        search_email: searchEmail.trim()
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const user = data[0];
        setFoundUser({
          user_id: user.found_user_id,
          email: user.found_email,
          display_name: user.found_display_name,
          current_role: user.found_role
        });
      } else {
        toast.error("No user found with that email");
      }
    } catch (error: any) {
      console.error("Error searching user:", error);
      toast.error(error.message || "Failed to search user");
    } finally {
      setIsSearching(false);
    }
  };

  const addAdmin = async () => {
    if (!foundUser) {
      toast.error("Please search for a user first");
      return;
    }

    if (foundUser.current_role === 'admin' || foundUser.current_role === 'moderator') {
      toast.error("This user is already an admin or moderator");
      return;
    }

    setIsAdding(true);
    try {
      const { error } = await api.db.rpc('add_admin_role', {
        target_user_id: foundUser.user_id,
        target_role: selectedRole
      });

      if (error) throw error;

      toast.success(`${foundUser.display_name || foundUser.email} is now a ${selectedRole}`);
      setIsDialogOpen(false);
      setSearchEmail("");
      setFoundUser(null);
      setSelectedRole("admin");
      fetchAdmins();
    } catch (error: any) {
      console.error("Error adding admin:", error);
      toast.error(error.message || "Failed to add admin");
    } finally {
      setIsAdding(false);
    }
  };

  const removeAdmin = async (userId: string) => {
    setRemovingUserId(userId);
    try {
      const { error } = await api.db.rpc('remove_admin_role', {
        target_user_id: userId
      });

      if (error) throw error;

      toast.success("Admin role removed");
      fetchAdmins();
    } catch (error: any) {
      console.error("Error removing admin:", error);
      toast.error(error.message || "Failed to remove admin");
    } finally {
      setRemovingUserId(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-blue-500/20 text-blue-500"><Crown className="w-3 h-3 mr-1" /> Admin</Badge>;
      case 'moderator':
        return <Badge className="bg-purple-500/20 text-purple-500">Moderator</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-500">{role}</Badge>;
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSearchEmail("");
    setFoundUser(null);
    setSelectedRole("admin");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            Admins
          </h1>
          <p className="text-muted-foreground">Manage admin users and permissions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => open ? setIsDialogOpen(true) : handleDialogClose()}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Admin</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Admin</DialogTitle>
              <DialogDescription>Search for a user by email and grant them admin access</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">User Email</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={searchEmail}
                    onChange={(e) => {
                      setSearchEmail(e.target.value);
                      setFoundUser(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && searchUser()}
                  />
                  <Button 
                    variant="secondary" 
                    onClick={searchUser}
                    disabled={isSearching}
                  >
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                  </Button>
                </div>
              </div>

              {foundUser && (
                <div className="p-4 border border-border rounded-lg bg-secondary/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{foundUser.display_name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{foundUser.email}</p>
                    </div>
                    <Badge variant="outline">{foundUser.current_role}</Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="role">Assign Role</Label>
                    <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as "admin" | "moderator")}>
                      <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleDialogClose}>Cancel</Button>
              <Button 
                onClick={addAdmin} 
                disabled={!foundUser || isAdding}
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Admin
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin Users</CardTitle>
          <CardDescription>{admins.length} admin(s) / moderator(s) configured</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No admins found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.display_name || "Unknown"}</TableCell>
                    <TableCell>{admin.email || "N/A"}</TableCell>
                    <TableCell>{getRoleBadge(admin.role)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(admin.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive"
                            disabled={removingUserId === admin.user_id}
                          >
                            {removingUserId === admin.user_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Admin</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove admin privileges from {admin.display_name || admin.email}? They will be demoted to a regular user.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              className="bg-destructive hover:bg-destructive/90"
                              onClick={() => removeAdmin(admin.user_id)}
                            >
                              Remove Admin
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAdmins;