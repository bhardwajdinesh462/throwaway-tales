import { motion } from "framer-motion";
import { 
  Shield, 
  Globe2, 
  History, 
  Bell, 
  Star, 
  Smartphone,
  Lock,
  Zap,
  Languages,
  Palette
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Complete Privacy",
    description: "No registration required. Your identity stays completely anonymous.",
  },
  {
    icon: Globe2,
    title: "Multiple Domains",
    description: "Choose from free, premium, or custom domains for your temp emails.",
  },
  {
    icon: History,
    title: "Email History",
    description: "Access your previous temporary emails and received messages anytime.",
  },
  {
    icon: Bell,
    title: "Sound Notifications",
    description: "Get instant audio alerts when new messages arrive in your inbox.",
  },
  {
    icon: Star,
    title: "Save Favorites",
    description: "Star important emails to save them for later reference.",
  },
  {
    icon: Smartphone,
    title: "QR Code Access",
    description: "Scan QR codes to quickly access your temp email on any device.",
  },
  {
    icon: Lock,
    title: "Secure Authentication",
    description: "Optional login with Google or Facebook to sync across devices.",
  },
  {
    icon: Zap,
    title: "Instant Generation",
    description: "Get a new disposable email address in milliseconds, no waiting.",
  },
  {
    icon: Languages,
    title: "Multi-Language",
    description: "Full RTL support and available in multiple languages worldwide.",
  },
  {
    icon: Palette,
    title: "Customizable UI",
    description: "Modern, responsive interface that adapts to your preferences.",
  },
];

const FeaturesSection = () => {
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
            Everything You Need for
            <span className="gradient-text"> Secure Emails</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed to protect your privacy and make temporary email management effortless.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="glass-card p-6 group hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
