import { motion } from "framer-motion";
import { MousePointer, Mail, Check, Trash2 } from "lucide-react";

const steps = [
  {
    icon: MousePointer,
    step: "01",
    title: "Generate",
    description: "Click the button to instantly generate a unique disposable email address.",
  },
  {
    icon: Mail,
    step: "02",
    title: "Use Anywhere",
    description: "Copy your temp email and use it for sign-ups, newsletters, or testing.",
  },
  {
    icon: Check,
    step: "03",
    title: "Receive Emails",
    description: "All incoming messages appear in your inbox in real-time.",
  },
  {
    icon: Trash2,
    step: "04",
    title: "Auto-Delete",
    description: "Emails are automatically deleted after expiration to maintain privacy.",
  },
];

const HowItWorks = () => {
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
            Simple as
            <span className="gradient-text"> 1-2-3-4</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Getting started with TrashMails takes just seconds. No sign-up required.
          </p>
        </motion.div>

        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent -translate-y-1/2" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((item, index) => (
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
                    {item.step}
                  </div>

                  {/* Icon */}
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 mt-4">
                    <item.icon className="w-8 h-8 text-primary" />
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
