import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Plus, Trash2, Star, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { AdminDomainSkeleton } from "@/components/admin/AdminSkeletons";
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

interface Domain {
  id: string;
  name: string;
  is_active: boolean;
  is_premium: boolean;
  created_at: string;
}

const AdminDomains = () => {
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Use React Query with api.ts compatibility layer
  const { data: domains = [], isLoading, refetch } = useQuery({
    queryKey: ['admin', 'domains'],
    queryFn: async () => {
      const { data, error } = await api.admin.getDomains();
      if (error) throw new Error(error.message);
      return data || [];
    }
  });

  const addDomainMutation = useMutation({
    mutationFn: async ({ name, isPremium }: { name: string; isPremium: boolean }) => {
      const { error } = await api.admin.addDomain(name, isPremium);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'domains'] });
      toast.success("Domain added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add domain");
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await api.admin.updateDomain(id, { is_active: !isActive });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'domains'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update domain");
    }
  });

  const togglePremiumMutation = useMutation({
    mutationFn: async ({ id, isPremium }: { id: string; isPremium: boolean }) => {
      const { error } = await api.admin.updateDomain(id, { is_premium: !isPremium });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'domains'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update domain");
    }
  });

  const deleteDomainMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.admin.deleteDomain(id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'domains'] });
      toast.success("Domain deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete domain");
    }
  });

  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    
    addDomainMutation.mutate(
      { name: newDomain, isPremium },
      {
        onSuccess: () => {
          setNewDomain("");
          setIsPremium(false);
          setDialogOpen(false);
        },
      }
    );
  };

  const handleToggleActive = (domain: Domain) => {
    toggleActiveMutation.mutate({ id: domain.id, isActive: domain.is_active });
  };

  const handleTogglePremium = (domain: Domain) => {
    togglePremiumMutation.mutate({ id: domain.id, isPremium: domain.is_premium });
  };

  const handleDeleteDomain = (id: string) => {
    deleteDomainMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Email Domains</h2>
          <p className="text-sm text-muted-foreground">
            Manage domains available for temporary emails
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="neon">
                <Plus className="w-4 h-4 mr-2" />
                Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Domain</DialogTitle>
                <DialogDescription>
                  Enter a domain name for temporary emails (e.g., @example.com)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Domain Name</label>
                  <Input
                    placeholder="@example.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Premium Domain</label>
                    <p className="text-xs text-muted-foreground">
                      Premium domains are only available to paying users
                    </p>
                  </div>
                  <Switch checked={isPremium} onCheckedChange={setIsPremium} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="neon" 
                  onClick={handleAddDomain}
                  disabled={addDomainMutation.isPending}
                >
                  Add Domain
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Domains List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid gap-4"
      >
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <AdminDomainSkeleton key={i} />)
        ) : domains.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground">
            No domains configured
          </div>
        ) : (
          domains.map((domain, index) => (
            <motion.div
              key={domain.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="glass-card p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  domain.is_active ? "bg-primary/20" : "bg-secondary"
                }`}>
                  <Globe className={`w-5 h-5 ${domain.is_active ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground font-mono">{domain.name}</p>
                    {domain.is_premium && (
                      <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                        <Star className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                    {!domain.is_active && (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(domain.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Active</span>
                  <Switch
                    checked={domain.is_active}
                    onCheckedChange={() => handleToggleActive(domain)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Premium</span>
                  <Switch
                    checked={domain.is_premium}
                    onCheckedChange={() => handleTogglePremium(domain)}
                  />
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Domain</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {domain.name}? All temp emails using this domain will be deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        className="bg-destructive"
                        onClick={() => handleDeleteDomain(domain.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  );
};

export default AdminDomains;
