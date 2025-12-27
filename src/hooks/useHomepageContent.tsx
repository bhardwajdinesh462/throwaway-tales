import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

// Type definitions for homepage content
export interface HeroFeature {
  icon: string;
  label: string;
}

export interface HeroContent {
  badge: string;
  headline: string;
  subtitle: string;
  features: HeroFeature[];
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface FeaturesContent {
  title: string;
  subtitle: string;
  items: FeatureItem[];
}

export interface HowItWorksStep {
  icon: string;
  step: number;
  title: string;
  description: string;
}

export interface HowItWorksContent {
  title: string;
  subtitle: string;
  steps: HowItWorksStep[];
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQContent {
  title: string;
  subtitle: string;
  items: FAQItem[];
}

export interface CTAButton {
  text: string;
  link: string;
}

export interface CTAContent {
  headline: string;
  subtitle: string;
  primaryButton: CTAButton;
  secondaryButton: CTAButton;
  footerText: string;
}

export interface QuickTipsContent {
  title: string;
  tips: string[];
}

export interface HomepageSection {
  id: string;
  section_key: string;
  content: any;
  is_enabled: boolean;
  display_order: number;
}

// Default content fallbacks
const defaultHero: HeroContent = {
  badge: "Trusted by 1M+ users worldwide",
  headline: "Protect Your Privacy with Disposable Email",
  subtitle: "Generate instant, secure temporary email addresses. No registration required.",
  features: [
    { icon: "Zap", label: "Instant Generation" },
    { icon: "Shield", label: "100% Anonymous" },
    { icon: "Clock", label: "Auto-Expiring" }
  ]
};

const defaultFeatures: FeaturesContent = {
  title: "Everything You Need for Email Privacy",
  subtitle: "Our comprehensive suite of features keeps your real email address safe.",
  items: [
    { icon: "Mail", title: "Instant Temp Email", description: "Generate a disposable email address instantly." },
    { icon: "Shield", title: "Complete Privacy", description: "Your identity stays protected." },
    { icon: "Clock", title: "Auto-Expiring", description: "Emails automatically expire after your chosen duration." }
  ]
};

const defaultHowItWorks: HowItWorksContent = {
  title: "How It Works",
  subtitle: "Get started in seconds",
  steps: [
    { icon: "Mail", step: 1, title: "Generate Email", description: "Click generate to create a temporary email." },
    { icon: "Copy", step: 2, title: "Use Anywhere", description: "Copy and use for signups or verifications." },
    { icon: "Inbox", step: 3, title: "Receive Emails", description: "All emails appear instantly in your inbox." }
  ]
};

const defaultFAQ: FAQContent = {
  title: "Frequently Asked Questions",
  subtitle: "Everything you need to know",
  items: [
    { question: "What is a temporary email?", answer: "A disposable email address you can use for a short period." },
    { question: "How long does it last?", answer: "By default 1 hour, premium users can extend this." }
  ]
};

const defaultCTA: CTAContent = {
  headline: "Ready to Protect Your Privacy?",
  subtitle: "Join millions of users who trust our service.",
  primaryButton: { text: "Generate Free Email", link: "#inbox" },
  secondaryButton: { text: "View Pricing", link: "/pricing" },
  footerText: "No credit card required."
};

const defaultQuickTips: QuickTipsContent = {
  title: "Quick Tips",
  tips: [
    "Use temp emails for online signups to avoid spam",
    "Premium users can extend email lifetime",
    "Enable notifications to never miss an email"
  ]
};

export function useHomepageContent() {
  const queryClient = useQueryClient();

  const { data: sections, isLoading } = useQuery({
    queryKey: ["homepage-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_sections")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as HomepageSection[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel("homepage-sections-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "homepage_sections",
        },
        () => {
          // Invalidate and refetch on any change
          queryClient.invalidateQueries({ queryKey: ["homepage-sections"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Helper to get section by key
  const getSection = (key: string): HomepageSection | undefined => {
    return sections?.find((s) => s.section_key === key);
  };

  // Get typed content for each section
  const hero: HeroContent = getSection("hero")?.content || defaultHero;
  const features: FeaturesContent = getSection("features")?.content || defaultFeatures;
  const howItWorks: HowItWorksContent = getSection("how_it_works")?.content || defaultHowItWorks;
  const faq: FAQContent = getSection("faq")?.content || defaultFAQ;
  const cta: CTAContent = getSection("cta")?.content || defaultCTA;
  const quickTips: QuickTipsContent = getSection("quick_tips")?.content || defaultQuickTips;

  // Check if sections are enabled
  const isSectionEnabled = (key: string): boolean => {
    const section = getSection(key);
    return section?.is_enabled ?? true;
  };

  return {
    isLoading,
    sections,
    hero,
    features,
    howItWorks,
    faq,
    cta,
    quickTips,
    isSectionEnabled,
    getSection,
  };
}
