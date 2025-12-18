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

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead />
      <JsonLd />
      <Header />
      
      {/* Header Banner */}
      <div className="container mx-auto px-4 pt-20">
        <BannerDisplay position="header" />
      </div>
      
      <main>
        <HeroSection />
        <div className="container mx-auto px-4 pb-12">
          {/* Content Banner - Top */}
          <BannerDisplay position="content" className="mb-8" />
          
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <Inbox />
            </div>
            {/* Sidebar Banner */}
            <div className="lg:w-72 space-y-4">
              <BannerDisplay position="sidebar" />
            </div>
          </div>
        </div>
        <FeaturesSection />
        <HowItWorks />
        
        {/* Content Banner - Between sections */}
        <div className="container mx-auto px-4">
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
