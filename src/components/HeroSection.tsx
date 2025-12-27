import { Sparkles } from "lucide-react";
import EmailGenerator from "./EmailGenerator";
import { useHomepageContent } from "@/hooks/useHomepageContent";
import { DynamicIcon } from "@/components/admin/LucideIconPicker";

const HeroSection = () => {
  const { hero, isSectionEnabled } = useHomepageContent();

  if (!isSectionEnabled("hero")) return null;

  return (
    <section className="relative min-h-[70vh] pt-16 pb-8 overflow-hidden flex items-center">
      {/* Optimized Background Effects - CSS only, no JS animations */}
      <div className="absolute inset-0 -z-10">
        {/* Static Gradient Orbs with CSS animation */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[150px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[150px] animate-pulse-slow [animation-delay:2s]" />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black,transparent)]" />
      </div>

      <div className="container mx-auto px-4">
        {/* Hero Text - CSS animations instead of framer-motion for initial load */}
        <div className="text-center max-w-4xl mx-auto mb-8 animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 mb-4 backdrop-blur-sm animate-fade-in [animation-delay:100ms]">
            <span className="flex items-center justify-center w-5 h-5 animate-spin-slow">
              <Sparkles className="w-4 h-4 text-primary" />
            </span>
            <span className="text-sm font-medium bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {hero.badge}
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-[1.1] tracking-tight animate-fade-in [animation-delay:150ms]">
            <span className="text-foreground">{hero.headline.split(' with ')[0]}</span>
            {hero.headline.includes(' with ') && (
              <>
                <br />
                <span className="text-foreground">with </span>
                <span className="relative inline-block">
                  <span className="gradient-text">{hero.headline.split(' with ')[1] || 'Disposable Emails'}</span>
                  <span className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent rounded-full animate-scale-x [animation-delay:400ms]" />
                </span>
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-fade-in [animation-delay:250ms]">
            {hero.subtitle}
          </p>
        </div>

        {/* Quick Stats - simplified animations */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-8 animate-fade-in [animation-delay:350ms]">
          {hero.features.map((feature, index) => (
            <div 
              key={index} 
              className="flex items-center gap-3 group hover:scale-105 transition-transform duration-200"
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:from-primary/30 group-hover:to-accent/30 transition-all duration-300">
                  <DynamicIcon name={feature.icon} className="w-5 h-5 text-primary" />
                </div>
              </div>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {feature.label}
              </span>
            </div>
          ))}
        </div>

        {/* Email Generator */}
        <div className="animate-fade-in [animation-delay:450ms]">
          <EmailGenerator />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
