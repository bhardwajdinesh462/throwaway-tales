import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, RefreshCw, ArrowLeft, CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const VerifyEmail = () => {
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  
  // Get email from location state (passed from signup) or from user object
  const emailFromState = location.state?.email;
  const displayEmail = emailFromState || user?.email || "your email";
  
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token]);

  const verifyToken = async (verificationToken: string) => {
    setIsVerifying(true);
    setVerificationStatus('pending');
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-email-token', {
        body: { token: verificationToken },
      });

      if (error || !data?.success) {
        setVerificationStatus('error');
        setVerificationError(data?.error || error?.message || "Verification failed");
        toast.error(data?.error || "Verification failed");
      } else {
        setVerificationStatus('success');
        toast.success("Email verified successfully!");
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
      }
    } catch (error: any) {
      setVerificationStatus('error');
      setVerificationError(error.message || "Verification failed");
      toast.error("Failed to verify email");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendEmail = async () => {
    const emailToUse = user?.email || emailFromState;
    
    if (!emailToUse) {
      toast.error("No email address found. Please try signing up again.");
      return;
    }

    const userId = user?.id;
    if (!userId) {
      toast.error("Please log in to resend verification email");
      return;
    }

    setIsResending(true);
    try {
      // Use the combined edge function that bypasses RLS
      const { data, error } = await supabase.functions.invoke('create-verification-and-send', {
        body: {
          userId: userId,
          email: emailToUse,
          name: user?.user_metadata?.display_name || emailToUse.split('@')[0]
        }
      });

      if (error) {
        console.error('Error sending verification email:', error);
        toast.error(error.message || "Failed to send verification email");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Verification email sent! Check your inbox.");
    } catch (error) {
      console.error('Error sending verification email:', error);
      toast.error("Failed to send verification email");
    } finally {
      setIsResending(false);
    }
  };

  // Show verification result if token is present
  if (token) {
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
                {isVerifying && (
                  <>
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">
                      Verifying Your Email
                    </h1>
                    <p className="text-muted-foreground">
                      Please wait while we verify your email address...
                    </p>
                  </>
                )}

                {verificationStatus === 'success' && !isVerifying && (
                  <>
                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-10 h-10 text-green-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">
                      Email Verified!
                    </h1>
                    <p className="text-muted-foreground mb-6">
                      Your email has been verified successfully. Redirecting to dashboard...
                    </p>
                    <Button onClick={() => navigate("/dashboard")}>
                      Go to Dashboard
                    </Button>
                  </>
                )}

                {verificationStatus === 'error' && !isVerifying && (
                  <>
                    <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
                      <XCircle className="w-10 h-10 text-destructive" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">
                      Verification Failed
                    </h1>
                    <p className="text-muted-foreground mb-6">
                      {verificationError || "The verification link is invalid or has expired."}
                    </p>
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleResendEmail}
                        disabled={isResending}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isResending ? "animate-spin" : ""}`} />
                        {isResending ? "Sending..." : "Request New Verification Email"}
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
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Default view - waiting for verification
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
                  {displayEmail}
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
                  <li>You'll be redirected to your dashboard</li>
                </ol>
              </div>

              <div className="space-y-3">
                {user && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleResendEmail}
                    disabled={isResending}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isResending ? "animate-spin" : ""}`} />
                    {isResending ? "Sending..." : "Resend Verification Email"}
                  </Button>
                )}

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
