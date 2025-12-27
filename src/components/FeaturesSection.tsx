import { motion } from "framer-motion";
import { useHomepageContent } from "@/hooks/useHomepageContent";
import { DynamicIcon } from "@/components/admin/LucideIconPicker";

const FeaturesSection = () => {
  const { features, isSectionEnabled } = useHomepageContent();

  if (!isSectionEnabled("features")) return null;

  return (
    <section id="features" className="py-12 relative">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-0 w-72 h-72 bg-accent/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <span className="text-primary text-sm font-medium tracking-wider uppercase">Features</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-4 mb-4 text-foreground">
            {features.title.includes(' for ') ? (
              <>
                {features.title.split(' for ')[0]} for
                <span className="gradient-text"> {features.title.split(' for ')[1]}</span>
              </>
            ) : (
              features.title
            )}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {features.subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-5">
          {features.items.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="glass-card p-5 group hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <DynamicIcon name={feature.icon} className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
