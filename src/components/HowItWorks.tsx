import { motion } from "framer-motion";
import { useHomepageContent } from "@/hooks/useHomepageContent";
import { DynamicIcon } from "@/components/admin/LucideIconPicker";

const HowItWorks = () => {
  const { howItWorks, isSectionEnabled } = useHomepageContent();

  if (!isSectionEnabled("how_it_works")) return null;

  return (
    <section id="how-it-works" className="py-12 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <span className="text-primary text-sm font-medium tracking-wider uppercase">How It Works</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-4 mb-4 text-foreground">
            {howItWorks.title}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {howItWorks.subtitle}
          </p>
        </motion.div>

        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent -translate-y-1/2" />

          <div className={`grid grid-cols-1 md:grid-cols-2 ${howItWorks.steps.length <= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-8`}>
            {howItWorks.steps.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative"
              >
                <div className="glass-card p-6 text-center h-full">
                  {/* Step Number */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                    {String(item.step).padStart(2, '0')}
                  </div>

                  {/* Icon */}
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 mt-4">
                    <DynamicIcon name={item.icon} className="w-8 h-8 text-primary" />
                  </div>

                  <h3 className="text-xl font-semibold mb-2 text-foreground">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
