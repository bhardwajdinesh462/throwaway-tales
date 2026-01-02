import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Plus, Trash2, Star, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Shield, Loader2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

interface Domain {
  id: string;
  name: string;
  is_active: boolean;
  is_premium: boolean;
  created_at: string;
}

interface DNSCheckResult {
  status: 'pass' | 'fail' | 'warning' | 'skip' | 'error';
  message: string;
  records?: any[];
}

interface DNSVerificationResult {
  domain: string;
  verified: boolean;
  skip_dns_check?: boolean;
  checks: Record<string, DNSCheckResult>;
}

const AdminDomains = () => {
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dnsDialogOpen, setDnsDialogOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [dnsResults, setDnsResults] = useState<DNSVerificationResult | null>(null);
  const [verifyingDns, setVerifyingDns] = useState(false);
  const [skipDnsCheck, setSkipDnsCheck] = useState(false);

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
      const { data, error } = await api.admin.addDomain(name, isPremium);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      // Force immediate refetch instead of just invalidation
      refetch();
      queryClient.invalidateQueries({ queryKey: ['admin', 'domains'] });
      toast.success(`Domain ${data?.name || 'added'} successfully`);
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
    
    // Normalize domain: trim, lowercase, ensure @ prefix
    let normalizedDomain = newDomain.trim().toLowerCase();
    if (!normalizedDomain.startsWith('@')) {
      normalizedDomain = '@' + normalizedDomain;
    }
    
    addDomainMutation.mutate(
      { name: normalizedDomain, isPremium },
      {
        onSuccess: () => {
          setNewDomain("");
          setIsPremium(false);
          setDialogOpen(false);
          // Invalidate public domains cache as well
          queryClient.invalidateQueries({ queryKey: ['domains'] });
          // Clear all domain-related localStorage caches
          try {
            localStorage.removeItem('nullsto_domains_cache');
            localStorage.removeItem('cached_domains');
          } catch (e) {}
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

  const handleVerifyDNS = async (domain: Domain) => {
    setSelectedDomain(domain);
    setDnsResults(null);
    setSkipDnsCheck(false);
    setDnsDialogOpen(true);
  };

  const runDNSVerification = async () => {
    if (!selectedDomain) return;
    
    setVerifyingDns(true);
    try {
      const { data, error } = await api.admin.verifyDomainDNS(
        selectedDomain.name.replace(/^@/, ''),
        undefined,
        skipDnsCheck
      );
      
      if (error) {
        toast.error(error.message || 'Failed to verify DNS');
        return;
      }
      
      setDnsResults(data);
      
      if (data?.verified) {
        toast.success('Domain verified successfully!');
        queryClient.invalidateQueries({ queryKey: ['admin', 'domains'] });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to verify DNS');
    } finally {
      setVerifyingDns(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'skip':
        return <Shield className="w-4 h-4 text-muted-foreground" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Pass</Badge>;
      case 'fail':
        return <Badge variant="destructive">Fail</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Warning</Badge>;
      case 'skip':
        return <Badge variant="secondary">Skipped</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
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
                    <label className="text-sm font-medium">Premium-Only Domain</label>
                    <p className="text-xs text-muted-foreground">
                      If enabled, only paying subscribers can use this domain. Free users won't see it.
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleVerifyDNS(domain)}
                  className="text-xs"
                >
                  <Shield className="w-3 h-3 mr-1" />
                  Verify DNS
                </Button>
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

      {/* DNS Verification Dialog */}
      <Dialog open={dnsDialogOpen} onOpenChange={setDnsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              DNS Verification
            </DialogTitle>
            <DialogDescription>
              Verify DNS records for {selectedDomain?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Skip DNS Check Option */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
              <Checkbox
                id="skip-dns"
                checked={skipDnsCheck}
                onCheckedChange={(checked) => setSkipDnsCheck(checked as boolean)}
              />
              <div>
                <label htmlFor="skip-dns" className="text-sm font-medium cursor-pointer">
                  Skip DNS Check (Same-Server Installation)
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enable this if DNS lookups fail because the domain is hosted on the same server
                </p>
              </div>
            </div>

            {/* Run Verification Button */}
            <Button 
              onClick={runDNSVerification} 
              disabled={verifyingDns}
              className="w-full"
            >
              {verifyingDns ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking DNS Records...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Run DNS Verification
                </>
              )}
            </Button>

            {/* Results */}
            {dnsResults && (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg border ${
                  dnsResults.verified 
                    ? 'bg-emerald-500/10 border-emerald-500/30' 
                    : 'bg-destructive/10 border-destructive/30'
                }`}>
                  <div className="flex items-center gap-2">
                    {dnsResults.verified ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive" />
                    )}
                    <span className={`font-medium ${
                      dnsResults.verified ? 'text-emerald-500' : 'text-destructive'
                    }`}>
                      {dnsResults.verified ? 'Domain Verified' : 'Verification Failed'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {Object.entries(dnsResults.checks).map(([key, check]) => (
                    <div 
                      key={key}
                      className="flex items-center justify-between p-2 rounded-lg bg-secondary/30"
                    >
                      <div className="flex items-center gap-2">
                        {getStatusIcon(check.status)}
                        <span className="text-sm font-medium uppercase">{key}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {check.message}
                        </span>
                        {getStatusBadge(check.status)}
                      </div>
                    </div>
                  ))}
                </div>

                {!dnsResults.verified && !skipDnsCheck && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                    <p className="font-medium mb-1">Required for verification:</p>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      <li>MX records must be configured for receiving emails</li>
                      <li>If using verification token, it must be present in TXT records</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDnsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDomains;