import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { api } from "@/lib/api";
import { useSubscription } from "@/hooks/useSubscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Crown, 
  Zap, 
  Star, 
  CreditCard, 
  Calendar, 
  Clock, 
  ArrowLeft, 
  ArrowUpRight,
  Mail,
  Sparkles,
  Receipt,
  Download,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { toast } from "sonner";
import SEOHead from "@/components/SEOHead";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface Invoice {
  id: string;
  stripe_invoice_id: string | null;
  amount_paid: number;
  currency: string;
  status: string;
  description: string | null;
  invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  paid_at: string | null;
}

const SubscriptionDetails = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { 
    subscription, 
    currentTier, 
    tiers, 
    usage, 
    isLoading: subscriptionLoading, 
    cancelSubscription 
  } = useSubscription();
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch invoices
  useEffect(() => {
    const fetchInvoices = async () => {
      if (!user) return;
      
      const { data, error } = await api.db.query<Invoice[]>("user_invoices", {
        select: "*",
        filter: { user_id: user.id },
        order: { column: "created_at", ascending: false },
        limit: 10
      });

      if (!error && data) {
        setInvoices(data);
      }
      setInvoicesLoading(false);
    };

    fetchInvoices();
  }, [user]);

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      await cancelSubscription();
      toast.success("Subscription cancelled. You'll retain access until the end of your billing period.");
      setShowCancelDialog(false);
    } catch (error) {
      toast.error("Failed to cancel subscription. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  };

  const getTierIcon = (tierName: string) => {
    switch (tierName?.toLowerCase()) {
      case 'business':
        return <Crown className="h-6 w-6 text-yellow-500" />;
      case 'pro':
        return <Zap className="h-6 w-6 text-blue-500" />;
      default:
        return <Star className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getTierColor = (tierName: string) => {
    switch (tierName?.toLowerCase()) {
      case 'business':
        return 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/20';
      case 'pro':
        return 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/20';
      default:
        return 'bg-muted/50';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>;
      case "pending":
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "active":
        return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
      case "cancelled":
        return <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number, currency: string = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  // Calculate usage percentages
  const emailUsagePercent = currentTier?.max_temp_emails === -1 
    ? 0 
    : Math.min(100, ((usage?.temp_emails_created || 0) / (currentTier?.max_temp_emails || 1)) * 100);
  
  const aiUsagePercent = currentTier?.ai_summaries_per_day === -1 
    ? 0 
    : Math.min(100, ((usage?.ai_summaries_used || 0) / (currentTier?.ai_summaries_per_day || 1)) * 100);

  // Calculate days remaining
  const daysRemaining = subscription?.current_period_end 
    ? differenceInDays(new Date(subscription.current_period_end), new Date())
    : null;
  
  const hoursRemaining = subscription?.current_period_end 
    ? differenceInHours(new Date(subscription.current_period_end), new Date()) % 24
    : null;

  const isLoading = authLoading || subscriptionLoading;

  if (!authLoading && !user) {
    return (
      <>
        <SEOHead title="Subscription | Sign In Required" description="Sign in to manage your subscription" />
        <Header />
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="py-12 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
              <p className="text-muted-foreground mb-6">Please sign in to view your subscription details.</p>
              <Button onClick={() => navigate("/auth")}>Sign In</Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SEOHead 
        title="Subscription Management | Your Plan" 
        description="Manage your subscription, view usage, and billing history." 
      />
      <Header />
      
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="container mx-auto max-w-5xl space-y-6">
          {/* Back Button */}
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {/* Current Plan Card */}
          <Card className={`${getTierColor(currentTier?.name || 'free')} border`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isLoading ? (
                    <Skeleton className="h-12 w-12 rounded-lg" />
                  ) : (
                    <div className="p-3 rounded-lg bg-background/80">
                      {getTierIcon(currentTier?.name || 'free')}
                    </div>
                  )}
                  <div>
                    {isLoading ? (
                      <>
                        <Skeleton className="h-6 w-32 mb-1" />
                        <Skeleton className="h-4 w-48" />
                      </>
                    ) : (
                      <>
                        <CardTitle className="flex items-center gap-2">
                          {currentTier?.name || 'Free'} Plan
                          {subscription && getStatusBadge(subscription.status)}
                        </CardTitle>
                        <CardDescription>
                          {currentTier?.price_monthly === 0 
                            ? 'Free forever' 
                            : `${formatCurrency(currentTier?.price_monthly || 0)}/month`}
                        </CardDescription>
                      </>
                    )}
                  </div>
                </div>
                
                {!isLoading && (
                  <div className="flex gap-2">
                    {currentTier?.name?.toLowerCase() !== 'business' && (
                      <Button onClick={() => navigate("/pricing")}>
                        <ArrowUpRight className="mr-2 h-4 w-4" />
                        Upgrade
                      </Button>
                    )}
                    {subscription && subscription.status === 'active' && currentTier?.price_monthly > 0 && (
                      <Button variant="outline" onClick={() => setShowCancelDialog(true)}>
                        Cancel Plan
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            
            {subscription && daysRemaining !== null && (
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {subscription.cancel_at_period_end ? (
                    <span className="text-amber-600">
                      Plan ends in {daysRemaining} days ({hoursRemaining} hours)
                    </span>
                  ) : (
                    <span>
                      Renews in {daysRemaining} days • {format(new Date(subscription.current_period_end), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Usage Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Email Usage */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Temporary Emails</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Used today</span>
                      <span className="font-medium">
                        {usage?.temp_emails_created || 0}
                        {currentTier?.max_temp_emails !== -1 && ` / ${currentTier?.max_temp_emails}`}
                        {currentTier?.max_temp_emails === -1 && ' (Unlimited)'}
                      </span>
                    </div>
                    {currentTier?.max_temp_emails !== -1 && (
                      <Progress value={emailUsagePercent} className="h-2" />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {currentTier?.max_temp_emails === -1 
                        ? 'Create unlimited temporary emails' 
                        : `${currentTier?.max_temp_emails - (usage?.temp_emails_created || 0)} remaining today`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Summaries */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">AI Summaries</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Used today</span>
                      <span className="font-medium">
                        {usage?.ai_summaries_used || 0}
                        {currentTier?.ai_summaries_per_day !== -1 && ` / ${currentTier?.ai_summaries_per_day}`}
                        {currentTier?.ai_summaries_per_day === -1 && ' (Unlimited)'}
                      </span>
                    </div>
                    {currentTier?.ai_summaries_per_day !== -1 && (
                      <Progress value={aiUsagePercent} className="h-2" />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {currentTier?.ai_summaries_per_day === -1 
                        ? 'Generate unlimited AI email summaries' 
                        : `${currentTier?.ai_summaries_per_day - (usage?.ai_summaries_used || 0)} remaining today`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Plan Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Plan Comparison
              </CardTitle>
              <CardDescription>Compare features across all plans</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feature</TableHead>
                        {tiers.map(tier => (
                          <TableHead key={tier.id} className="text-center">
                            <span className={tier.id === currentTier?.id ? 'text-primary font-semibold' : ''}>
                              {tier.name}
                              {tier.id === currentTier?.id && <Badge variant="outline" className="ml-2">Current</Badge>}
                            </span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Temp Emails / Day</TableCell>
                        {tiers.map(tier => (
                          <TableCell key={tier.id} className="text-center">
                            {tier.max_temp_emails === -1 ? 'Unlimited' : tier.max_temp_emails}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell>AI Summaries / Day</TableCell>
                        {tiers.map(tier => (
                          <TableCell key={tier.id} className="text-center">
                            {tier.ai_summaries_per_day === -1 ? 'Unlimited' : tier.ai_summaries_per_day}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell>Email Expiry</TableCell>
                        {tiers.map(tier => (
                          <TableCell key={tier.id} className="text-center">
                            {tier.email_expiry_hours >= 720 
                              ? `${Math.round(tier.email_expiry_hours / 720)} months` 
                              : tier.email_expiry_hours >= 24 
                                ? `${Math.round(tier.email_expiry_hours / 24)} days`
                                : `${tier.email_expiry_hours} hours`}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell>Email Forwarding</TableCell>
                        {tiers.map(tier => (
                          <TableCell key={tier.id} className="text-center">
                            {tier.can_forward_emails ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell>Custom Domains</TableCell>
                        {tiers.map(tier => (
                          <TableCell key={tier.id} className="text-center">
                            {tier.can_use_custom_domains ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell>API Access</TableCell>
                        {tiers.map(tier => (
                          <TableCell key={tier.id} className="text-center">
                            {tier.can_use_api ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell>Priority Support</TableCell>
                        {tiers.map(tier => (
                          <TableCell key={tier.id} className="text-center">
                            {tier.priority_support ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Price</TableCell>
                        {tiers.map(tier => (
                          <TableCell key={tier.id} className="text-center font-semibold">
                            {tier.price_monthly === 0 ? 'Free' : `${formatCurrency(tier.price_monthly)}/mo`}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => navigate("/pricing")}>
                View Pricing Details
              </Button>
            </CardFooter>
          </Card>

          {/* Billing History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  <div>
                    <CardTitle>Billing History</CardTitle>
                    <CardDescription>Your recent invoices and payments</CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/billing")}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No billing history yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.slice(0, 5).map(invoice => (
                      <TableRow key={invoice.id}>
                        <TableCell>{format(new Date(invoice.created_at), "MMM d, yyyy")}</TableCell>
                        <TableCell>{invoice.description || "Subscription"}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(invoice.amount_paid, invoice.currency)}</TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {invoice.invoice_url && (
                              <Button variant="ghost" size="icon" asChild>
                                <a href={invoice.invoice_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {invoice.invoice_pdf && (
                              <Button variant="ghost" size="icon" asChild>
                                <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Payment Method */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                <div>
                  <CardTitle>Payment Method</CardTitle>
                  <CardDescription>Manage your payment information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-background">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Payment managed by Stripe / PayPal</p>
                    <p className="text-sm text-muted-foreground">Click below to update your payment method</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => navigate("/pricing")}>
                  Manage Payment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your subscription? You'll continue to have access to premium features until the end of your current billing period.
              {subscription?.current_period_end && (
                <span className="block mt-2 font-medium">
                  Access ends: {format(new Date(subscription.current_period_end), "MMMM d, yyyy")}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelSubscription} 
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? "Cancelling..." : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </>
  );
};

export default SubscriptionDetails;
