import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Check, Crown, Zap, Shield, Mail, Clock, Loader2, X, 
  Sparkles, Star, Rocket, Building2, Users, Globe, 
  Lock, Bell, FileText, Code, Headphones,
  ArrowRight, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useSupabaseAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { usePricingContent } from '@/hooks/usePricingContent';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import EmailVerificationBanner from '@/components/EmailVerificationBanner';

const PricingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tiers, subscription, isLoading } = useSubscription();
  const { requiresVerification } = useEmailVerification();
  const { content: pricingContent } = usePricingContent();
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

      if (error) throw error;

      if (data.code === 'STRIPE_NOT_CONFIGURED') {
        toast.info('Stripe is not configured yet. Please add your Stripe API keys in the admin panel.', { duration: 5000 });
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

  // Static feature lists for beautiful display
  const planFeatures = {
    free: {
      icon: Zap,
      color: 'from-emerald-500 to-teal-500',
      bgGlow: 'bg-emerald-500/20',
      description: 'Perfect for casual users who need basic privacy protection',
      features: [
        { text: '3 Temporary Emails', included: true, icon: Mail },
        { text: '1 Hour Email Expiry', included: true, icon: Clock },
        { text: '3 AI Summaries/Day', included: true, icon: Sparkles },
        { text: 'Email Search', included: true, icon: FileText },
        { text: 'Email Aliases', included: true, icon: Users },
        { text: 'Browser Notifications', included: true, icon: Bell },
        { text: 'Export Emails (PDF/EML)', included: true, icon: FileText },
        { text: 'Email Forwarding', included: false, icon: Mail },
        { text: 'Custom Domains', included: false, icon: Globe },
        { text: 'API Access', included: false, icon: Code },
        { text: 'Webhook Notifications', included: false, icon: Bell },
        { text: 'Priority Support', included: false, icon: Headphones },
      ],
    },
    pro: {
      icon: Crown,
      color: 'from-primary to-accent',
      bgGlow: 'bg-primary/20',
      description: 'For power users who need advanced features and more control',
      features: [
        { text: '25 Temporary Emails', included: true, icon: Mail },
        { text: '24 Hour Email Expiry', included: true, icon: Clock },
        { text: '50 AI Summaries/Day', included: true, icon: Sparkles },
        { text: 'Email Search', included: true, icon: FileText },
        { text: 'Custom Email Aliases', included: true, icon: Users },
        { text: 'Browser Notifications', included: true, icon: Bell },
        { text: 'Export Emails (PDF/EML)', included: true, icon: FileText },
        { text: 'Email Forwarding', included: true, icon: Mail },
        { text: 'Email Scheduling', included: true, icon: Clock },
        { text: 'Email Templates', included: true, icon: FileText },
        { text: 'Custom Domains', included: false, icon: Globe },
        { text: 'API Access', included: false, icon: Code },
      ],
    },
  business: {
      icon: Building2,
      color: 'from-violet-500 to-purple-500',
      bgGlow: 'bg-violet-500/20',
      description: 'Enterprise-grade features for teams and businesses',
      features: [
        { text: 'Unlimited Temporary Emails', included: true, icon: Mail },
        { text: '72 Hour Email Expiry', included: true, icon: Clock },
        { text: 'Unlimited AI Summaries', included: true, icon: Sparkles },
        { text: 'Advanced Email Search', included: true, icon: FileText },
        { text: 'Unlimited Custom Aliases', included: true, icon: Users },
        { text: 'All Notification Types', included: true, icon: Bell },
        { text: 'Email Forwarding', included: true, icon: Mail },
        { text: 'Custom Domains', included: true, icon: Globe },
        { text: 'Full API Access', included: true, icon: Code },
        { text: 'Webhook Notifications', included: true, icon: Bell },
        { text: 'Priority Support 24/7', included: true, icon: Headphones },
        { text: 'Advanced Security', included: true, icon: Lock },
      ],
    },
  };

  const getPlanConfig = (tierName: string) => {
    const name = tierName.toLowerCase();
    if (name.includes('business') || name.includes('enterprise')) return planFeatures.business;
    if (name.includes('pro') || name.includes('premium')) return planFeatures.pro;
    return planFeatures.free;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-12 h-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Header />
      
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black,transparent)]" />
      </div>

      <main className="pt-28 pb-20">
        <div className="container mx-auto px-4">
          {user && <EmailVerificationBanner />}

          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto mb-16"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 mb-6 backdrop-blur-sm"
            >
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-medium bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Simple, Transparent Pricing
              </span>
            </motion.div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-foreground">
              {pricingContent.headline.includes('Plan') ? (
                <>
                  {pricingContent.headline.split('Plan')[0]}
                  <span className="block mt-2">
                    <span className="gradient-text">Plan{pricingContent.headline.split('Plan')[1]}</span>
                  </span>
                </>
              ) : (
                <span className="gradient-text">{pricingContent.headline}</span>
              )}
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {pricingContent.subheadline}
            </p>
          </motion.div>

          {/* Billing Toggle */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex justify-center mb-12"
          >
            <div className="relative p-1 rounded-2xl bg-secondary/50 border border-border backdrop-blur-sm">
              <div className="flex gap-1">
                <button
                  onClick={() => setSelectedBilling('monthly')}
                  className={`relative px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                    selectedBilling === 'monthly'
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {selectedBilling === 'monthly' && (
                    <motion.div
                      layoutId="billing-toggle"
                      className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-xl"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">Monthly</span>
                </button>
                <button
                  onClick={() => setSelectedBilling('yearly')}
                  className={`relative px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                    selectedBilling === 'yearly'
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {selectedBilling === 'yearly' && (
                    <motion.div
                      layoutId="billing-toggle"
                      className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-xl"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    Yearly
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                      Save 20%
                    </Badge>
                  </span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Pricing Cards */}
          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
            {tiers.map((tier, index) => {
              const price = selectedBilling === 'monthly' 
                ? Number(tier.price_monthly) 
                : Number(tier.price_yearly);
              const isCurrentPlan = subscription?.tier_id === tier.id;
              const isPro = tier.name.toLowerCase() === pricingContent.featuredPlan.toLowerCase();
              const planConfig = getPlanConfig(tier.name);
              const PlanIcon = planConfig.icon;

              return (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className={`relative ${isPro ? 'lg:-mt-4 lg:mb-4' : ''}`}
                >
                  {/* Popular Badge */}
                  {isPro && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="absolute -top-4 left-1/2 -translate-x-1/2 z-20"
                    >
                      <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium shadow-lg shadow-primary/25">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        Most Popular
                      </div>
                    </motion.div>
                  )}

                  <Card className={`relative h-full overflow-hidden transition-all duration-300 hover:shadow-2xl ${
                    isPro 
                      ? 'border-primary/50 shadow-xl shadow-primary/10 bg-gradient-to-b from-primary/5 to-transparent' 
                      : 'border-border hover:border-primary/30'
                  }`}>
                    {/* Glow Effect */}
                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 ${planConfig.bgGlow} blur-3xl opacity-50`} />
                    
                    <CardHeader className="relative pb-4 pt-8">
                      {/* Icon */}
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${planConfig.color} p-0.5 mb-4`}>
                        <div className="w-full h-full rounded-[14px] bg-card flex items-center justify-center">
                          <PlanIcon className="w-6 h-6 text-primary" />
                        </div>
                      </div>
                      
                      <CardTitle className="text-2xl font-bold">{tier.name}</CardTitle>
                      <CardDescription className="text-sm min-h-[40px]">
                        {planConfig.description}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="relative space-y-6">
                      {/* Price */}
                      <div className="pb-6 border-b border-border">
                        <div className="flex items-baseline gap-1">
                          <span className="text-5xl font-bold text-foreground">${price}</span>
                          {price > 0 && (
                            <span className="text-muted-foreground text-lg">
                              /{selectedBilling === 'monthly' ? 'mo' : 'yr'}
                            </span>
                          )}
                        </div>
                        {price === 0 && (
                          <p className="text-sm text-muted-foreground mt-1">Free forever</p>
                        )}
                        {selectedBilling === 'yearly' && price > 0 && (
                          <p className="text-sm text-emerald-400 mt-1">
                            Save ${Math.round(Number(tier.price_monthly) * 12 - price)} per year
                          </p>
                        )}
                      </div>

                      {/* Features */}
                      <ul className="space-y-3">
                        {planConfig.features.map((feature, i) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 + i * 0.03 }}
                            className={`flex items-center gap-3 text-sm ${
                              feature.included ? 'text-foreground' : 'text-muted-foreground/50'
                            }`}
                          >
                            <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                              feature.included 
                                ? 'bg-emerald-500/20 text-emerald-400' 
                                : 'bg-muted/50 text-muted-foreground/50'
                            }`}>
                              {feature.included ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                            </div>
                            <span className={feature.included ? '' : 'line-through'}>{feature.text}</span>
                          </motion.li>
                        ))}
                      </ul>

                      {/* CTA Button */}
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="pt-4"
                      >
                        <Button
                          className={`w-full h-12 text-base font-medium ${
                            isPro 
                              ? 'bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25' 
                              : ''
                          }`}
                          variant={isPro ? 'default' : 'outline'}
                          disabled={isCurrentPlan || processingTier === tier.id}
                          onClick={() => handleSelectPlan(tier.id, tier.name, price)}
                        >
                          {processingTier === tier.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : isCurrentPlan ? (
                            <span className="flex items-center gap-2">
                              <Check className="w-5 h-5" />
                              Current Plan
                            </span>
                          ) : price === 0 ? (
                            <span className="flex items-center gap-2">
                              Get Started Free
                              <ArrowRight className="w-4 h-4" />
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              Upgrade to {tier.name}
                              <ArrowRight className="w-4 h-4" />
                            </span>
                          )}
                        </Button>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Testimonials Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-20 mb-16"
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Loved by <span className="gradient-text">Thousands</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                See what our users are saying about Nullsto
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                {
                  name: 'Sarah M.',
                  role: 'Freelance Designer',
                  avatar: 'SM',
                  rating: 5,
                  text: 'Nullsto has been a game-changer for my workflow. No more spam in my main inbox when signing up for design resources!',
                },
                {
                  name: 'Alex K.',
                  role: 'Software Developer',
                  avatar: 'AK',
                  rating: 5,
                  text: 'The API access in the Pro plan is fantastic. I integrated it into my testing pipeline and it works flawlessly.',
                },
                {
                  name: 'Maria L.',
                  role: 'Marketing Manager',
                  avatar: 'ML',
                  rating: 5,
                  text: 'Finally, a temp email service that actually works! The AI summaries save me so much time reviewing newsletters.',
                },
                {
                  name: 'James R.',
                  role: 'Security Analyst',
                  avatar: 'JR',
                  rating: 5,
                  text: 'As someone who values privacy, Nullsto gives me peace of mind. The encryption and security features are top-notch.',
                },
                {
                  name: 'Emma T.',
                  role: 'Student',
                  avatar: 'ET',
                  rating: 5,
                  text: 'Perfect for signing up to educational platforms. The free tier is generous and the interface is super intuitive.',
                },
                {
                  name: 'David P.',
                  role: 'Startup Founder',
                  avatar: 'DP',
                  rating: 5,
                  text: 'We use the Business plan for our team. Custom domains and webhook notifications are exactly what we needed.',
                },
              ].map((testimonial, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                >
                  <Card className="h-full hover:border-primary/30 transition-all duration-300 bg-card/50 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-1 mb-4">
                        {Array.from({ length: testimonial.rating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                        "{testimonial.text}"
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-medium text-sm">
                          {testimonial.avatar}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{testimonial.name}</p>
                          <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Bottom Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-16 text-center"
          >
            <div className="glass-card p-8 max-w-3xl mx-auto">
              <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground">Money-back Guarantee</p>
                    <p className="text-sm text-muted-foreground">30-day refund policy</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground">Secure Payments</p>
                    <p className="text-sm text-muted-foreground">Powered by Stripe</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <Headphones className="w-5 h-5 text-accent" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground">24/7 Support</p>
                    <p className="text-sm text-muted-foreground">Always here to help</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground mt-8">
              Have questions? <Link to="/contact" className="text-primary hover:underline">Contact us</Link> or join our{' '}
              <a 
                href="https://t.me/nullstoemail" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                <MessageSquare className="w-4 h-4" />
                Telegram community
              </a>
            </p>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PricingPage;
