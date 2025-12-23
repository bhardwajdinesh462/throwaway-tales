import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Mail, 
  Sparkles, 
  Crown, 
  BarChart3, 
  Clock, 
  Send,
  ArrowLeft,
  CreditCard,
  Check,
  Star,
  Zap,
  Shield,
  TrendingUp,
  Calendar,
  Users,
  Search,
  Download,
  Webhook,
  FileText,
  Key,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { usePremiumFeatures } from "@/hooks/usePremiumFeatures";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import PremiumBadge from "@/components/PremiumBadge";
import EmailVerificationBanner from "@/components/EmailVerificationBanner";
import EmailAliases from "@/components/EmailAliases";
import WebhookNotifications from "@/components/WebhookNotifications";
import EmailTemplates from "@/components/EmailTemplates";

interface TempEmail {
  id: string;
  address: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { 
    tiers, 
    currentTier, 
    subscription, 
    usage, 
    isLoading: subLoading,
    subscribeTier,
    isPremium 
  } = useSubscription();
  
  const [tempEmails, setTempEmails] = useState<TempEmail[]>([]);
  const [totalEmailsReceived, setTotalEmailsReceived] = useState(0);

  // Fetch user's temp emails
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      // Fetch temp emails
      const { data: emails } = await supabase
        .from('temp_emails')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (emails) {
        setTempEmails(emails);
      }

      // Count received emails
      const { count } = await supabase
        .from('received_emails')
        .select('*', { count: 'exact', head: true })
        .in('temp_email_id', (emails || []).map(e => e.id));
      
