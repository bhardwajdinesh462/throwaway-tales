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
import { motion } from "framer-motion";

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SEOHead />
      <JsonLd />
      <Header />
      
      {/* Header Banner */}
      <div className="container mx-auto px-4 pt-20">
        <BannerDisplay position="header" />
      </div>
      
      <main>
        <HeroSection />
        
        {/* Inbox Section with improved layout */}
        <section className="py-16 relative">
          {/* Background accent */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          </div>
          
          <div className="container mx-auto px-4">
            {/* Section Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <span className="text-primary text-sm font-medium tracking-wider uppercase">Your Messages</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-3 text-foreground">
                Real-time <span className="gradient-text">Inbox</span>
              </h2>
              <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
                Receive and manage your temporary emails instantly. All messages auto-delete for your privacy.
              </p>
            </motion.div>
            
            {/* Content Banner - Top */}
            <BannerDisplay position="content" className="mb-8" />
            
            <div className="flex flex-col xl:flex-row gap-8 items-start">
              {/* Inbox - Main Content */}
              <motion.div 
                className="flex-1 w-full"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <Inbox />
              </motion.div>
              
              {/* Sidebar Banner */}
              <motion.div 
                className="xl:w-80 w-full space-y-6"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <BannerDisplay position="sidebar" />
                
                {/* Quick Tips Card */}
                <div className="glass-card p-6">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    Quick Tips
                  </h3>
                  <ul className="space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Click "Test" to simulate receiving an email</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Create custom usernames for personalized emails</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Sign in to save and extend email lifetime</span>
                    </li>
                  </ul>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
        
        <FeaturesSection />
        <HowItWorks />
        
        {/* Content Banner - Between sections */}
        <div className="container mx-auto px-4 py-8">
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
    </div>
  );
};

export default Index;
