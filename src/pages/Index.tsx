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
import LiveStatsWidget from "@/components/LiveStatsWidget";
import FriendlyWebsitesWidget from "@/components/FriendlyWebsitesWidget";
import { motion } from "framer-motion";
import { useHomepageContent } from "@/hooks/useHomepageContent";

const Index = () => {
  const { quickTips, isSectionEnabled } = useHomepageContent();

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

            {/* Inbox + Quick Tips - Side by side on large, stacked on small */}
            <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 xl:items-stretch">
              {/* Inbox - Main Content (Left on large screens) */}
              <motion.div
                className="flex-1 w-full order-1 flex flex-col"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="h-full flex flex-col">
                  <Inbox />
                </div>
              </motion.div>

              {/* Quick Tips Card - Right on large screens, below inbox on small */}
              {isSectionEnabled("quick_tips") && (
                <motion.div 
                  className="w-full xl:w-80 order-2 relative overflow-hidden rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4 sm:p-6 shadow-lg shadow-primary/5 flex flex-col"
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  {/* Animated gradient border */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary via-accent to-primary opacity-20 blur-sm animate-pulse" />
                  
                  {/* Sparkle decorations */}
                  <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-ping opacity-75" />
                  <div className="absolute bottom-4 left-4 w-1.5 h-1.5 bg-accent rounded-full animate-ping opacity-50" style={{ animationDelay: '0.5s' }} />
                  
                  <div className="relative z-10">
                    <h3 className="font-bold text-foreground mb-4 flex items-center gap-2 text-base sm:text-lg">
                      <motion.span 
                        className="w-3 h-3 rounded-full bg-gradient-to-r from-primary to-accent"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        {quickTips.title}
                      </span>
                    </h3>
                    <ul className="space-y-3 sm:space-y-4 text-sm">
                      {quickTips.tips.map((tip, index) => (
                        <motion.li 
                          key={index}
                          className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50 hover:border-primary/30 transition-colors"
                          whileHover={{ x: 4 }}
                        >
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                            {index + 1}
                          </span>
                          <span className="text-foreground text-xs sm:text-sm">{tip}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>

                  {/* Sidebar Banner below Quick Tips */}
                  <div className="mt-6">
                    <BannerDisplay position="sidebar" />
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </section>

        {/* Live Stats Section - After Inbox */}
        <section className="py-4 border-y border-border/30">
          <div className="container mx-auto px-4">
            <LiveStatsWidget />
          </div>
        </section>

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
    </div>
  );
};

export default Index;
