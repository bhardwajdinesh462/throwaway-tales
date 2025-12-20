import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import StatusMonitor from "@/components/StatusMonitor";

const Status = () => {
  return (
    <>
      <SEOHead
        title="System Status - Service Uptime Monitor"
        description="Check the real-time status of our email services. Monitor IMAP, SMTP, database, and real-time systems."
      />
      <div className="min-h-screen bg-background">
        <Header />
        
        {/* Spacer for fixed header */}
        <div className="h-[104px]" />
        
        <main className="container mx-auto px-4 py-8 md:py-12">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4"
            >
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Live Monitoring</span>
            </motion.div>
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3">
              <span className="bg-gradient-to-r from-primary via-emerald-500 to-cyan-500 bg-clip-text text-transparent">
                System Status
              </span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
              Real-time monitoring of our email infrastructure. Check if services are running smoothly.
            </p>
          </motion.div>

          {/* Status Monitor */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-5xl mx-auto"
          >
            <StatusMonitor />
          </motion.div>

          {/* Info Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="max-w-2xl mx-auto mt-12"
          >
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6">
              <h3 className="font-semibold mb-4 text-foreground">How We Monitor</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong className="text-foreground">IMAP:</strong> We check if our mail servers are actively polling for new emails and if any errors occurred during the last fetch.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong className="text-foreground">SMTP:</strong> We analyze recent email delivery logs to calculate success rates for outgoing messages.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong className="text-foreground">Database:</strong> We perform a quick query to measure response time and connection health.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong className="text-foreground">Real-time:</strong> We test WebSocket connections to ensure live updates are working properly.</span>
                </li>
              </ul>
            </div>
          </motion.div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Status;