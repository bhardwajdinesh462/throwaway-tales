import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { storage, STORAGE_KEYS, generateId } from "@/lib/storage";
import { Globe, Plus, Trash2, CheckCircle, AlertCircle, Clock, ExternalLink, Copy } from "lucide-react";
import FeatureGate from "@/components/FeatureGate";
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

interface CustomDomain {
  id: string;
  domain: string;
  status: 'pending' | 'verifying' | 'active' | 'failed';
  isPrimary: boolean;
  createdAt: string;
  verifiedAt?: string;
}

const CUSTOM_DOMAINS_KEY = 'trashmails_custom_domains';

const AdminCustomDomains = () => {
  const [domains, setDomains] = useState<CustomDomain[]>(() => 
    storage.get<CustomDomain[]>(CUSTOM_DOMAINS_KEY, [])
  );
  const [newDomain, setNewDomain] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const saveDomains = (updatedDomains: CustomDomain[]) => {
    storage.set(CUSTOM_DOMAINS_KEY, updatedDomains);
    setDomains(updatedDomains);
  };

  const addDomain = () => {
    if (!newDomain.trim()) {
      toast.error("Please enter a domain name");
      return;
    }

    // Basic domain validation
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(newDomain.trim())) {
      toast.error("Please enter a valid domain name");
      return;
    }

    if (domains.find(d => d.domain === newDomain.trim())) {
      toast.error("This domain is already added");
      return;
    }

    const domain: CustomDomain = {
      id: generateId(),
      domain: newDomain.trim().toLowerCase(),
      status: 'pending',
      isPrimary: domains.length === 0,
      createdAt: new Date().toISOString(),
    };

    saveDomains([...domains, domain]);
    setNewDomain("");
    setIsDialogOpen(false);
    toast.success("Domain added! Please configure DNS records.");
  };

  const removeDomain = (id: string) => {
    const updatedDomains = domains.filter(d => d.id !== id);
    // If we removed the primary, make the first one primary
    if (updatedDomains.length > 0 && !updatedDomains.some(d => d.isPrimary)) {
      updatedDomains[0].isPrimary = true;
    }
    saveDomains(updatedDomains);
    toast.success("Domain removed");
  };

  const setPrimaryDomain = (id: string) => {
    const updatedDomains = domains.map(d => ({
      ...d,
      isPrimary: d.id === id
    }));
    saveDomains(updatedDomains);
    toast.success("Primary domain updated");
  };

  const verifyDomain = (id: string) => {
    // Simulate verification (in real app, this would check DNS)
    const updatedDomains = domains.map(d => {
      if (d.id === id) {
        return {
          ...d,
          status: 'active' as const,
          verifiedAt: new Date().toISOString()
        };
      }
      return d;
    });
    saveDomains(updatedDomains);
    toast.success("Domain verified successfully!");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const getStatusBadge = (status: CustomDomain['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Active</Badge>;
      case 'verifying':
        return <Badge className="bg-yellow-500/20 text-yellow-500"><Clock className="w-3 h-3 mr-1" /> Verifying</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-500"><AlertCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge className="bg-blue-500/20 text-blue-500"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
  };

  return (
    <FeatureGate feature="canUseCustomDomains" requiredTier="business">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Custom Domains</h1>
          <p className="text-muted-foreground">Manage custom domains for your email service</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Custom Domain</DialogTitle>
              <DialogDescription>
                Enter your domain name. You'll need to configure DNS records after adding.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain Name</Label>
                <Input
                  id="domain"
                  placeholder="example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={addDomain}>Add Domain</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* DNS Configuration Guide */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            DNS Configuration
          </CardTitle>
          <CardDescription>
            Add these DNS records at your domain registrar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="p-4 bg-secondary/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">A Record (Root Domain)</span>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard("185.158.133.1")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-muted-foreground text-sm">
                <span className="font-semibold">Name:</span> @ | <span className="font-semibold">Value:</span> <code className="bg-background px-2 py-0.5 rounded">185.158.133.1</code>
              </div>
            </div>
            <div className="p-4 bg-secondary/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">A Record (www subdomain)</span>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard("185.158.133.1")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-muted-foreground text-sm">
                <span className="font-semibold">Name:</span> www | <span className="font-semibold">Value:</span> <code className="bg-background px-2 py-0.5 rounded">185.158.133.1</code>
              </div>
            </div>
            <div className="p-4 bg-secondary/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">TXT Record (Verification)</span>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard("_lovable")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="text-muted-foreground text-sm">
                <span className="font-semibold">Name:</span> _lovable | <span className="font-semibold">Value:</span> <code className="bg-background px-2 py-0.5 rounded">lovable_verify=YOUR_PROJECT_ID</code>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            DNS changes can take up to 72 hours to propagate. SSL certificates are automatically provisioned once verified.
          </p>
        </CardContent>
      </Card>

      {/* Domains List */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Domains</CardTitle>
          <CardDescription>
            {domains.length === 0 
              ? "No custom domains configured yet" 
              : `${domains.length} domain(s) configured`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {domains.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{domain.domain}</span>
                        {domain.isPrimary && (
                          <Badge variant="outline" className="text-xs">Primary</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(domain.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(domain.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {domain.status === 'pending' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => verifyDomain(domain.id)}
                          >
                            Verify
                          </Button>
                        )}
                        {!domain.isPrimary && domain.status === 'active' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setPrimaryDomain(domain.id)}
                          >
                            Set Primary
                          </Button>
                        )}
                        <a 
                          href={`https://${domain.domain}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </a>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Domain</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove {domain.domain}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeDomain(domain.id)}>
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No custom domains added yet</p>
              <p className="text-sm">Click "Add Domain" to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </FeatureGate>
  );
};

export default AdminCustomDomains;