      setTotalEmailsReceived(count || 0);
    };

    fetchUserData();
  }, [user]);

  const handleUpgrade = async (tierId: string) => {
    await subscribeTier(tierId);
  };

  const getTierIcon = (tierName: string) => {
    switch (tierName) {
      case 'business': return <Crown className="w-6 h-6" />;
      case 'pro': return <Sparkles className="w-6 h-6" />;
      default: return <Star className="w-6 h-6" />;
    }
  };

  const getTierColor = (tierName: string) => {
    switch (tierName) {
      case 'business': return 'from-amber-500 to-orange-500';
      case 'pro': return 'from-purple-500 to-pink-500';
      default: return 'from-slate-400 to-slate-500';
    }
  };

  if (authLoading || subLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const usagePercent = currentTier && currentTier.max_temp_emails > 0 
    ? (usage.temp_emails_created / currentTier.max_temp_emails) * 100 
    : 0;

  const aiUsagePercent = currentTier && currentTier.ai_summaries_per_day > 0 
    ? (usage.ai_summaries_used / currentTier.ai_summaries_per_day) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            className="mb-6" 
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          {/* Email Verification Banner */}
          <EmailVerificationBanner />

          {/* Welcome Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-foreground">
                Welcome back, {user.email?.split('@')[0]}!
              </h1>
              {currentTier && (
                <Badge className={`${
                  currentTier.name === 'business' 
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
                    : currentTier.name === 'pro' 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                      : 'bg-secondary text-secondary-foreground'
                } text-white font-medium capitalize`}>
                  {currentTier.name === 'business' && <Crown className="w-3 h-3 mr-1" />}
                  {currentTier.name === 'pro' && <Sparkles className="w-3 h-3 mr-1" />}
                  {currentTier.name} Plan
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Manage your subscription, view usage analytics, and access your emails.
            </p>
          </motion.div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="glass-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{tempEmails.length}</p>
                      <p className="text-sm text-muted-foreground">Active Emails</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="glass-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{totalEmailsReceived}</p>
                      <p className="text-sm text-muted-foreground">Emails Received</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="glass-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{usage.ai_summaries_used}</p>
                      <p className="text-sm text-muted-foreground">AI Summaries Today</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="glass-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Send className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{usage.emails_forwarded}</p>
                      <p className="text-sm text-muted-foreground">Emails Forwarded</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid grid-cols-5 bg-card border border-border">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Tools</span>
              </TabsTrigger>
              <TabsTrigger value="subscription" className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span className="hidden sm:inline">Plans</span>
              </TabsTrigger>
              <TabsTrigger value="emails" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">Emails</span>
              </TabsTrigger>
              <TabsTrigger value="usage" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">Usage</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Current Plan */}
                <Card className="glass-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      Current Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {currentTier && (
                      <div className="space-y-4">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${getTierColor(currentTier.name)} text-white`}>
                          {getTierIcon(currentTier.name)}
                          <span className="font-semibold capitalize">{currentTier.name}</span>
                        </div>
                        
                        {subscription && (
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <p className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              Renews: {format(new Date(subscription.current_period_end), 'PPP')}
                            </p>
                            {subscription.cancel_at_period_end && (
                              <Badge variant="destructive">Cancels at period end</Badge>
                            )}
                          </div>
                        )}

                        {currentTier.name === 'free' && (
                          <Button 
                            variant="neon" 
                            className="w-full"
                            onClick={() => document.getElementById('subscription-tab')?.click()}
                          >
                            <Zap className="w-4 h-4 mr-2" />
                            Upgrade Now
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Usage Summary */}
                <Card className="glass-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      Today's Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {currentTier && (
                      <>
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
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tools Tab */}
            <TabsContent value="tools">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="glass-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Email Aliases
                    </CardTitle>
                    <CardDescription>
                      Create multiple addresses from one temp email
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EmailAliases />
                  </CardContent>
                </Card>

                <Card className="glass-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Webhook className="w-5 h-5 text-primary" />
                      Webhooks
                    </CardTitle>
                    <CardDescription>
                      Send notifications to Discord, Slack, or custom endpoints
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <WebhookNotifications />
                  </CardContent>
                </Card>

                <Card className="glass-card border-border lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Email Templates
                    </CardTitle>
                    <CardDescription>
                      Create reusable reply templates
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EmailTemplates />
                  </CardContent>
                </Card>

                <Card className="glass-card border-border lg:col-span-2">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Key className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">API Access</p>
                          <p className="text-sm text-muted-foreground">Programmatic email management</p>
                        </div>
                      </div>
                      <Button onClick={() => navigate("/api-access")} className="gap-2">
                        <Key className="w-4 h-4" />
                        Manage API Keys
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Subscription Tab */}
            <TabsContent value="subscription" id="subscription-tab">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {tiers.map((tier, index) => (
                  <motion.div
                    key={tier.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className={`glass-card border-border relative overflow-hidden ${
                      currentTier?.id === tier.id ? 'ring-2 ring-primary' : ''
                    }`}>
                      {tier.name === 'pro' && (
                        <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-3 py-1 rounded-bl-lg">
                          Popular
                        </div>
                      )}
                      <CardHeader>
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r ${getTierColor(tier.name)} text-white w-fit`}>
                          {getTierIcon(tier.name)}
                          <span className="font-semibold capitalize">{tier.name}</span>
                        </div>
                        <CardTitle className="text-3xl font-bold">
                          ${tier.price_monthly}
                          <span className="text-sm font-normal text-muted-foreground">/month</span>
                        </CardTitle>
                        <CardDescription>
                          {tier.name === 'free' && 'Perfect for trying out'}
                          {tier.name === 'pro' && 'For power users'}
                          {tier.name === 'business' && 'For teams & enterprises'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <ul className="space-y-2">
                          {tier.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-500 shrink-0" />
                              <span className="text-muted-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>

                        {currentTier?.id === tier.id ? (
                          <Button variant="secondary" className="w-full" disabled>
                            Current Plan
                          </Button>
                        ) : tier.name === 'free' ? (
                          <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => handleUpgrade(tier.id)}
                          >
                            Downgrade
                          </Button>
                        ) : (
                          <Button 
                            variant="neon" 
                            className="w-full"
                            onClick={() => handleUpgrade(tier.id)}
                          >
                            <Zap className="w-4 h-4 mr-2" />
                            Upgrade to {tier.name}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* Emails Tab */}
            <TabsContent value="emails">
              <Card className="glass-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-primary" />
                    Your Temporary Emails
                  </CardTitle>
                  <CardDescription>
                    All temporary email addresses you've created
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {tempEmails.length === 0 ? (
                    <div className="text-center py-12">
                      <Mail className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">No emails created yet</p>
                      <Button 
                        variant="neon" 
                        className="mt-4"
                        onClick={() => navigate("/")}
                      >
                        Create Your First Email
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tempEmails.map((email) => (
                        <div
                          key={email.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/50"
                        >
                          <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-mono text-foreground">{email.address}</p>
                              <p className="text-xs text-muted-foreground">
                                Created {formatDistanceToNow(new Date(email.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <Badge variant={email.is_active && new Date(email.expires_at) > new Date() ? 'default' : 'secondary'}>
                            {email.is_active && new Date(email.expires_at) > new Date() ? 'Active' : 'Expired'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Usage Tab */}
            <TabsContent value="usage">
              <Card className="glass-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Usage Analytics
                  </CardTitle>
                  <CardDescription>
                    Your activity for today
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-foreground">Email Activity</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                          <span className="text-muted-foreground">Emails Created</span>
                          <span className="font-semibold text-foreground">{usage.temp_emails_created}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                          <span className="text-muted-foreground">Emails Received</span>
                          <span className="font-semibold text-foreground">{usage.emails_received}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                          <span className="text-muted-foreground">Emails Forwarded</span>
                          <span className="font-semibold text-foreground">{usage.emails_forwarded}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-foreground">AI Features</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                          <span className="text-muted-foreground">AI Summaries Used</span>
                          <span className="font-semibold text-foreground">{usage.ai_summaries_used}</span>
                        </div>
                        {currentTier && (
                          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                            <span className="text-muted-foreground">Daily Limit</span>
                            <span className="font-semibold text-foreground">
                              {currentTier.ai_summaries_per_day === -1 ? 'Unlimited' : currentTier.ai_summaries_per_day}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
