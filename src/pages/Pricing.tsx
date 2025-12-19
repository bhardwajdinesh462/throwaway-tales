import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Crown, Zap, Shield, Mail, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useSupabaseAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import EmailVerificationBanner from '@/components/EmailVerificationBanner';

const PricingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tiers, subscription, isLoading } = useSubscription();
  const { requiresVerification } = useEmailVerification();
  const [selectedBilling, setSelectedBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [processingTier, setProcessingTier] = useState<string | null>(null);

  const handleSelectPlan = async (tierId: string, tierName: string, price: number) => {
    if (!user) {
      toast.error('Please sign in to subscribe');
      navigate('/auth');
      return;
    }

    if (price === 0) {
      toast.info('You are on the Free plan');
      return;
    }

    // Check email verification
    if (requiresVerification()) {
      toast.error('Please verify your email before subscribing to a premium plan');
      return;
    }

    setProcessingTier(tierId);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          tier_id: tierId,
          billing_cycle: selectedBilling,
          success_url: `${window.location.origin}/dashboard?checkout=success`,
          cancel_url: `${window.location.origin}/pricing?checkout=cancelled`,
        },
      });

      if (error) {
        throw error;
      }

      if (data.code === 'STRIPE_NOT_CONFIGURED') {
        toast.info(
          'Stripe is not configured yet. Please add your Stripe API keys in the admin panel under Settings > Payments.',
          { duration: 5000 }
        );
        return;
      }

      if (data.code === 'EMAIL_NOT_VERIFIED') {
        toast.error('Please verify your email before subscribing');
        return;
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setProcessingTier(null);
    }
  };

  const getFeatureIcon = (feature: string) => {
    if (feature.toLowerCase().includes('email')) return <Mail className="w-4 h-4" />;
    if (feature.toLowerCase().includes('hour') || feature.toLowerCase().includes('time')) return <Clock className="w-4 h-4" />;
    if (feature.toLowerCase().includes('security') || feature.toLowerCase().includes('encrypt')) return <Shield className="w-4 h-4" />;
    if (feature.toLowerCase().includes('ai') || feature.toLowerCase().includes('summar')) return <Zap className="w-4 h-4" />;
    return <Check className="w-4 h-4" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Email Verification Banner */}
          {user && <EmailVerificationBanner />}

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto mb-12"
          >
            <Badge className="mb-4" variant="outline">
              <Crown className="w-3 h-3 mr-1" />
              Premium Plans
            </Badge>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Choose Your Plan
            </h1>
            <p className="text-lg text-muted-foreground">
              Unlock premium features and get more out of your temporary email experience
            </p>
          </motion.div>

          {/* Billing Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-secondary/50 p-1 rounded-lg flex gap-1">
              <Button
                variant={selectedBilling === 'monthly' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedBilling('monthly')}
              >
                Monthly
              </Button>
              <Button
                variant={selectedBilling === 'yearly' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedBilling('yearly')}
              >
                Yearly
                <Badge variant="secondary" className="ml-2 text-xs">Save 20%</Badge>
              </Button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {tiers.map((tier, index) => {
              const price = selectedBilling === 'monthly' 
                ? Number(tier.price_monthly) 
                : Number(tier.price_yearly);
              const isCurrentPlan = subscription?.tier_id === tier.id;
              const isPro = tier.name.toLowerCase() === 'pro';
              const features = Array.isArray(tier.features) ? tier.features : [];

              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className={`relative h-full ${isPro ? 'border-primary shadow-lg shadow-primary/20' : 'border-border'}`}>
                    {isPro && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">
                          <Crown className="w-3 h-3 mr-1" />
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-2">
                      <CardTitle className="text-xl">{tier.name}</CardTitle>
                      <CardDescription>
                        {tier.name === 'Free' && 'Get started for free'}
                        {tier.name === 'Pro' && 'For power users'}
                        {tier.name === 'Business' && 'For teams and enterprises'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Price */}
                      <div className="text-center">
                        <span className="text-4xl font-bold text-foreground">
                          ${price}
                        </span>
                        {price > 0 && (
                          <span className="text-muted-foreground">
                            /{selectedBilling === 'monthly' ? 'mo' : 'yr'}
                          </span>
                        )}
                      </div>

                      {/* Features */}
                      <ul className="space-y-3">
                        <li className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-primary" />
                          <span>{tier.max_temp_emails} temp emails</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-primary" />
                          <span>{tier.email_expiry_hours}h email expiry</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Zap className="w-4 h-4 text-primary" />
                          <span>{tier.ai_summaries_per_day} AI summaries/day</span>
                        </li>
                        {tier.can_forward_emails && (
                          <li className="flex items-center gap-2 text-sm text-green-500">
                            <Check className="w-4 h-4" />
                            <span>Email forwarding</span>
                          </li>
                        )}
                        {tier.can_use_custom_domains && (
                          <li className="flex items-center gap-2 text-sm text-green-500">
                            <Check className="w-4 h-4" />
                            <span>Custom domains</span>
                          </li>
                        )}
                        {tier.can_use_api && (
                          <li className="flex items-center gap-2 text-sm text-green-500">
                            <Check className="w-4 h-4" />
                            <span>API access</span>
                          </li>
                        )}
                        {tier.priority_support && (
                          <li className="flex items-center gap-2 text-sm text-green-500">
                            <Check className="w-4 h-4" />
                            <span>Priority support</span>
                          </li>
                        )}
                        {features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-green-500">
                            {getFeatureIcon(String(feature))}
                            <span>{String(feature)}</span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA Button */}
                      <Button
                        className="w-full"
                        variant={isPro ? 'default' : 'outline'}
                        disabled={isCurrentPlan || processingTier === tier.id}
                        onClick={() => handleSelectPlan(tier.id, tier.name, price)}
                      >
                        {processingTier === tier.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isCurrentPlan ? (
                          'Current Plan'
                        ) : price === 0 ? (
                          'Get Started'
                        ) : (
                          'Subscribe'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* FAQ or Additional Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-12"
          >
            <p className="text-muted-foreground">
              All plans include basic email features. Cancel anytime.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Need help choosing? <a href="/contact" className="text-primary hover:underline">Contact us</a>
            </p>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PricingPage;