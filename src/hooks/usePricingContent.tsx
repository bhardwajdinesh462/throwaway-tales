import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PricingContent {
  headline: string;
  subheadline: string;
  ctaText: string;
  featuredPlan: string;
}

const defaultPricingContent: PricingContent = {
  headline: "Choose the Perfect Plan for You",
  subheadline: "Start free and upgrade anytime. All plans include core features to protect your privacy.",
  ctaText: "Get Started",
  featuredPlan: "pro",
};

export function usePricingContent() {
  const [content, setContent] = useState<PricingContent>(defaultPricingContent);
  const [isLoading, setIsLoading] = useState(true);

  const fetchContent = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'pricing_content')
        .maybeSingle();

      if (!error && data?.value) {
        setContent({ ...defaultPricingContent, ...(data.value as Partial<PricingContent>) });
      }
    } catch (err) {
      console.error('Error fetching pricing content:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('pricing_content_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.pricing_content',
        },
        (payload) => {
          console.log('Pricing content changed:', payload);
          if (payload.new && (payload.new as any).value) {
            setContent({ ...defaultPricingContent, ...((payload.new as any).value as Partial<PricingContent>) });
          }
        }
      )
      .subscribe();

    // Refetch on window focus as a fallback
    const handleFocus = () => {
      fetchContent();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchContent]);

  return { content, isLoading, refetch: fetchContent };
}
