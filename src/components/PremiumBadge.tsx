import { Crown, Sparkles, Gem } from "lucide-react";
import { motion } from "framer-motion";
import { SubscriptionTier } from "@/hooks/usePremiumFeatures";

interface PremiumBadgeProps {
  tier: SubscriptionTier;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const PremiumBadge = ({ tier, size = 'md', showLabel = true }: PremiumBadgeProps) => {
  if (tier === 'free') return null;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5',
    lg: 'text-base px-4 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const config = {
    pro: {
      icon: Sparkles,
      label: 'Pro',
      gradient: 'from-purple-500 to-pink-500',
      glow: 'shadow-purple-500/30',
    },
    business: {
      icon: Crown,
      label: 'Business',
      gradient: 'from-amber-500 to-orange-500',
      glow: 'shadow-amber-500/30',
    },
  };

  const { icon: Icon, label, gradient, glow } = config[tier as 'pro' | 'business'];

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center ${sizeClasses[size]} rounded-full bg-gradient-to-r ${gradient} text-white font-medium shadow-lg ${glow}`}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{label}</span>}
    </motion.div>
  );
};

export default PremiumBadge;
