import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Save,
  Plus,
  Trash2,
  Edit2,
  Crown,
  Zap,
  Building2,
  DollarSign,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

interface SubscriptionTier {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  max_temp_emails: number;
  email_expiry_hours: number;
  ai_summaries_per_day: number;
  can_forward_emails: boolean;
  can_use_custom_domains: boolean;
  can_use_api: boolean;
  priority_support: boolean;
  is_active: boolean;
  features: string[];
}

interface PricingContent {
  headline: string;
  subheadline: string;
  ctaText: string;
  featuredPlan: string;
}

const defaultTier: Partial<SubscriptionTier> = {
  name: "",
  price_monthly: 0,
  price_yearly: 0,
  max_temp_emails: 3,
  email_expiry_hours: 1,
  ai_summaries_per_day: 5,
  can_forward_emails: false,
  can_use_custom_domains: false,
  can_use_api: false,
  priority_support: false,
  is_active: true,
  features: [],
};

const defaultContent: PricingContent = {
  headline: "Choose the Perfect Plan for You",
  subheadline: "Start free and upgrade anytime. All plans include core features to protect your privacy.",
  ctaText: "Get Started",
  featuredPlan: "pro",
};

const AdminPricing = () => {
  const queryClient = useQueryClient();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [content, setContent] = useState<PricingContent>(defaultContent);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTier, setEditingTier] = useState<Partial<SubscriptionTier> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newFeature, setNewFeature] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch tiers
      const { data: tiersData, error: tiersError } = await api.db.query<SubscriptionTier[]>("subscription_tiers", {
        order: { column: "price_monthly", ascending: true }
      });

      if (tiersError) throw tiersError;
      
      const mappedTiers = (tiersData || []).map(tier => ({
        ...tier,
        features: Array.isArray(tier.features) 
          ? tier.features.map(f => String(f)) 
          : []
      }));
      setTiers(mappedTiers);

      // Fetch content settings
      const { data: contentData } = await api.db.query<{ value: PricingContent }>("app_settings", {
        select: "value",
        filter: { key: { eq: "pricing_content" } },
        single: true
      });

      if (contentData?.value) {
        setContent({ ...defaultContent, ...(contentData.value as Partial<PricingContent>) });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load pricing data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveContent = async () => {
    setIsSaving(true);
    console.log('[AdminPricing] Saving content:', content);
    try {
      const { data: existing } = await api.db.query<{ id: string }>("app_settings", {
        select: "id",
        filter: { key: { eq: "pricing_content" } },
        single: true
      });

      console.log('[AdminPricing] Existing record:', existing);
      const contentJson = JSON.parse(JSON.stringify(content));

      if (existing) {
        const { error, data } = await api.db.update("app_settings", 
          { value: contentJson, updated_at: new Date().toISOString() },
          { key: { eq: "pricing_content" } }
        );
        console.log('[AdminPricing] Update result:', { error, data });
        if (error) throw error;
      } else {
        const { error, data } = await api.db.insert("app_settings", { key: "pricing_content", value: contentJson });
        console.log('[AdminPricing] Insert result:', { error, data });
        if (error) throw error;
      }

      toast.success("Pricing content saved");
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    } catch (error) {
      console.error("[AdminPricing] Error saving content:", error);
      toast.error("Failed to save content");
    } finally {
      setIsSaving(false);
    }
  };

  const openDialog = (tier?: SubscriptionTier) => {
    if (tier) {
      setEditingTier({ ...tier });
    } else {
      setEditingTier({ ...defaultTier });
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTier(null);
    setNewFeature("");
  };

  const saveTier = async () => {
    if (!editingTier?.name) {
      toast.error("Name is required");
      return;
    }

    setIsSaving(true);
    try {
      const featuresArray = (editingTier.features || []).map(f => String(f));
      
      const tierData = {
        name: editingTier.name,
        price_monthly: editingTier.price_monthly ?? 0,
        price_yearly: editingTier.price_yearly ?? 0,
        max_temp_emails: editingTier.max_temp_emails ?? 3,
        email_expiry_hours: editingTier.email_expiry_hours ?? 1,
        ai_summaries_per_day: editingTier.ai_summaries_per_day ?? 0, // Use ?? to allow 0 (disabled)
        can_forward_emails: editingTier.can_forward_emails ?? false,
        can_use_custom_domains: editingTier.can_use_custom_domains ?? false,
        can_use_api: editingTier.can_use_api ?? false,
        priority_support: editingTier.priority_support ?? false,
        is_active: editingTier.is_active ?? true,
        features: featuresArray,
      };

      if (editingTier.id) {
        const { error } = await api.db.update("subscription_tiers",
          { ...tierData, updated_at: new Date().toISOString() },
          { id: { eq: editingTier.id } }
        );
        if (error) throw error;
        toast.success("Tier updated");
      } else {
        const { error } = await api.db.insert("subscription_tiers", tierData);
        if (error) throw error;
        toast.success("Tier created");
      }

      closeDialog();
      fetchData();
    } catch (error) {
      console.error("Error saving tier:", error);
      toast.error("Failed to save tier");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTier = async (id: string) => {
    try {
      const { error } = await api.db.delete("subscription_tiers", { id: { eq: id } });
      if (error) throw error;
      toast.success("Tier deleted");
      fetchData();
    } catch (error) {
      console.error("Error deleting tier:", error);
      toast.error("Failed to delete tier");
    }
  };

  const toggleTierActive = async (tier: SubscriptionTier) => {
    try {
      const { error } = await api.db.update("subscription_tiers",
        { is_active: !tier.is_active, updated_at: new Date().toISOString() },
        { id: { eq: tier.id } }
      );
      if (error) throw error;
      toast.success(tier.is_active ? "Tier disabled" : "Tier enabled");
      fetchData();
    } catch (error) {
      console.error("Error toggling tier:", error);
      toast.error("Failed to update tier");
    }
  };

  const addFeature = () => {
    if (!newFeature.trim()) return;
    setEditingTier((prev) => ({
      ...prev,
      features: [...(prev?.features || []), newFeature.trim()],
    }));
    setNewFeature("");
  };

  const removeFeature = (index: number) => {
    setEditingTier((prev) => ({
      ...prev,
      features: (prev?.features || []).filter((_, i) => i !== index),
    }));
  };

  const getTierIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("business") || lowerName.includes("enterprise")) return Building2;
    if (lowerName.includes("pro") || lowerName.includes("premium")) return Crown;
    return Zap;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-24 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pricing Management</h1>
          <p className="text-muted-foreground">
            Manage subscription tiers and pricing page content
          </p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Tier
        </Button>
      </div>

      <Tabs defaultValue="tiers">
        <TabsList>
          <TabsTrigger value="tiers">
            <DollarSign className="w-4 h-4 mr-2" />
            Subscription Tiers
          </TabsTrigger>
          <TabsTrigger value="content">
            <Edit2 className="w-4 h-4 mr-2" />
            Page Content
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tiers" className="space-y-4 mt-4">
          {tiers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <DollarSign className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Subscription Tiers</h3>
                <p className="text-muted-foreground mb-4 text-center max-w-md">
                  Create subscription tiers to offer different pricing plans to your users.
                </p>
                <Button onClick={() => openDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Tier
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {tiers.map((tier) => {
                const TierIcon = getTierIcon(tier.name);
                return (
                  <Card key={tier.id} className={!tier.is_active ? "opacity-60" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            tier.is_active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                          }`}>
                            <TierIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {tier.name}
                              {tier.is_active ? (
                                <Badge className="bg-green-500/20 text-green-500">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Disabled</Badge>
                              )}
                            </CardTitle>
                            <CardDescription>
                              ${tier.price_monthly}/mo or ${tier.price_yearly}/yr
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={tier.is_active}
                            onCheckedChange={() => toggleTierActive(tier)}
                          />
                          <Button variant="ghost" size="sm" onClick={() => openDialog(tier)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Tier</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{tier.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => deleteTier(tier.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Max Emails</p>
                          <p className="font-medium">{tier.max_temp_emails}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Expiry Hours</p>
                          <p className="font-medium">{tier.email_expiry_hours}h</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">AI Summaries/Day</p>
                          <p className="font-medium">
                            {tier.ai_summaries_per_day === 0 ? (
                              <span className="text-destructive">Disabled</span>
                            ) : tier.ai_summaries_per_day}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {tier.can_forward_emails && <Badge variant="outline">Forwarding</Badge>}
                          {tier.can_use_custom_domains && <Badge variant="outline">Custom Domains</Badge>}
                          {tier.can_use_api && <Badge variant="outline">API</Badge>}
                          {tier.priority_support && <Badge variant="outline">Priority Support</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="content" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Page Content</CardTitle>
              <CardDescription>
                Customize the headlines and text shown on the pricing page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="headline">Main Headline</Label>
                <Input
                  id="headline"
                  value={content.headline}
                  onChange={(e) => setContent((prev) => ({ ...prev, headline: e.target.value }))}
                  placeholder="Choose the Perfect Plan for You"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subheadline">Subheadline</Label>
                <Textarea
                  id="subheadline"
                  value={content.subheadline}
                  onChange={(e) => setContent((prev) => ({ ...prev, subheadline: e.target.value }))}
                  placeholder="Start free and upgrade anytime..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ctaText">CTA Button Text</Label>
                <Input
                  id="ctaText"
                  value={content.ctaText}
                  onChange={(e) => setContent((prev) => ({ ...prev, ctaText: e.target.value }))}
                  placeholder="Get Started"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="featuredPlan">Featured Plan Name</Label>
                <Input
                  id="featuredPlan"
                  value={content.featuredPlan}
                  onChange={(e) => setContent((prev) => ({ ...prev, featuredPlan: e.target.value }))}
                  placeholder="pro"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the plan name (lowercase) that should be highlighted as "Most Popular"
                </p>
              </div>
              <Button onClick={saveContent} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save Content"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit/Add Tier Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTier?.id ? "Edit Tier" : "Add New Tier"}</DialogTitle>
            <DialogDescription>
              Configure the subscription tier details and features
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tierName">Tier Name</Label>
                <Input
                  id="tierName"
                  value={editingTier?.name || ""}
                  onChange={(e) => setEditingTier((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Pro, Business"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="active">Active</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    id="active"
                    checked={editingTier?.is_active ?? true}
                    onCheckedChange={(checked) =>
                      setEditingTier((prev) => ({ ...prev, is_active: checked }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {editingTier?.is_active ? "Visible to users" : "Hidden from users"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceMonthly">Monthly Price ($)</Label>
                <Input
                  id="priceMonthly"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingTier?.price_monthly || 0}
                  onChange={(e) =>
                    setEditingTier((prev) => ({ ...prev, price_monthly: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceYearly">Yearly Price ($)</Label>
                <Input
                  id="priceYearly"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editingTier?.price_yearly || 0}
                  onChange={(e) =>
                    setEditingTier((prev) => ({ ...prev, price_yearly: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxEmails">Max Temp Emails</Label>
                <Input
                  id="maxEmails"
                  type="number"
                  min="1"
                  value={editingTier?.max_temp_emails || 3}
                  onChange={(e) =>
                    setEditingTier((prev) => ({ ...prev, max_temp_emails: parseInt(e.target.value) || 3 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiryHours">Expiry Hours</Label>
                <Input
                  id="expiryHours"
                  type="number"
                  min="1"
                  value={editingTier?.email_expiry_hours || 1}
                  onChange={(e) =>
                    setEditingTier((prev) => ({ ...prev, email_expiry_hours: parseInt(e.target.value) || 1 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aiSummaries">AI Summaries/Day</Label>
                <Input
                  id="aiSummaries"
                  type="number"
                  min="0"
                  value={editingTier?.ai_summaries_per_day ?? 5}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                    setEditingTier((prev) => ({ ...prev, ai_summaries_per_day: isNaN(val) ? 0 : val }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Set to 0 to disable AI summaries for this tier
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Features</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingTier?.can_forward_emails || false}
                    onCheckedChange={(checked) =>
                      setEditingTier((prev) => ({ ...prev, can_forward_emails: checked }))
                    }
                  />
                  <span className="text-sm">Email Forwarding</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingTier?.can_use_custom_domains || false}
                    onCheckedChange={(checked) =>
                      setEditingTier((prev) => ({ ...prev, can_use_custom_domains: checked }))
                    }
                  />
                  <span className="text-sm">Custom Domains</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingTier?.can_use_api || false}
                    onCheckedChange={(checked) =>
                      setEditingTier((prev) => ({ ...prev, can_use_api: checked }))
                    }
                  />
                  <span className="text-sm">API Access</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingTier?.priority_support || false}
                    onCheckedChange={(checked) =>
                      setEditingTier((prev) => ({ ...prev, priority_support: checked }))
                    }
                  />
                  <span className="text-sm">Priority Support</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Custom Features List</Label>
              <div className="flex gap-2">
                <Input
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  placeholder="Add a feature..."
                  onKeyDown={(e) => e.key === "Enter" && addFeature()}
                />
                <Button type="button" onClick={addFeature} variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {editingTier?.features && editingTier.features.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {editingTier.features.map((feature, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {String(feature)}
                      <button
                        onClick={() => removeFeature(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={saveTier} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Tier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPricing;
