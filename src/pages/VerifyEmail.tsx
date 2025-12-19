import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, RefreshCw, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const VerifyEmail = () => {
  const [isResending, setIsResending] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleResendEmail = async () => {
    if (!user?.email) {
      toast.error("No email address found");
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Verification email sent! Check your inbox.");
      }
    } catch (error) {
      toast.error("Failed to send verification email");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto text-center"
          >
            <div className="glass-card p-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-10 h-10 text-primary" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">
                Check Your Email
              </h1>
              
              <p className="text-muted-foreground mb-6">
                We've sent a verification link to{" "}
                <span className="font-medium text-foreground">
                  {user?.email || "your email"}
                </span>
              </p>

              <div className="bg-secondary/50 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Next Steps:
                </h3>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Open your email inbox</li>
                  <li>Look for an email from us (check spam folder too)</li>
                  <li>Click the verification link in the email</li>
                  <li>You'll be redirected back to sign in</li>
                </ol>
              </div>

              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResendEmail}
                  disabled={isResending}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isResending ? "animate-spin" : ""}`} />
                  {isResending ? "Sending..." : "Resend Verification Email"}
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate("/auth")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-6">
                Didn't receive the email? Check your spam folder or try resending.
              </p>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default VerifyEmail;
