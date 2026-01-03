import { ReactNode } from "react";
import { usePremiumFeatures, SubscriptionTier } from "@/hooks/usePremiumFeatures";
import { Lock, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type FeatureKey = 
  | 'canForwardEmails' 
  | 'canUseCustomDomains' 
  | 'canUseApi' 
  | 'prioritySupport';

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  requiredTier?: SubscriptionTier;
  showUpgradePrompt?: boolean;
  fallback?: ReactNode;
}

const FEATURE_NAMES: Record<FeatureKey, string> = {
  canForwardEmails: "Email Forwarding",
  canUseCustomDomains: "Custom Domains",
  canUseApi: "API Access",
  prioritySupport: "Priority Support",
};

const FEATURE_REQUIRED_TIER: Record<FeatureKey, SubscriptionTier> = {
  canForwardEmails: "pro",
  canUseCustomDomains: "business",
  canUseApi: "pro",
  prioritySupport: "pro",
};

const FeatureGate = ({ 
  feature, 
  children, 
  requiredTier,
  showUpgradePrompt = true,
  fallback 
}: FeatureGateProps) => {
  const { limits, tier, isLoading } = usePremiumFeatures();
  const navigate = useNavigate();
  
  // While loading, show nothing or a skeleton
  if (isLoading) {
    return null;
  }
  
  // Check if the feature is enabled based on limits
  const hasAccess = limits[feature] === true;
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  // If custom fallback is provided, use it
  if (fallback) {
    return <>{fallback}</>;
  }
  
  // If upgrade prompt is disabled, return nothing
  if (!showUpgradePrompt) {
    return null;
  }
  
  // Show upgrade prompt
  const featureName = FEATURE_NAMES[feature];
  const tierRequired = requiredTier || FEATURE_REQUIRED_TIER[feature];
  
  return (
    <div className="glass-card p-8 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
        <Lock className="w-8 h-8 text-primary" />
      </div>
      
      <h3 className="text-xl font-semibold text-foreground mb-2">
        {featureName} is a Premium Feature
      </h3>
      
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Upgrade to {tierRequired === 'business' ? 'Business' : 'Pro'} plan to unlock 
        {' '}{featureName.toLowerCase()} and many more powerful features.
      </p>
      
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-sm">
          <span className="text-muted-foreground">Current:</span>
          <span className="font-medium text-foreground capitalize">{tier}</span>
        </div>
        <Sparkles className="w-4 h-4 text-primary" />
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 text-sm">
          <Crown className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium text-primary capitalize">{tierRequired}</span>
        </div>
      </div>
      
      <Button 
        variant="neon"
        onClick={() => window.open('https://t.me/digitalselling023', '_blank')}
        className="min-w-[160px]"
      >
        <Crown className="w-4 h-4 mr-2" />
        Contact to Upgrade
      </Button>
    </div>
  );
};

export default FeatureGate;
