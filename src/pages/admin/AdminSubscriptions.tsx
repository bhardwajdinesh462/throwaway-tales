import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  CreditCard, 
  Search, 
  User, 
  Crown, 
  Calendar, 
  Loader2,
  CheckCircle,
  XCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, invalidateQueries } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { format } from "date-fns";

interface SubscriptionTier {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  max_temp_emails: number;
  email_expiry_hours: number;
}

interface UserSubscription {
  subscription_id: string;
  tier_id: string;
  tier_name: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
}

const AdminSubscriptions = () => {
  const queryClient = useQueryClient();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<{
    user_id: string;
    email: string;
    display_name: string;
    current_subscription?: UserSubscription;
  } | null>(null);
  const [selectedTierId, setSelectedTierId] = useState("");
  const [durationMonths, setDurationMonths] = useState("1");
  const [isAssigning, setIsAssigning] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (error) throw error;
      setTiers(data || []);
    } catch (error: any) {
      console.error("Error fetching tiers:", error);
      toast.error("Failed to load subscription tiers");
    } finally {
      setIsLoading(false);
    }
  };

  const searchUser = async () => {
    if (!searchEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setIsSearching(true);
    setFoundUser(null);

    try {
      // Find user by email
      const { data: userData, error: userError } = await supabase.rpc('find_user_by_email', {
        search_email: searchEmail.trim()
      });

      if (userError) throw userError;

      if (!userData || userData.length === 0) {
        toast.error("No user found with that email");
        return;
      }

      const user = userData[0];

      // Get current subscription
      const { data: subData } = await supabase.rpc('admin_get_user_subscription', {
        target_user_id: user.found_user_id
      });

      setFoundUser({
        user_id: user.found_user_id,
        email: user.found_email,
        display_name: user.found_display_name,
        current_subscription: subData && subData.length > 0 ? subData[0] : undefined
      });

      if (subData && subData.length > 0) {
        setSelectedTierId(subData[0].tier_id);
      } else if (tiers.length > 0) {
        setSelectedTierId(tiers[0].id);
      }
    } catch (error: any) {
      console.error("Error searching user:", error);
      toast.error(error.message || "Failed to search user");
    } finally {
      setIsSearching(false);
    }
  };

  const assignSubscription = async () => {
    if (!foundUser || !selectedTierId) {
      toast.error("Please select a user and subscription tier");
      return;
    }

    setIsAssigning(true);
    try {
      const { error } = await supabase.rpc('admin_assign_subscription', {
        target_user_id: foundUser.user_id,
        target_tier_id: selectedTierId,
        duration_months: parseInt(durationMonths)
      });

      if (error) throw error;

      const tierName = tiers.find(t => t.id === selectedTierId)?.name || 'subscription';
      toast.success(`${tierName} assigned to ${foundUser.display_name || foundUser.email} for ${durationMonths} month(s)`);
      
      // Invalidate subscription queries for instant reflection
      invalidateQueries.subscriptions(queryClient);
      
      // Refresh user subscription
      const { data: subData } = await supabase.rpc('admin_get_user_subscription', {
        target_user_id: foundUser.user_id
      });

      setFoundUser({
        ...foundUser,
        current_subscription: subData && subData.length > 0 ? subData[0] : undefined
      });

      setDialogOpen(false);
    } catch (error: any) {
      console.error("Error assigning subscription:", error);
      toast.error(error.message || "Failed to assign subscription");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  const revokeSubscription = async () => {
    if (!foundUser) return;

    setIsRevoking(true);
    try {
      const { error } = await supabase.rpc('admin_revoke_subscription', {
        target_user_id: foundUser.user_id
      });

      if (error) throw error;

      toast.success(`Subscription revoked for ${foundUser.display_name || foundUser.email}`);
      
      // Invalidate subscription queries for instant reflection
      invalidateQueries.subscriptions(queryClient);
      
      // Refresh user subscription
      const { data: subData } = await supabase.rpc('admin_get_user_subscription', {
        target_user_id: foundUser.user_id
      });

      setFoundUser({
        ...foundUser,
        current_subscription: subData && subData.length > 0 ? subData[0] : undefined
      });
    } catch (error: any) {
      console.error("Error revoking subscription:", error);
      toast.error(error.message || "Failed to revoke subscription");
    } finally {
      setIsRevoking(false);
    }
  };

  const resetSearch = () => {
    setSearchEmail("");
    setFoundUser(null);
    setSelectedTierId(tiers.length > 0 ? tiers[0].id : "");
    setDurationMonths("1");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CreditCard className="w-8 h-8 text-primary" />
            Manual Subscriptions
          </h1>
          <p className="text-muted-foreground">Assign subscription plans to users manually</p>
        </div>
      </div>

      {/* Subscription Tiers Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : tiers.length === 0 ? (
          <div className="col-span-3 text-center py-8 text-muted-foreground">
            No subscription tiers configured
          </div>
        ) : (
          tiers.map((tier) => (
            <Card key={tier.id} className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  {tier.name}
                </CardTitle>
                <CardDescription>
                  ${tier.price_monthly}/month or ${tier.price_yearly}/year
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>• {tier.max_temp_emails} temp emails</p>
                  <p>• {tier.email_expiry_hours}h email expiry</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Assign Subscription */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Assign Subscription</CardTitle>
          <CardDescription>Search for a user and assign them a subscription plan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search User */}
          <div className="space-y-2">
            <Label>Search User by Email</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="user@example.com"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchUser()}
                  className="pl-10"
                />
              </div>
              <Button onClick={searchUser} disabled={isSearching}>
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
              </Button>
              {foundUser && (
                <Button variant="outline" onClick={resetSearch}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Found User */}
          {foundUser && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 border border-border rounded-lg bg-secondary/30 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-lg">{foundUser.display_name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">{foundUser.email}</p>
                  </div>
                </div>
                {foundUser.current_subscription && (
                  <Badge variant="secondary" className="gap-1">
                    <Crown className="w-3 h-3" />
                    {foundUser.current_subscription.tier_name}
                  </Badge>
                )}
              </div>

              {foundUser.current_subscription && (
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <p className="text-sm font-medium mb-2">Current Subscription</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Plan</p>
                      <p className="font-medium">{foundUser.current_subscription.tier_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge variant={foundUser.current_subscription.status === 'active' ? 'default' : 'secondary'}>
                        {foundUser.current_subscription.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Started</p>
                      <p>{format(new Date(foundUser.current_subscription.current_period_start), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expires</p>
                      <p>{format(new Date(foundUser.current_subscription.current_period_end), 'MMM d, yyyy')}</p>
                    </div>
                    </div>
                    
                    {/* Revoke button */}
                    {foundUser.current_subscription.tier_name?.toLowerCase() !== 'free' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            disabled={isRevoking}
                          >
                            {isRevoking ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <XCircle className="w-4 h-4 mr-2" />
                            )}
                            Revoke Subscription
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke Subscription</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will immediately downgrade {foundUser.display_name || foundUser.email} to the Free tier. 
                              They will lose access to all premium features.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={revokeSubscription}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Revoke
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
              )}

              {/* Assign New Subscription */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Subscription Plan</Label>
                  <Select value={selectedTierId} onValueChange={setSelectedTierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiers.map((tier) => (
                        <SelectItem key={tier.id} value={tier.id}>
                          {tier.name} (${tier.price_monthly}/mo)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Select value={durationMonths} onValueChange={setDurationMonths}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Month</SelectItem>
                      <SelectItem value="3">3 Months</SelectItem>
                      <SelectItem value="6">6 Months</SelectItem>
                      <SelectItem value="12">1 Year</SelectItem>
                      <SelectItem value="24">2 Years</SelectItem>
                      <SelectItem value="120">Lifetime (10 Years)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full" disabled={!selectedTierId}>
                        <Calendar className="w-4 h-4 mr-2" />
                        Assign Plan
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm Subscription Assignment</DialogTitle>
                        <DialogDescription>
                          You are about to assign a subscription to this user.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">User:</span>
                          <span className="font-medium">{foundUser.display_name || foundUser.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Plan:</span>
                          <span className="font-medium">{tiers.find(t => t.id === selectedTierId)?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duration:</span>
                          <span className="font-medium">{durationMonths} month(s)</span>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={handleDialogClose} disabled={isAssigning}>
                          Cancel
                        </Button>
                        <Button onClick={assignSubscription} disabled={isAssigning}>
                          {isAssigning ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          Confirm Assignment
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSubscriptions;