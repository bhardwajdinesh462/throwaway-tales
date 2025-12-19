import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Loader2, Chrome, KeyRound, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRegistrationSettings } from "@/hooks/useRegistrationSettings";
import { toast } from "sonner";
import { z } from "zod";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";

const emailSchema = z.string().email("Please enter a valid email address").max(255);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(128);
const nameSchema = z.string().max(100).optional();

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, isAdmin, signIn, signUp, signInWithGoogle, signInWithFacebook, resetPassword, updatePassword } = useAuth();
  const { t } = useLanguage();
  const { settings: regSettings, isLoading: regLoading } = useRegistrationSettings();
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get('mode') === 'reset') {
      setMode('reset');
    }
  }, [searchParams]);

  useEffect(() => {
    // Only redirect if user is logged in and NOT in reset mode
    if (user && mode !== 'reset') {
      // Redirect based on role
      if (isAdmin) {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    }
  }, [user, isAdmin, navigate, mode]);

  // Sanitize inputs
  const sanitizeInput = (input: string) => {
    return DOMPurify.sanitize(input.trim());
  };

  const validateInputs = (validatePassword = true) => {
    try {
      emailSchema.parse(email);
      if (validatePassword) {
        passwordSchema.parse(password);
      }
      if (mode === 'signup') {
        nameSchema.parse(name);
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Sanitize all inputs
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedName = sanitizeInput(name);

    try {
      if (mode === 'login') {
        if (!validateInputs()) {
          setIsSubmitting(false);
          return;
        }
        const { error } = await signIn(sanitizedEmail, password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Welcome back!");
          // Navigation handled by useEffect
        }
      } else if (mode === 'signup') {
        // Check if registration is allowed
        if (!regSettings.allowRegistration) {
          toast.error(regSettings.registrationMessage);
          setIsSubmitting(false);
          return;
        }

        if (!validateInputs()) {
          setIsSubmitting(false);
          return;
        }
        const { error, data } = await signUp(sanitizedEmail, password, sanitizedName);
        if (error) {
          toast.error(error.message);
        } else if (data?.user) {
          // Use combined edge function that handles both DB insert and email sending
          // This bypasses RLS using service role key
          try {
            const { data: verifyResult, error: verifyError } = await supabase.functions.invoke('create-verification-and-send', {
              body: {
                userId: data.user.id,
                email: sanitizedEmail,
                name: sanitizedName,
              },
            });

            if (verifyError) {
              console.error('Failed to send verification email:', verifyError);
            } else {
              console.log('Verification email sent:', verifyResult);
            }
          } catch (verificationError) {
            console.error('Failed to send verification email:', verificationError);
          }
          
          toast.success("Account created! Please check your email to verify.");
          navigate("/verify-email", { state: { email: sanitizedEmail } });
        }
      } else if (mode === 'forgot') {
        if (!validateInputs(false)) {
          setIsSubmitting(false);
          return;
        }
        const { error } = await resetPassword(sanitizedEmail);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Password reset email sent! Check your inbox.");
          setMode('login');
        }
      } else if (mode === 'reset') {
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          setIsSubmitting(false);
          return;
        }
        try {
          passwordSchema.parse(password);
        } catch (error) {
          if (error instanceof z.ZodError) {
            toast.error(error.errors[0].message);
          }
          setIsSubmitting(false);
          return;
        }
        const { error } = await updatePassword(password);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Password updated successfully!");
          navigate("/dashboard");
        }
      }
    } catch (error) {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (mode === 'signup' && !regSettings.allowRegistration) {
      toast.error(regSettings.registrationMessage);
      return;
    }
    setIsSubmitting(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error(error.message);
    }
    setIsSubmitting(false);
  };

  const handleFacebookSignIn = async () => {
    if (mode === 'signup' && !regSettings.allowRegistration) {
      toast.error(regSettings.registrationMessage);
      return;
    }
    setIsSubmitting(true);
    const { error } = await signInWithFacebook();
    if (error) {
      toast.error(error.message);
    }
    setIsSubmitting(false);
  };

  const getTitle = () => {
    switch (mode) {
      case 'login': return t('welcomeBack');
      case 'signup': return t('createAccount');
      case 'forgot': return 'Reset Password';
      case 'reset': return 'Set New Password';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'login': return t('signInDesc');
      case 'signup': return t('signUpDesc');
      case 'forgot': return 'Enter your email to receive a password reset link';
      case 'reset': return 'Enter your new password below';
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case 'login': return t('signIn');
      case 'signup': return t('createAccount');
      case 'forgot': return 'Send Reset Link';
      case 'reset': return 'Update Password';
    }
  };

  if (regLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {getTitle()}
              </h1>
              <p className="text-muted-foreground">
                {getDescription()}
              </p>
            </div>

            {/* Registration Disabled Warning */}
            {mode === 'signup' && !regSettings.allowRegistration && (
              <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-600 dark:text-amber-400">
                  {regSettings.registrationMessage}
                </AlertDescription>
              </Alert>
            )}

            <div className="glass-card p-8">
              {/* Social Login - only show for login/signup */}
              {(mode === 'login' || mode === 'signup') && (
                <>
                  <div className="space-y-3 mb-6">
                    <Button
                      variant="glass"
                      className="w-full"
                      onClick={handleGoogleSignIn}
                      disabled={isSubmitting || (mode === 'signup' && !regSettings.allowRegistration)}
                    >
                      <Chrome className="w-5 h-5 mr-2" />
                      {t('continueWithGoogle')}
                    </Button>
                    <Button
                      variant="glass"
                      className="w-full"
                      onClick={handleFacebookSignIn}
                      disabled={isSubmitting || (mode === 'signup' && !regSettings.allowRegistration)}
                    >
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      {t('continueWithFacebook')}
                    </Button>
                  </div>

                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-card px-4 text-muted-foreground">{t('or')}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      {t('fullName')}
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10 bg-secondary/50 border-border"
                        maxLength={100}
                        disabled={!regSettings.allowRegistration}
                      />
                    </div>
                  </div>
                )}

                {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      {t('emailAddress')}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-secondary/50 border-border"
                        required
                        maxLength={255}
                        disabled={mode === 'signup' && !regSettings.allowRegistration}
                      />
                    </div>
                  </div>
                )}

                {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      {mode === 'reset' ? 'New Password' : t('password')}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-secondary/50 border-border"
                        required
                        maxLength={128}
                        disabled={mode === 'signup' && !regSettings.allowRegistration}
                      />
                    </div>
                  </div>
                )}

                {mode === 'reset' && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 bg-secondary/50 border-border"
                        required
                        maxLength={128}
                      />
                    </div>
                  </div>
                )}

                {mode === 'login' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="neon"
                  className="w-full"
                  disabled={isSubmitting || (mode === 'signup' && !regSettings.allowRegistration)}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {getButtonText()}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center space-y-2">
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {t('dontHaveAccount')}
                  </button>
                )}
                {mode === 'signup' && (
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {t('alreadyHaveAccount')}
                  </button>
                )}
                {(mode === 'forgot' || mode === 'reset') && (
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    Back to login
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Auth;
