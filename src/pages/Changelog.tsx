import { motion } from "framer-motion";
import { Calendar, Sparkles, Layout, Zap, Eye, Settings } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";

interface ChangelogEntry {
  date: string;
  title: string;
  changes: {
    type: "feature" | "improvement" | "fix" | "design";
    description: string;
  }[];
}

const changelogs: ChangelogEntry[] = [
  {
    date: "January 7, 2025",
    title: "User Experience Enhancements",
    changes: [
      { type: "feature", description: "Email copy formats menu - copy as mailto, Markdown, or JSON" },
      { type: "feature", description: "Inbox filters and sorting - filter by read/unread, sort by date or sender" },
      { type: "feature", description: "Inbox statistics widget with collapsible analytics panel" },
      { type: "feature", description: "Quick theme toggle button in header" },
      { type: "feature", description: "Share email button with QR code and social sharing options" },
      { type: "improvement", description: "Trusted email provider validation - only Gmail, Outlook, ProtonMail, etc. allowed for signup" },
    ]
  },
  {
    date: "January 6, 2025",
    title: "Admin & Live Stats Improvements",
    changes: [
      { type: "feature", description: "Sound notifications when live stats counters update in real-time" },
      { type: "feature", description: "First-time admin claim system for initial setup" },
      { type: "improvement", description: "Auto-generate email for first-time visitors without manual domain selection" },
      { type: "design", description: "Animated pulse effects on live stats counters during updates" },
    ]
  },
  {
    date: "December 27, 2024",
    title: "SEO & Analytics Injection",
    changes: [
      {
        type: "feature",
        description: "Added complete SEO injection for Google Analytics, Tag Manager, Facebook Pixel from admin settings"
      },
      {
        type: "feature",
        description: "Header and footer code injection with proper script execution"
      },
      {
        type: "improvement",
        description: "Custom CSS and JavaScript injection from admin SEO settings"
      },
      {
        type: "fix",
        description: "Fixed admin SEO page paths mapping (privacy, terms, etc.)"
      },
      {
        type: "feature",
        description: "Added username style selector - choose between human-like or random usernames"
      }
    ]
  },
  {
    date: "December 26, 2024",
    title: "Email Parsing & Stats",
    changes: [
      {
        type: "feature",
        description: "Rich HTML email parsing and display with proper sanitization"
      },
      {
        type: "improvement",
        description: "Stabilized live stats counter to prevent flickering"
      },
      {
        type: "fix",
        description: "Fixed email body rendering for complex HTML emails"
      },
      {
        type: "improvement",
        description: "Better email preview with truncation and formatting"
      }
    ]
  },
  {
    date: "December 25, 2024",
    title: "SMTP Failover System",
    changes: [
      {
        type: "feature",
        description: "Automatic SMTP mailbox rotation when sending fails"
      },
      {
        type: "improvement",
        description: "Mailbox health tracking with automatic cooldown after errors"
      },
      {
        type: "feature",
        description: "Support for encrypted SMTP passwords in database"
      },
      {
        type: "fix",
        description: "Fixed verification email delivery with proper failover"
      }
    ]
  },
  {
    date: "December 24, 2024",
    title: "Admin Dashboard Improvements",
    changes: [
      {
        type: "feature",
        description: "Email logs with detailed sending status and error tracking"
      },
      {
        type: "improvement",
        description: "Mailbox management with priority ordering"
      },
      {
        type: "design",
        description: "Improved admin sidebar navigation with icons"
      },
      {
        type: "feature",
        description: "Subscription stats widget showing tier breakdown"
      }
    ]
  },
  {
    date: "December 23, 2024",
    title: "Email Verification System",
    changes: [
      {
        type: "feature",
        description: "Secure email verification with hashed tokens"
      },
      {
        type: "improvement",
        description: "Customizable email templates for verification and password reset"
      },
      {
        type: "feature",
        description: "Resend verification email functionality"
      },
      {
        type: "fix",
        description: "Fixed verification link generation with correct site URL"
      }
    ]
  },
  {
    date: "December 20, 2024",
    title: "Layout & Spacing Optimization",
    changes: [
      {
        type: "design",
        description: "Reduced excessive spacing across all sections for better visual balance"
      },
      {
        type: "improvement",
        description: "Optimized padding in HeroSection, FeaturesSection, HowItWorks, FAQSection, and CTASection"
      },
      {
        type: "design",
        description: "Improved responsive layout for Quick Tips section - now appears on the right side on large screens and below inbox on mobile"
      },
      {
        type: "feature",
        description: "Added beautiful Changelog page with animated timeline"
      }
    ]
  },
  {
    date: "December 19, 2024",
    title: "Homepage Restructure & Real-time Inbox",
    changes: [
      {
        type: "feature",
        description: "Reorganized homepage layout with Email Generator at the top"
      },
      {
        type: "improvement",
        description: "Moved Real-time Inbox section below Email Generator for better user flow"
      },
      {
        type: "design",
        description: "Added Quick Tips section with important announcements and promotional links"
      },
      {
        type: "improvement",
        description: "Enhanced responsive design for inbox and tips sections"
      },
      {
        type: "feature",
        description: "Implemented side-by-side layout for Inbox and Quick Tips on desktop"
      }
    ]
  }
];

