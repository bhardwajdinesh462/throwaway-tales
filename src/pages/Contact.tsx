import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Mail, MessageSquare, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const Contact = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Message sent! We'll get back to you soon.");
  };

  const contactInfo = [
    {
      icon: Mail,
      title: "Email Us",
      details: "contact@nullsto.edu.pl",
      subtitle: "We reply within 24 hours",
    },
    {
      icon: MessageSquare,
      title: "Live Chat",
      details: "Available 24/7",
      subtitle: "Talk to our support team",
    },
    {
      icon: MapPin,
      title: "Location",
      details: "San Francisco, CA",
      subtitle: "United States",
    },
    {
      icon: Clock,
      title: "Business Hours",
      details: "Mon - Fri: 9AM - 6PM",
      subtitle: "PST Timezone",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
            <span className="text-primary text-sm font-medium tracking-wider uppercase">Contact</span>
            <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-4 text-foreground">
              Get In
              <span className="gradient-text"> Touch</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Have questions or feedback? We'd love to hear from you. Send us a message and we'll respond as soon as
              possible.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Contact Form */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <div className="glass-card p-8">
                <h2 className="text-2xl font-semibold mb-6 text-foreground">Send us a message</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">First Name</label>
                      <Input placeholder="John" className="bg-secondary/50 border-border" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Last Name</label>
                      <Input placeholder="Doe" className="bg-secondary/50 border-border" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Email</label>
                    <Input type="email" placeholder="john@example.com" className="bg-secondary/50 border-border" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Subject</label>
                    <Input placeholder="How can we help?" className="bg-secondary/50 border-border" />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Message</label>
                    <Textarea
                      placeholder="Tell us more about your inquiry..."
                      className="bg-secondary/50 border-border min-h-[150px]"
                    />
                  </div>
                  <Button variant="neon" size="lg" className="w-full">
                    Send Message
                  </Button>
                </form>
              </div>
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {contactInfo.map((item, index) => (
                  <div key={index} className="glass-card p-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                    <p className="text-foreground/80">{item.details}</p>
                    <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                  </div>
                ))}
              </div>

              <div className="glass-card p-6">
                <h3 className="font-semibold text-foreground mb-4">Frequently Asked Questions</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Before contacting us, you might find your answer in our comprehensive FAQ section.
                </p>
                <Button variant="glass" asChild>
                  <a href="/#faq">View FAQ</a>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;
