import { useEffect } from "react";
import { motion } from "framer-motion";
import { Mail, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useEmailService } from "@/hooks/useLocalEmailService";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { formatDistanceToNow } from "date-fns";

const History = () => {
  const { user } = useAuth();
  const { emailHistory, loadFromHistory } = useEmailService();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Email History
              </h1>
              <p className="text-muted-foreground">
                View and restore your previously generated email addresses
              </p>
            </div>

            <div className="glass-card overflow-hidden">
              {emailHistory.length === 0 ? (
                <div className="p-12 text-center">
                  <Mail className="w-16 h-16 mx-auto text-muted-foreground opacity-50 mb-4" />
                  <p className="text-foreground font-medium mb-2">No email history</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your generated email addresses will appear here
                  </p>
                  <Button variant="neon" onClick={() => navigate("/")}>
                    Generate Your First Email
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {emailHistory.map((email, index) => (
                    <motion.div
                      key={email.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 hover:bg-secondary/20 transition-colors cursor-pointer"
                      onClick={() => {
                        loadFromHistory(email.id);
                        navigate("/");
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Mail className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-mono text-foreground">{email.address}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>Created {formatDistanceToNow(new Date(email.created_at), { addSuffix: true })}</span>
                              {!email.is_active && (
                                <span className="text-destructive">• Expired</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default History;
