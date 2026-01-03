import { motion, AnimatePresence } from "framer-motion";
import { Crown, Check, X, Sparkles, Zap, Shield, MessageCircle, CreditCard, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubscriptionTier, usePremiumFeatures } from "@/hooks/usePremiumFeatures";
import { usePaymentSettings } from "@/hooks/usePaymentSettings";
import { useNavigate } from "react-router-dom";

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: string;
  requiredTier?: SubscriptionTier;
}

const UpgradePrompt = ({ isOpen, onClose, feature, requiredTier = 'pro' }: UpgradePromptProps) => {
  const navigate = useNavigate();
  const { tier: currentTier, tierPrices, tierLimits } = usePremiumFeatures();
  const { 
    stripeEnabled, 
    paypalEnabled, 
    telegramEnabled, 
    telegramLink,
    hasPaidPaymentMethod 
  } = usePaymentSettings();

  const tiers: { name: SubscriptionTier; label: string; icon: typeof Crown; color: string }[] = [
    { name: 'free', label: 'Free', icon: Zap, color: 'text-muted-foreground' },
    { name: 'pro', label: 'Pro', icon: Sparkles, color: 'text-purple-500' },
    { name: 'business', label: 'Business', icon: Crown, color: 'text-amber-500' },
  ];

  const handleUpgrade = () => {
    if (hasPaidPaymentMethod) {
      navigate('/pricing');
    } else if (telegramEnabled) {
      window.open(telegramLink, '_blank');
    }
    onClose();
  };

  const handleTelegram = () => {
    window.open(telegramLink, '_blank');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          >
            <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden m-4">
              {/* Header */}
              <div className="relative px-6 py-8 bg-gradient-to-br from-primary/20 via-background to-accent/20 border-b border-border">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4"
                  onClick={onClose}
                >
                  <X className="w-5 h-5" />
                </Button>
                
                <div className="text-center">
                  <div className="inline-flex p-3 rounded-full bg-primary/20 mb-4">
                    <Crown className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">
                    {feature ? `Unlock ${feature}` : 'Upgrade Your Plan'}
                  </h2>
                  <p className="text-muted-foreground mt-2">
                    Get more features and enhanced privacy protection
                  </p>
                </div>
              </div>

              {/* Pricing Cards */}
              <div className="p-6">
                <div className="grid md:grid-cols-3 gap-4">
                  {tiers.map((tierInfo) => {
                    const limits = tierLimits[tierInfo.name];
                    const price = tierPrices[tierInfo.name];
                    const isCurrentTier = currentTier === tierInfo.name;
                    const isRecommended = tierInfo.name === requiredTier;

                    return (
                      <motion.div
                        key={tierInfo.name}
                        whileHover={{ scale: 1.02 }}
                        className={`relative p-6 rounded-xl border-2 transition-colors ${
                          isRecommended 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {isRecommended && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                              Recommended
                            </span>
                          </div>
                        )}

                        <div className="text-center mb-4">
                          <tierInfo.icon className={`w-8 h-8 mx-auto mb-2 ${tierInfo.color}`} />
                          <h3 className="text-lg font-semibold text-foreground">{tierInfo.label}</h3>
                          <div className="mt-2">
                            <span className="text-3xl font-bold text-foreground">${price}</span>
                            {price > 0 && <span className="text-muted-foreground">/month</span>}
                          </div>
                        </div>

                        <ul className="space-y-2 mb-6 text-sm">
                          <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500 shrink-0" />
                            <span className="text-foreground">
                              {limits.maxTempEmails === -1 ? 'Unlimited' : limits.maxTempEmails} temp emails
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500 shrink-0" />
                            <span className="text-foreground">
                              {limits.emailExpiryHours}h email expiry
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            {limits.canForwardEmails ? (
                              <Check className="w-4 h-4 text-green-500 shrink-0" />
                            ) : (
                              <X className="w-4 h-4 text-muted-foreground shrink-0" />
                            )}
                            <span className={limits.canForwardEmails ? 'text-foreground' : 'text-muted-foreground'}>
                              Email forwarding
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            {limits.canUseApi ? (
                              <Check className="w-4 h-4 text-green-500 shrink-0" />
                            ) : (
                              <X className="w-4 h-4 text-muted-foreground shrink-0" />
                            )}
                            <span className={limits.canUseApi ? 'text-foreground' : 'text-muted-foreground'}>
                              API access
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500 shrink-0" />
                            <span className="text-foreground">
                              {limits.aiSummariesPerDay === -1 ? 'Unlimited' : limits.aiSummariesPerDay} AI summaries/day
                            </span>
                          </li>
                        </ul>

                        {isCurrentTier ? (
                          <Button variant="outline" className="w-full" disabled>
                            Current Plan
                          </Button>
                        ) : tierInfo.name === 'free' ? (
                          <Button variant="ghost" className="w-full" disabled>
                            Free Forever
                          </Button>
                        ) : (
                          <div className="space-y-2">
                            {hasPaidPaymentMethod && (
                              <Button
                                variant={isRecommended ? 'default' : 'outline'}
                                className="w-full gap-1"
                                onClick={handleUpgrade}
                              >
                                <CreditCard className="w-4 h-4" />
                                Upgrade Now
                              </Button>
                            )}
                            {telegramEnabled && (
                              <Button
                                variant="outline"
                                className="w-full gap-1"
                                onClick={handleTelegram}
                              >
                                <MessageCircle className="w-4 h-4" />
                                Contact on Telegram
                              </Button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                <p className="text-center text-xs text-muted-foreground mt-6">
                  <Shield className="w-3 h-3 inline-block mr-1" />
                  All plans include end-to-end encryption and privacy protection
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default UpgradePrompt;
