import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Crown,
  Zap,
  Mail,
  Shield,
  Clock,
  Webhook,
  FileText,
  Key,
  Users,
  Search,
  Download,
  Bell,
  Sparkles,
  Check,
  ArrowRight,
  Play,
  Pause,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useConfetti } from "@/hooks/useConfetti";

interface Feature {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  tier: "free" | "pro" | "business";
  demo?: React.ReactNode;
}

const PremiumFeatures = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTier, isPremium } = useSubscription();
  const { fireConfetti } = useConfetti();
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<Record<string, boolean>>({});

  const features: Feature[] = [
    // Free Features
    {
      id: "aliases",
      name: "Email Aliases",
      description: "Create up to 3 aliases from one temp email to organize your inbox",
      icon: Users,
      tier: "free",
    },
    {
      id: "search",
      name: "Full-Text Search",
      description: "Search across all your emails with powerful filters",
      icon: Search,
      tier: "free",
    },
    {
      id: "export",
      name: "Email Export",
      description: "Download emails as PDF, EML, or plain text",
      icon: Download,
      tier: "free",
    },
    {
      id: "notifications",
      name: "Browser Notifications",
      description: "Get real-time alerts when new emails arrive",
      icon: Bell,
      tier: "free",
    },
    // Pro Features
    {
      id: "custom-aliases",
      name: "Custom Email Aliases",
      description: "Choose your own prefix like john.smith@nullsto.email",
      icon: Mail,
      tier: "pro",
    },
    {
      id: "scheduling",
      name: "Email Scheduling",
      description: "Auto-delete emails after a specific time (up to 7 days)",
      icon: Clock,
      tier: "pro",
    },
    {
      id: "webhooks",
      name: "Webhook Notifications",
      description: "Send email alerts to Discord, Slack, or any custom webhook",
      icon: Webhook,
      tier: "pro",
    },
    {
      id: "templates",
      name: "Email Templates",
      description: "Create reusable reply templates for quick responses",
      icon: FileText,
      tier: "pro",
    },
    {
      id: "api",
      name: "API Access",
      description: "Programmatic email management with full REST API",
      icon: Key,
      tier: "pro",
    },
    // Business Features
    {
      id: "priority",
      name: "Priority Inbox",
      description: "AI-sorted emails with important messages first",
      icon: Sparkles,
      tier: "business",
    },
    {
      id: "unlimited",
      name: "Unlimited Everything",
      description: "No limits on emails, aliases, or AI summaries",
      icon: Zap,
      tier: "business",
    },
    {
      id: "support",
      name: "Priority Support",
      description: "24/7 dedicated support with <1 hour response time",
      icon: Shield,
      tier: "business",
    },
  ];

  const tierConfig = {
    free: {
      color: "from-slate-400 to-slate-500",
      bgColor: "bg-slate-500/10",
      borderColor: "border-slate-500/30",
      price: 0,
    },
    pro: {
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/30",
      price: 5,
    },
    business: {
      color: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
      price: 15,
    },
  };

  const handleUpgrade = (tier: string) => {
    fireConfetti();
    if (user) {
      navigate("/dashboard");
    } else {
      navigate("/auth");
    }
  };

  const toggleDemo = (featureId: string) => {
    setActiveDemo(activeDemo === featureId ? null : featureId);
    setIsPlaying((prev) => ({ ...prev, [featureId]: !prev[featureId] }));
  };

  return (
    <div className="min-h-screen bg-background noise-bg relative">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <Badge className="mb-4 bg-gradient-to-r from-primary to-accent text-primary-foreground">
              <Sparkles className="w-3 h-3 mr-1" />
              Premium Features
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">
              Supercharge Your Inbox
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Unlock powerful features to manage your temporary emails like a pro.
              From custom aliases to API access, we've got you covered.
            </p>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
          >
            {[
              { label: "Active Users", value: "50K+", icon: Users },
              { label: "Emails Protected", value: "10M+", icon: Mail },
              { label: "Uptime", value: "99.9%", icon: Shield },
              { label: "Response Time", value: "<100ms", icon: Zap },
            ].map((stat, i) => (
              <Card key={i} className="glass-card text-center hover-lift">
                <CardContent className="pt-6">
                  <stat.icon className="w-6 h-6 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* Features by Tier */}
          <Tabs defaultValue="all" className="mb-12">
            <TabsList className="grid grid-cols-4 mb-8">
              <TabsTrigger value="all">All Features</TabsTrigger>
              <TabsTrigger value="free">Free</TabsTrigger>
              <TabsTrigger value="pro">Pro</TabsTrigger>
              <TabsTrigger value="business">Business</TabsTrigger>
            </TabsList>

            {["all", "free", "pro", "business"].map((tab) => (
              <TabsContent key={tab} value={tab} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {features
                    .filter((f) => tab === "all" || f.tier === tab)
                    .map((feature, index) => (
                      <motion.div
                        key={feature.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card
                          className={`glass-card h-full hover-lift group cursor-pointer transition-all ${
                            tierConfig[feature.tier].borderColor
                          } hover:border-primary/50`}
                          onClick={() => toggleDemo(feature.id)}
                        >
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div
                                className={`p-2 rounded-lg ${tierConfig[feature.tier].bgColor}`}
                              >
                                <feature.icon className="w-5 h-5 text-foreground" />
                              </div>
                              <Badge
                                variant="outline"
                                className={`capitalize bg-gradient-to-r ${
                                  tierConfig[feature.tier].color
                                } text-white border-0`}
                              >
                                {feature.tier}
                              </Badge>
                            </div>
                            <CardTitle className="text-lg">{feature.name}</CardTitle>
                            <CardDescription>{feature.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <AnimatePresence>
                              {activeDemo === feature.id && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="border-t border-border pt-4 mt-2"
                                >
                                  <div className="flex items-center gap-2 text-sm text-primary">
                                    {isPlaying[feature.id] ? (
                                      <Pause className="w-4 h-4" />
                                    ) : (
                                      <Play className="w-4 h-4" />
                                    )}
                                    <span>Demo animation</span>
                                  </div>
                                  <div className="mt-3 p-4 bg-secondary/30 rounded-lg">
                                    <motion.div
                                      animate={
                                        isPlaying[feature.id]
                                          ? { opacity: [0.5, 1, 0.5] }
                                          : {}
                                      }
                                      transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                      }}
                                      className="h-8 bg-gradient-to-r from-primary/20 to-accent/20 rounded"
                                    />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Pricing CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20 p-8 md:p-12"
          >
            <div className="absolute inset-0 noise-bg opacity-50" />
            <div className="relative z-10 text-center">
              <Crown className="w-12 h-12 mx-auto mb-4 text-amber-500" />
              <h2 className="text-3xl font-bold mb-4">
                Ready to Unlock Premium Features?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                Join thousands of users who trust Nullsto for their privacy.
                Upgrade today and get access to all premium features.
              </p>
              
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 gap-2 hover-lift"
                  onClick={() => handleUpgrade("pro")}
                >
                  <Zap className="w-4 h-4" />
                  Upgrade to Pro - $5/mo
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 gap-2 hover-lift"
                  onClick={() => handleUpgrade("business")}
                >
                  <Crown className="w-4 h-4" />
                  Go Business - $15/mo
                </Button>
              </div>

              {isPremium && currentTier && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6 text-sm text-muted-foreground flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4 text-green-500" />
                  You're on the {currentTier.name} plan
                </motion.p>
              )}
            </div>
          </motion.div>

          {/* Feature Comparison */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-16"
          >
            <h2 className="text-2xl font-bold text-center mb-8">
              Compare Plans
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-4">Feature</th>
                    <th className="text-center py-4 px-4">Free</th>
                    <th className="text-center py-4 px-4 bg-purple-500/5">Pro</th>
                    <th className="text-center py-4 px-4 bg-amber-500/5">Business</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "Temp Emails", free: "3", pro: "50", business: "∞" },
                    { name: "Email Expiry", free: "1 hour", pro: "24 hours", business: "7 days" },
                    { name: "Aliases", free: "3", pro: "10", business: "∞" },
                    { name: "AI Summaries", free: "5/day", pro: "100/day", business: "∞" },
                    { name: "Email Forwarding", free: "✗", pro: "✓", business: "✓" },
                    { name: "API Access", free: "✗", pro: "✓", business: "✓" },
                    { name: "Webhooks", free: "✗", pro: "✓", business: "✓" },
                    { name: "Custom Domains", free: "✗", pro: "✗", business: "✓" },
                    { name: "Priority Support", free: "✗", pro: "✓", business: "✓" },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-3 px-4 text-muted-foreground">{row.name}</td>
                      <td className="py-3 px-4 text-center">{row.free}</td>
                      <td className="py-3 px-4 text-center bg-purple-500/5 font-medium">
                        {row.pro}
                      </td>
                      <td className="py-3 px-4 text-center bg-amber-500/5 font-medium">
                        {row.business}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PremiumFeatures;
