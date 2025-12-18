import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { storage, generateId } from "@/lib/storage";
import { Shield, Plus, Trash2, Crown } from "lucide-react";
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

interface Admin {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'moderator';
  createdAt: string;
  lastLogin?: string;
}

const ADMINS_KEY = 'trashmails_admins';

const AdminAdmins = () => {
  const [admins, setAdmins] = useState<Admin[]>(() =>
    storage.get<Admin[]>(ADMINS_KEY, [
      { id: '1', email: 'admin@trashmails.io', name: 'Super Admin', role: 'super_admin', createdAt: new Date().toISOString() }
    ])
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: '', name: '', role: 'admin' as Admin['role'] });

  const saveAdmins = (updated: Admin[]) => {
    storage.set(ADMINS_KEY, updated);
    setAdmins(updated);
  };

  const addAdmin = () => {
    if (!newAdmin.email || !newAdmin.name) {
      toast.error("Please fill all fields");
      return;
    }
    if (admins.find(a => a.email === newAdmin.email)) {
      toast.error("Admin with this email already exists");
      return;
    }
    const admin: Admin = {
      id: generateId(),
      ...newAdmin,
      createdAt: new Date().toISOString(),
    };
    saveAdmins([...admins, admin]);
    setNewAdmin({ email: '', name: '', role: 'admin' });
    setIsDialogOpen(false);
    toast.success("Admin added successfully!");
  };

  const removeAdmin = (id: string) => {
    const admin = admins.find(a => a.id === id);
    if (admin?.role === 'super_admin') {
      toast.error("Cannot remove super admin");
      return;
    }
    saveAdmins(admins.filter(a => a.id !== id));
    toast.success("Admin removed");
  };

  const getRoleBadge = (role: Admin['role']) => {
    switch (role) {
      case 'super_admin':
        return <Badge className="bg-yellow-500/20 text-yellow-500"><Crown className="w-3 h-3 mr-1" /> Super Admin</Badge>;
      case 'admin':
        return <Badge className="bg-blue-500/20 text-blue-500">Admin</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-500">Moderator</Badge>;
    }
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Admin</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Admin</DialogTitle>
              <DialogDescription>Grant admin access to a user</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newAdmin.role} onValueChange={(v) => setNewAdmin({ ...newAdmin, role: v as Admin['role'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={addAdmin}>Add Admin</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin Users</CardTitle>
          <CardDescription>{admins.length} admin(s) configured</CardDescription>
        </CardHeader>
        <CardContent>
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
                  <TableCell className="font-medium">{admin.name}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>{getRoleBadge(admin.role)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {admin.role !== 'super_admin' && (
                      <Button variant="ghost" size="sm" onClick={() => removeAdmin(admin.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAdmins;
