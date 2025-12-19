import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, 
  Crown, 
  Zap, 
  Star, 
  Calendar, 
  ExternalLink, 
  Receipt,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useEmailVerification } from "@/hooks/useEmailVerification";
import { format } from "date-fns";
import { toast } from "sonner";
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

const SubscriptionManagement = () => {
  const navigate = useNavigate();
  const { 
    currentTier, 
    subscription, 
    usage, 
    cancelSubscription,
    isPremium 
  } = useSubscription();
  const { isEmailVerified } = useEmailVerification();
  const [isCancelling, setIsCancelling] = useState(false);

  const getTierIcon = (tierName: string) => {
    switch (tierName?.toLowerCase()) {
      case 'business': return <Crown className="w-5 h-5" />;
      case 'pro': return <Zap className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  const getTierColor = (tierName: string) => {
    switch (tierName?.toLowerCase()) {
      case 'business': return 'bg-gradient-to-r from-amber-500 to-orange-500';
      case 'pro': return 'bg-gradient-to-r from-purple-500 to-pink-500';
      default: return 'bg-gradient-to-r from-slate-400 to-slate-500';
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      await cancelSubscription();
    } finally {
      setIsCancelling(false);
    }
  };

  const usagePercent = currentTier && currentTier.max_temp_emails > 0 && currentTier.max_temp_emails !== -1
    ? (usage.temp_emails_created / currentTier.max_temp_emails) * 100 
    : 0;

  const aiUsagePercent = currentTier && currentTier.ai_summaries_per_day > 0 && currentTier.ai_summaries_per_day !== -1
    ? (usage.ai_summaries_used / currentTier.ai_summaries_per_day) * 100 
    : 0;

  return (
    <Card className="glass-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          Subscription & Billing
        </CardTitle>
        <CardDescription>Manage your subscription and view billing information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Plan */}
        <div className="p-4 rounded-lg bg-secondary/20 border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg text-white ${getTierColor(currentTier?.name || 'free')}`}>
                {getTierIcon(currentTier?.name || 'free')}
              </div>
              <div>
                <h3 className="font-semibold text-foreground capitalize">
                  {currentTier?.name || 'Free'} Plan
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isPremium ? 'Premium features enabled' : 'Basic features only'}
                </p>
              </div>
            </div>
            <Badge variant={isPremium ? 'default' : 'secondary'}>
              {isPremium ? 'Active' : 'Free'}
            </Badge>
          </div>

          {subscription && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  {subscription.cancel_at_period_end 
                    ? `Ends on ${format(new Date(subscription.current_period_end), 'PPP')}`
                    : `Renews on ${format(new Date(subscription.current_period_end), 'PPP')}`
                  }
                </span>
              </div>
              {subscription.cancel_at_period_end && (
                <div className="flex items-center gap-2 text-amber-500">
                  <AlertCircle className="w-4 h-4" />
                  <span>Subscription will cancel at period end</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Email Verification Status */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/10">
          {isEmailVerified() ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Email verified - eligible for premium</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Verify your email to access premium features</span>
            </>
          )}
        </div>

        {/* Usage Stats */}
        {currentTier && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Today's Usage</h4>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Temp Emails Created</span>
                <span className="text-foreground">
                  {usage.temp_emails_created} / {currentTier.max_temp_emails === -1 ? '∞' : currentTier.max_temp_emails}
                </span>
              </div>
              <Progress value={currentTier.max_temp_emails === -1 ? 0 : usagePercent} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">AI Summaries Used</span>
                <span className="text-foreground">
                  {usage.ai_summaries_used} / {currentTier.ai_summaries_per_day === -1 ? '∞' : currentTier.ai_summaries_per_day}
                </span>
              </div>
              <Progress value={currentTier.ai_summaries_per_day === -1 ? 0 : aiUsagePercent} className="h-2" />
            </div>
          </div>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {!isPremium ? (
            <Button onClick={() => navigate('/pricing')} className="flex-1">
              <Zap className="w-4 h-4 mr-2" />
              Upgrade Plan
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => navigate('/pricing')}>
                <Zap className="w-4 h-4 mr-2" />
                Change Plan
              </Button>
              
              {!subscription?.cancel_at_period_end && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-destructive hover:text-destructive">
                      Cancel Subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="glass-card">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your subscription will remain active until the end of the current billing period. 
                        After that, you'll be downgraded to the free plan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelSubscription}
                        disabled={isCancelling}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isCancelling ? 'Cancelling...' : 'Cancel Subscription'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}

          <Button variant="outline" onClick={() => navigate('/billing')}>
            <Receipt className="w-4 h-4 mr-2" />
            Billing History
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubscriptionManagement;