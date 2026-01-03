import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { Shield, Ban, Plus, Trash2, Clock, AlertTriangle, RefreshCw, Upload } from "lucide-react";
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
import { z } from "zod";

const ipSchema = z.string().regex(
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/,
  "Invalid IP address format"
);

interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string | null;
  blocked_by: string;
  blocked_at: string;
  expires_at: string | null;
  is_active: boolean;
}

const AdminIPBlocking = () => {
  const { user } = useAuth();
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [ipAddress, setIpAddress] = useState("");
  const [reason, setReason] = useState("");
  const [expiration, setExpiration] = useState("permanent");
  
  // Bulk form state
  const [bulkIPs, setBulkIPs] = useState("");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkExpiration, setBulkExpiration] = useState("permanent");

  useEffect(() => {
    loadBlockedIPs();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('blocked-ips-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocked_ips'
        },
        () => {
          loadBlockedIPs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadBlockedIPs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("blocked_ips")
      .select("*")
      .order("blocked_at", { ascending: false });

    if (error) {
      console.error("Error loading blocked IPs:", error);
      toast.error("Failed to load blocked IPs");
    } else {
      setBlockedIPs(data || []);
    }
    setIsLoading(false);
  };

  const handleBlockIP = async () => {
    // Validate IP
    try {
      ipSchema.parse(ipAddress);
    } catch (e) {
      toast.error("Please enter a valid IP address");
      return;
    }

    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    setIsSubmitting(true);

    // Calculate expiration
    let expiresAt: string | null = null;
    if (expiration !== "permanent") {
      const hours = parseInt(expiration);
      expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }

    const { error } = await supabase
      .from("blocked_ips")
      .insert([{
        ip_address: ipAddress.trim(),
        reason: reason.trim() || null,
        blocked_by: user.id,
        expires_at: expiresAt,
      }]);

    if (error) {
      if (error.code === "23505") {
        toast.error("This IP is already blocked");
      } else {
        toast.error("Failed to block IP: " + error.message);
      }
    } else {
      toast.success(`IP ${ipAddress} has been blocked`);
      setIpAddress("");
      setReason("");
      setExpiration("permanent");
      setIsDialogOpen(false);
      loadBlockedIPs();
    }
    setIsSubmitting(false);
  };

  const handleUnblockIP = async (id: string, ip: string) => {
    const { error } = await supabase
      .from("blocked_ips")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast.error("Failed to unblock IP");
    } else {
      toast.success(`IP ${ip} has been unblocked`);
      loadBlockedIPs();
    }
  };

  const handleDeleteIP = async (id: string) => {
    const { error } = await supabase
      .from("blocked_ips")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete record");
    } else {
      toast.success("Record deleted");
      loadBlockedIPs();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      // Parse CSV or plain text (one IP per line)
      const ips = content
        .split(/[\n,]/)
        .map(ip => ip.trim())
        .filter(ip => ip && !ip.toLowerCase().includes('ip'));
      setBulkIPs(ips.join('\n'));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBulkBlock = async () => {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    const ips = bulkIPs
      .split('\n')
      .map(ip => ip.trim())
      .filter(ip => ip);

    if (ips.length === 0) {
      toast.error("Please enter at least one IP address");
      return;
    }

    // Validate all IPs
    const invalidIPs: string[] = [];
    const validIPs: string[] = [];
    
    for (const ip of ips) {
      try {
        ipSchema.parse(ip);
        validIPs.push(ip);
      } catch {
        invalidIPs.push(ip);
      }
    }

    if (invalidIPs.length > 0) {
      toast.warning(`${invalidIPs.length} invalid IPs skipped: ${invalidIPs.slice(0, 3).join(', ')}${invalidIPs.length > 3 ? '...' : ''}`);
    }

    if (validIPs.length === 0) {
      toast.error("No valid IP addresses to block");
      return;
    }

    setIsSubmitting(true);

    let expiresAt: string | null = null;
    if (bulkExpiration !== "permanent") {
      const hours = parseInt(bulkExpiration);
      expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }

    const insertData = validIPs.map(ip => ({
      ip_address: ip,
      reason: bulkReason.trim() || null,
      blocked_by: user.id,
      expires_at: expiresAt,
    }));

    const { error } = await supabase
      .from("blocked_ips")
      .upsert(insertData, { onConflict: 'ip_address' });

    if (error) {
      toast.error("Failed to block IPs: " + error.message);
    } else {
      toast.success(`Successfully blocked ${validIPs.length} IP addresses`);
      setBulkIPs("");
      setBulkReason("");
      setBulkExpiration("permanent");
      setIsBulkDialogOpen(false);
      loadBlockedIPs();
    }

    setIsSubmitting(false);
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
            <Ban className="w-6 h-6 sm:w-8 sm:h-8 text-destructive" />
            IP Blocking
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">Block suspicious IP addresses from accessing the site</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadBlockedIPs} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          
          {/* Bulk Block Dialog */}
          <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Bulk Block
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-destructive" />
                  Bulk Block IPs
                </DialogTitle>
                <DialogDescription>
                  Block multiple IP addresses at once. Enter one IP per line or upload a CSV file.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>IP Addresses (one per line)</Label>
                  <Textarea
                    value={bulkIPs}
                    onChange={(e) => setBulkIPs(e.target.value)}
                    placeholder="192.168.1.1&#10;10.0.0.1&#10;172.16.0.1"
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">or</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload CSV/TXT
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Reason (optional)</Label>
                  <Input
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                    placeholder="Reason for blocking..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Block Duration</Label>
                  <Select value={bulkExpiration} onValueChange={setBulkExpiration}>
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
                <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleBulkBlock}
                  disabled={!bulkIPs.trim() || isSubmitting}
                >
                  {isSubmitting ? "Blocking..." : "Block All"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Single Block Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Block IP
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-destructive" />
                  Block IP Address
                </DialogTitle>
                <DialogDescription>
                  Add an IP address to the blocklist. Blocked IPs cannot access the site.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ip">IP Address *</Label>
                  <Input
                    id="ip"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="192.168.1.1 or 2001:0db8::1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for blocking this IP..."
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
                  onClick={handleBlockIP}
                  disabled={!ipAddress || isSubmitting}
                >
                  {isSubmitting ? "Blocking..." : "Block IP"}
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
            <p className="font-medium text-amber-600 dark:text-amber-400">IP Blocking Notice</p>
            <p className="text-sm text-muted-foreground">
              Blocking an IP will prevent that address from accessing any part of the site. 
              Be careful not to block legitimate users or your own IP address.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{blockedIPs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {blockedIPs.filter(ip => ip.is_active && (!ip.expires_at || new Date(ip.expires_at) > new Date())).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Permanent Blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {blockedIPs.filter(ip => ip.is_active && !ip.expires_at).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Blocked IPs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Blocked IP Addresses</CardTitle>
          <CardDescription>Manage blocked IP addresses</CardDescription>
        </CardHeader>
        <CardContent>
          {blockedIPs.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No blocked IPs</p>
              <p className="text-sm text-muted-foreground">Click "Block IP" to add an address to the blocklist</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Blocked</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blockedIPs.map((ip) => (
                  <TableRow key={ip.id}>
                    <TableCell className="font-mono">{ip.ip_address}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {ip.reason || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(ip.blocked_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>{getExpirationStatus(ip.expires_at, ip.is_active)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {ip.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnblockIP(ip.id, ip.ip_address)}
                          >
                            Unblock
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteIP(ip.id)}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminIPBlocking;