import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap } from "lucide-react";
import { useHomepageContent } from "@/hooks/useHomepageContent";

const CTASection = () => {
  const { cta, isSectionEnabled } = useHomepageContent();

  if (!isSectionEnabled("cta")) return null;

  return (
    <section className="py-12 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px]" />
      </div>

      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-8 md:p-12 lg:p-16 text-center max-w-4xl mx-auto"
        >
          <div className="flex justify-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-accent" />
            </div>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground">
            {cta.headline.includes(' Privacy') ? (
              <>
                {cta.headline.split(' Privacy')[0]}
                <span className="gradient-text"> Privacy{cta.headline.split(' Privacy')[1] || '?'}</span>
              </>
            ) : (
              cta.headline
            )}
          </h2>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            {cta.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={cta.primaryButton.link}>
              <Button variant="hero" size="xl">
                {cta.primaryButton.text}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link to={cta.secondaryButton.link}>
              <Button variant="glass" size="xl">
                {cta.secondaryButton.text}
              </Button>
            </Link>
          </div>

          <p className="text-sm text-muted-foreground mt-6">
            {cta.footerText}
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
