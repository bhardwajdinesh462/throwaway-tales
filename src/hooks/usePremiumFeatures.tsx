import { useState, useEffect, useCallback, useRef } from "react";
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

// Default limits for fallback
const DEFAULT_TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
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
  const [limits, setLimits] = useState<TierLimits>(DEFAULT_TIER_LIMITS.free);
  const [isLoading, setIsLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  
  // Use refs for values that shouldn't trigger re-renders/effect loops
  const lastFetchTimeRef = useRef<number>(0);
  const lastUserIdRef = useRef<string | null>(null);

  const fetchSubscription = useCallback(async (forceRefresh = false) => {
    // Prevent rapid refetching unless forced - reduced debounce to 500ms for responsiveness
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTimeRef.current < 500) {
      console.log('[PremiumFeatures] Skipping fetch - too soon');
      return;
    }
    lastFetchTimeRef.current = now;

    if (!user) {
      console.log('[PremiumFeatures] No user, setting free tier');
      setTier('free');
      setLimits(DEFAULT_TIER_LIMITS.free);
      setExpiresAt(null);
      setSubscriptionId(null);
      setIsLoading(false);
      lastUserIdRef.current = null;
      return;
    }

    console.log('[PremiumFeatures] Fetching subscription for user:', user.id);

    try {
      // Fetch user subscription from database
      const { data: subscriptionData, error: subError } = await supabase
        .from('user_subscriptions')
        .select(`
          id,
          status,
          current_period_end,
          tier_id,
          subscription_tiers (
            id,
            name,
            max_temp_emails,
            email_expiry_hours,
            can_forward_emails,
            can_use_custom_domains,
            can_use_api,
            priority_support,
            ai_summaries_per_day,
            price_monthly
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (subError) {
        console.error('[PremiumFeatures] Error fetching subscription:', subError);
        // Fallback to free tier
        setTier('free');
        setLimits(DEFAULT_TIER_LIMITS.free);
        setIsLoading(false);
        return;
      }

      console.log('[PremiumFeatures] Subscription data:', subscriptionData);

      if (subscriptionData && subscriptionData.subscription_tiers) {
        const tierData = subscriptionData.subscription_tiers as any;
        const rawTierName = tierData.name || 'free';
        const tierName = rawTierName.toLowerCase() as SubscriptionTier;
        
        console.log('[PremiumFeatures] Tier name from DB:', rawTierName, '-> normalized:', tierName);
        
        // Use database values for limits with proper fallbacks
        const validTierKey = ['free', 'pro', 'business'].includes(tierName) ? tierName : 'free';
        const dbLimits: TierLimits = {
          maxTempEmails: tierData.max_temp_emails ?? DEFAULT_TIER_LIMITS[validTierKey].maxTempEmails,
          emailExpiryHours: tierData.email_expiry_hours ?? DEFAULT_TIER_LIMITS[validTierKey].emailExpiryHours,
          canForwardEmails: tierData.can_forward_emails ?? DEFAULT_TIER_LIMITS[validTierKey].canForwardEmails,
          canUseCustomDomains: tierData.can_use_custom_domains ?? DEFAULT_TIER_LIMITS[validTierKey].canUseCustomDomains,
          canUseApi: tierData.can_use_api ?? DEFAULT_TIER_LIMITS[validTierKey].canUseApi,
          prioritySupport: tierData.priority_support ?? DEFAULT_TIER_LIMITS[validTierKey].prioritySupport,
          aiSummariesPerDay: tierData.ai_summaries_per_day ?? DEFAULT_TIER_LIMITS[validTierKey].aiSummariesPerDay,
        };

        console.log('[PremiumFeatures] Setting tier:', tierName, 'with limits:', dbLimits);

        setTier(tierName);
        setLimits(dbLimits);
        setExpiresAt(new Date(subscriptionData.current_period_end));
        setSubscriptionId(subscriptionData.id);
      } else {
        // No active subscription, use free tier
        console.log('[PremiumFeatures] No active subscription found, using free tier');
        setTier('free');
        setLimits(DEFAULT_TIER_LIMITS.free);
        setExpiresAt(null);
        setSubscriptionId(null);
      }
      
      lastUserIdRef.current = user.id;
    } catch (err) {
      console.error('[PremiumFeatures] Error checking subscription:', err);
      setTier('free');
      setLimits(DEFAULT_TIER_LIMITS.free);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial fetch and refetch when user changes (critical for auth fix!)
  useEffect(() => {
    // If user changed, force refresh immediately
    if (user?.id !== lastUserIdRef.current) {
      console.log('[PremiumFeatures] User changed, forcing refresh:', lastUserIdRef.current, '->', user?.id);
      lastFetchTimeRef.current = 0; // Reset debounce
      fetchSubscription(true);
    } else {
      fetchSubscription();
    }
  }, [user?.id, fetchSubscription]);

  // Real-time subscription to user_subscriptions changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user_subscription_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[PremiumFeatures] Subscription changed via realtime:', payload);
          // Force refetch immediately when subscription changes
          lastFetchTimeRef.current = 0; // Reset debounce to allow immediate fetch
          fetchSubscription(true);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, fetchSubscription]);

  // Real-time subscription to subscription_tiers changes (for admin edits)
  useEffect(() => {
    const channel = supabase
      .channel('subscription_tiers_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscription_tiers',
        },
        (payload) => {
          console.log('[PremiumFeatures] Subscription tiers changed via realtime:', payload);
          // Force refetch immediately when tier definitions change
          lastFetchTimeRef.current = 0;
          fetchSubscription(true);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchSubscription]);

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

  const refreshSubscription = useCallback(() => {
    console.log('[PremiumFeatures] Manual refresh triggered');
    fetchSubscription(true);
  }, [fetchSubscription]);

  return {
    tier,
    limits,
    price,
    isLoading,
    expiresAt,
    subscriptionId,
    isPremium: tier !== 'free',
    canUseFeature,
    isWithinLimit,
    getTierBadgeColor,
    refreshSubscription,
    allTiers: ['free', 'pro', 'business'] as SubscriptionTier[],
    tierPrices: TIER_PRICES,
    tierLimits: DEFAULT_TIER_LIMITS,
  };
};

export default usePremiumFeatures;
