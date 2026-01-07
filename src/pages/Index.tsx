import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import Inbox from "@/components/Inbox";
import FeaturesSection from "@/components/FeaturesSection";
import HowItWorks from "@/components/HowItWorks";
import FAQSection from "@/components/FAQSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import JsonLd from "@/components/JsonLd";
import BannerDisplay from "@/components/BannerDisplay";
import UnifiedStatsWidget from "@/components/UnifiedStatsWidget";
import FriendlyWebsitesWidget from "@/components/FriendlyWebsitesWidget";
import BackendHealthBanner from "@/components/BackendHealthBanner";
import ScrollToTop from "@/components/ScrollToTop";
import { motion } from "framer-motion";
import { useHomepageContent } from "@/hooks/useHomepageContent";

const Index = () => {
  const { isSectionEnabled } = useHomepageContent();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEOHead />
      <JsonLd />
      <Header />
      
      {/* Spacer for fixed header + announcement bar */}
      <div className="h-[104px] md:h-[104px]" />
      
      {/* Header Banner */}
      <div className="container mx-auto px-4">
        <BannerDisplay position="header" />
      </div>

      {/* Backend Health Banner - shows only when issues detected */}
      <BackendHealthBanner />
      
      <main>
        <HeroSection />
        
        {/* Real-time Inbox Header - Below Email Generator */}
        <section className="py-4 sm:py-6 relative">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          </div>

          <div className="container mx-auto px-4">
            {/* Section Header - Centered */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-4"
            >
              <span className="text-primary text-xs sm:text-sm font-medium tracking-wider uppercase">Your Messages</span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 sm:mt-3 text-foreground">
                Real-time <span className="gradient-text">Inbox</span>
              </h2>
              <p className="text-muted-foreground mt-2 sm:mt-3 max-w-xl mx-auto text-sm sm:text-base px-4">
                Receive and manage your temporary emails instantly. All messages auto-delete for your privacy.
              </p>
            </motion.div>

            {/* Content Banner - Top */}
            <BannerDisplay position="content" className="mb-4" />

            {/* Inbox Full Width */}
            <motion.div
              className="w-full"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <Inbox />
            </motion.div>
          </div>
        </section>

        {/* Unified Stats + Quick Tips Widget */}
        {isSectionEnabled('stats_widget') && (
          <section className="py-4 border-y border-border/30">
            <div className="container mx-auto px-4">
              <UnifiedStatsWidget />
            </div>
          </section>
        )}

        <FeaturesSection />
        <HowItWorks />

        {/* Content Banner - Between sections */}
        <div className="container mx-auto px-4 py-4">
          <BannerDisplay position="content" />
        </div>

        <FAQSection />
        <CTASection />
      </main>

      {/* Footer Banner */}
      <div className="container mx-auto px-4 pb-4">
        <BannerDisplay position="footer" />
      </div>
      
      <Footer />
      
      {/* Friendly Websites Sidebar Widget */}
      <FriendlyWebsitesWidget />
      
      {/* Scroll to Top Button */}
      <ScrollToTop />
    </div>
  );
};

export default Index;
