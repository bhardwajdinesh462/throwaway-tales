import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionTier = 'free' | 'pro' | 'business';

interface TierLimits {
  maxTempEmails: number;
  emailExpiryHours: number;
  canForwardEmails: boolean;
  canUseCustomDomains: boolean;
  canUseApi: boolean;
  prioritySupport: boolean;
  aiSummariesPerDay: number;
}

const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxTempEmails: 3,
    emailExpiryHours: 1,
    canForwardEmails: false,
    canUseCustomDomains: false,
    canUseApi: false,
    prioritySupport: false,
    aiSummariesPerDay: 5,
  },
  pro: {
    maxTempEmails: 50,
    emailExpiryHours: 24,
    canForwardEmails: true,
    canUseCustomDomains: false,
    canUseApi: true,
    prioritySupport: true,
    aiSummariesPerDay: 100,
  },
  business: {
    maxTempEmails: -1, // Unlimited
    emailExpiryHours: 168, // 7 days
    canForwardEmails: true,
    canUseCustomDomains: true,
    canUseApi: true,
    prioritySupport: true,
    aiSummariesPerDay: -1, // Unlimited
  },
};

const TIER_PRICES: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 5,
  business: 15,
};

export const usePremiumFeatures = () => {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) {
        setTier('free');
        setIsLoading(false);
        return;
      }

      // For now, we'll use localStorage until the subscriptions table is created
      // This is a placeholder that will work with the database once migration is done
      try {
        const storedTier = localStorage.getItem(`subscription_${user.id}`);
        if (storedTier) {
          const parsed = JSON.parse(storedTier);
          if (new Date(parsed.expiresAt) > new Date()) {
            setTier(parsed.tier);
            setExpiresAt(new Date(parsed.expiresAt));
          }
        }
      } catch (err) {
        console.error('Error checking subscription:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscription();
  }, [user]);

  const limits = TIER_LIMITS[tier];
  const price = TIER_PRICES[tier];

  const canUseFeature = useCallback((feature: keyof TierLimits): boolean => {
    const value = limits[feature];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return false;
  }, [limits]);

  const isWithinLimit = useCallback((feature: 'maxTempEmails' | 'aiSummariesPerDay', currentCount: number): boolean => {
    const limit = limits[feature];
    if (limit === -1) return true; // Unlimited
    return currentCount < limit;
  }, [limits]);

  const getTierBadgeColor = useCallback((tierName: SubscriptionTier) => {
    switch (tierName) {
      case 'business': return 'bg-gradient-to-r from-amber-500 to-orange-500';
      case 'pro': return 'bg-gradient-to-r from-purple-500 to-pink-500';
      default: return 'bg-secondary';
    }
  }, []);

  const upgradeTier = useCallback((newTier: SubscriptionTier) => {
    if (!user) return;
    
    // Placeholder - in production this would go through Stripe
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1);
    
    localStorage.setItem(`subscription_${user.id}`, JSON.stringify({
      tier: newTier,
      expiresAt: expiryDate.toISOString(),
    }));
    
    setTier(newTier);
    setExpiresAt(expiryDate);
  }, [user]);

  return {
    tier,
    limits,
    price,
    isLoading,
    expiresAt,
    isPremium: tier !== 'free',
    canUseFeature,
    isWithinLimit,
    getTierBadgeColor,
    upgradeTier,
    allTiers: ['free', 'pro', 'business'] as SubscriptionTier[],
    tierPrices: TIER_PRICES,
    tierLimits: TIER_LIMITS,
  };
};

export default usePremiumFeatures;
