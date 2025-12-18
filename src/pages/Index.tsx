import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import Inbox from "@/components/Inbox";
import FeaturesSection from "@/components/FeaturesSection";
import HowItWorks from "@/components/HowItWorks";
import FAQSection from "@/components/FAQSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead />
      <Header />
      <main>
        <HeroSection />
        <div className="container mx-auto px-4 pb-12">
          <Inbox />
        </div>
        <FeaturesSection />
        <HowItWorks />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
