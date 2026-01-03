import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SubscriptionTier {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  max_temp_emails: number;
  email_expiry_hours: number;
  can_forward_emails: boolean;
  can_use_custom_domains: boolean;
  can_use_api: boolean;
  priority_support: boolean;
  ai_summaries_per_day: number;
  features: string[];
}

export interface UserSubscription {
  id: string;
  user_id: string;
  tier_id: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export interface UserUsage {
  temp_emails_created: number;
  ai_summaries_used: number;
  emails_received: number;
  emails_forwarded: number;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | null>(null);
  const [usage, setUsage] = useState<UserUsage>({
    temp_emails_created: 0,
    ai_summaries_used: 0,
    emails_received: 0,
    emails_forwarded: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all available tiers
  const fetchTiers = useCallback(async () => {
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .order('price_monthly', { ascending: true });
    
    if (error) {
      console.error('Error fetching tiers:', error);
      return;
    }
    
    setTiers(data.map(tier => ({
      ...tier,
      features: Array.isArray(tier.features) ? tier.features : JSON.parse(tier.features as string || '[]'),
    })));
  }, []);

  // Fetch user's subscription
  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setCurrentTier(null);
      return;
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching subscription:', error);
      return;
    }
    
    setSubscription(data as UserSubscription | null);
    
    // Set current tier
    if (data && tiers.length > 0) {
      const tier = tiers.find(t => t.id === data.tier_id);
      setCurrentTier(tier || tiers.find(t => t.name === 'free') || null);
    } else {
      setCurrentTier(tiers.find(t => t.name === 'free') || null);
    }
  }, [user, tiers]);

  // Fetch user's usage for today
  const fetchUsage = useCallback(async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching usage:', error);
      return;
    }
    
    if (data) {
      setUsage({
        temp_emails_created: data.temp_emails_created,
        ai_summaries_used: data.ai_summaries_used,
        emails_received: data.emails_received,
        emails_forwarded: data.emails_forwarded,
      });
    }
  }, [user]);

  // Update usage
  const incrementUsage = useCallback(async (field: keyof UserUsage) => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    
    // Try to upsert
    const { error } = await supabase
      .from('user_usage')
      .upsert({
        user_id: user.id,
        date: today,
        [field]: usage[field] + 1,
      }, {
        onConflict: 'user_id,date',
      });
    
    if (error) {
      console.error('Error updating usage:', error);
      return;
    }
    
    setUsage(prev => ({
      ...prev,
      [field]: prev[field] + 1,
    }));
  }, [user, usage]);

  // Subscribe to a tier (placeholder - would integrate with Stripe)
  const subscribeTier = useCallback(async (tierId: string) => {
    if (!user) {
      toast.error('Please sign in to subscribe');
      return false;
    }

    const tier = tiers.find(t => t.id === tierId);
    if (!tier) {
      toast.error('Invalid tier');
      return false;
    }

    // For free tier, just create/update subscription directly
    if (tier.name === 'free') {
      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          tier_id: tierId,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        }, {
          onConflict: 'user_id',
        });
      
      if (error) {
        toast.error('Failed to update subscription');
        return false;
      }
      
      await fetchSubscription();
      toast.success('Subscription updated!');
      return true;
    }

    // For paid tiers, show Telegram contact message - don't upgrade without payment
    toast.info(
      <div className="space-y-2">
        <p className="font-medium">Premium plans require payment setup!</p>
        <p className="text-sm">Contact us on Telegram to upgrade your account:</p>
        <a 
          href="https://t.me/digitalselling023" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-primary underline font-medium block"
        >
          t.me/digitalselling023
        </a>
      </div>,
      { duration: 15000 }
    );
    return false;
  }, [user, tiers]);

  // Cancel subscription
  const cancelSubscription = useCallback(async () => {
    if (!user || !subscription) return false;

    const { error } = await supabase
      .from('user_subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('user_id', user.id);
    
    if (error) {
      toast.error('Failed to cancel subscription');
      return false;
    }
    
    await fetchSubscription();
    toast.success('Subscription will be cancelled at the end of the billing period');
    return true;
  }, [user, subscription, fetchSubscription]);

  // Check if user can use a feature
  const canUseFeature = useCallback((feature: keyof Omit<SubscriptionTier, 'id' | 'name' | 'price_monthly' | 'price_yearly' | 'features'>) => {
    if (!currentTier) return false;
    const value = currentTier[feature];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return false;
  }, [currentTier]);

  // Check if within usage limits
  const isWithinLimit = useCallback((feature: 'max_temp_emails' | 'ai_summaries_per_day') => {
    if (!currentTier) return false;
    const limit = currentTier[feature];
    if (limit === -1) return true; // Unlimited
    
    if (feature === 'max_temp_emails') {
      return usage.temp_emails_created < limit;
    }
    if (feature === 'ai_summaries_per_day') {
      return usage.ai_summaries_used < limit;
    }
    return true;
  }, [currentTier, usage]);

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await fetchTiers();
      setIsLoading(false);
    };
    init();
  }, [fetchTiers]);

  // Fetch subscription when user or tiers change
  useEffect(() => {
    if (tiers.length > 0) {
      fetchSubscription();
      fetchUsage();
    }
  }, [user, tiers, fetchSubscription, fetchUsage]);

  // Subscribe to realtime tier changes
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
          console.log('[useSubscription] Tier realtime event:', {
            event: payload.eventType,
            old: payload.old,
            new: payload.new,
            timestamp: new Date().toISOString(),
          });
          // Refetch all tiers when any change occurs
          fetchTiers();
        }
      )
      .subscribe((status) => {
        console.log('[useSubscription] Realtime subscription status:', status);
      });

    return () => {
      channel.unsubscribe();
    };
  }, [fetchTiers]);

  return {
    tiers,
    subscription,
    currentTier,
    usage,
    isLoading,
    isPremium: currentTier?.name !== 'free',
    subscribeTier,
    cancelSubscription,
    canUseFeature,
    isWithinLimit,
    incrementUsage,
    refetch: () => {
      fetchSubscription();
      fetchUsage();
    },
  };
};

export default useSubscription;