const typeConfig = {
  feature: {
    icon: Sparkles,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    label: "New Feature"
  },
  improvement: {
    icon: Zap,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    label: "Improvement"
  },
  fix: {
    icon: Settings,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    label: "Bug Fix"
  },
  design: {
    icon: Eye,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    label: "Design"
  }
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 12
    }
  }
};

const changeVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 120,
      damping: 14
    }
  }
};

const Changelog = () => {
  return (
    <>
      <SEOHead
        title="Changelog - TempMail Updates"
        description="See what's new in TempMail. Latest updates, features, and improvements."
      />
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container mx-auto px-4 py-8 md:py-12">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4"
            >
              <Layout className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">What's New</span>
            </motion.div>
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3">
              <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Changelog
              </span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
              Track all the latest updates, improvements, and new features we've shipped
            </p>
          </motion.div>

          {/* Timeline */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-3xl mx-auto relative"
          >
            {/* Timeline Line */}
            <div className="absolute left-0 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent transform md:-translate-x-1/2" />

            {changelogs.map((entry, index) => (
              <motion.div
                key={entry.date}
                variants={itemVariants}
                className={`relative mb-8 md:mb-10 ${
                  index % 2 === 0 ? "md:pr-[50%] md:text-right" : "md:pl-[50%] md:ml-auto"
                }`}
              >
                {/* Timeline Dot */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className={`absolute top-0 w-4 h-4 rounded-full bg-primary shadow-lg shadow-primary/30 ${
                    index % 2 === 0
                      ? "left-0 md:left-1/2 transform md:-translate-x-1/2"
                      : "left-0 md:left-1/2 transform md:-translate-x-1/2"
                  }`}
                >
                  <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-30" />
                </motion.div>

                {/* Content Card */}
                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className={`ml-8 md:ml-0 ${index % 2 === 0 ? "md:mr-8" : "md:ml-8"}`}
                >
                  <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-5 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300">
                    {/* Date Badge */}
                    <div className={`inline-flex items-center gap-2 mb-3 ${index % 2 === 0 ? "md:float-right md:ml-3" : ""}`}>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {entry.date}
                      </div>
                    </div>

                    <h3 className={`text-lg font-semibold mb-4 clear-both ${index % 2 === 0 ? "md:text-right" : "md:text-left"}`}>
                      {entry.title}
                    </h3>

                    {/* Changes List */}
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true }}
                      className="space-y-2"
                    >
                      {entry.changes.map((change, changeIndex) => {
                        const config = typeConfig[change.type];
                        const Icon = config.icon;
                        
                        return (
                          <motion.div
                            key={changeIndex}
                            variants={changeVariants}
                            className={`flex items-start gap-2 ${index % 2 === 0 ? "md:flex-row-reverse md:text-right" : ""}`}
                          >
                            <div className={`flex-shrink-0 p-1.5 rounded-lg ${config.bg} ${config.border} border`}>
                              <Icon className={`w-3 h-3 ${config.color}`} />
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {change.description}
                            </p>
                          </motion.div>
                        );
                      })}
                    </motion.div>
                  </div>
                </motion.div>
              </motion.div>
            ))}

            {/* End Decoration */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
              className="absolute left-0 md:left-1/2 bottom-0 transform md:-translate-x-1/2"
            >
              <div className="w-3 h-3 rounded-full bg-muted border-2 border-border" />
            </motion.div>
          </motion.div>

          {/* Coming Soon Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="max-w-xl mx-auto mt-12 text-center"
          >
            <div className="bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 rounded-2xl p-6 border border-primary/10">
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">More Updates Coming Soon</h3>
              <p className="text-sm text-muted-foreground">
                We're constantly improving TempMail. Stay tuned for more exciting features and enhancements!
              </p>
            </div>
          </motion.div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Changelog;
