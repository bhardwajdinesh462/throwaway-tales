import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Globe, Plus, Trash2, Check, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchDomains = async () => {
    try {
      const { data, error } = await supabase
        .from("domains")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDomains(data || []);
    } catch (error) {
      console.error("Error fetching domains:", error);
      toast.error("Failed to load domains");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const addDomain = async () => {
    if (!newDomain.trim()) {
      toast.error("Please enter a domain name");
      return;
    }

    const domainName = newDomain.startsWith("@") ? newDomain : `@${newDomain}`;

    try {
      const { data, error } = await supabase
        .from("domains")
        .insert({
          name: domainName,
          is_premium: isPremium,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Domain already exists");
        } else {
          throw error;
        }
        return;
      }

      setDomains([data, ...domains]);
      setNewDomain("");
      setIsPremium(false);
      setDialogOpen(false);
      toast.success("Domain added successfully");
    } catch (error) {
      console.error("Error adding domain:", error);
      toast.error("Failed to add domain");
    }
  };

  const toggleActive = async (domain: Domain) => {
    try {
      const { error } = await supabase
        .from("domains")
        .update({ is_active: !domain.is_active })
        .eq("id", domain.id);

      if (error) throw error;

      setDomains(domains.map(d => 
        d.id === domain.id ? { ...d, is_active: !d.is_active } : d
      ));
      toast.success(`Domain ${domain.is_active ? "disabled" : "enabled"}`);
    } catch (error) {
      console.error("Error updating domain:", error);
      toast.error("Failed to update domain");
    }
  };

  const togglePremium = async (domain: Domain) => {
    try {
      const { error } = await supabase
        .from("domains")
        .update({ is_premium: !domain.is_premium })
        .eq("id", domain.id);

      if (error) throw error;

      setDomains(domains.map(d => 
        d.id === domain.id ? { ...d, is_premium: !d.is_premium } : d
      ));
      toast.success(`Premium status ${domain.is_premium ? "removed" : "added"}`);
    } catch (error) {
      console.error("Error updating domain:", error);
      toast.error("Failed to update domain");
    }
  };

  const deleteDomain = async (id: string) => {
    try {
      const { error } = await supabase.from("domains").delete().eq("id", id);
      if (error) throw error;

      setDomains(domains.filter(d => d.id !== id));
      toast.success("Domain deleted");
    } catch (error) {
      console.error("Error deleting domain:", error);
      toast.error("Failed to delete domain");
    }
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
              <Button variant="neon" onClick={addDomain}>
                Add Domain
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Domains List */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid gap-4"
      >
        {domains.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground">
            No domains configured
          </div>
        ) : (
          domains.map((domain, index) => (
            <motion.div
              key={domain.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
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
                    onCheckedChange={() => toggleActive(domain)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Premium</span>
                  <Switch
                    checked={domain.is_premium}
                    onCheckedChange={() => togglePremium(domain)}
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
                        onClick={() => deleteDomain(domain.id)}
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
