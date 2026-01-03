import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, RefreshCw, Check, Star, Volume2, Plus, Edit2, Sparkles, User, Mail, Zap, Clock } from "lucide-react";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEmailService } from "@/contexts/EmailServiceContext";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { EmailQRCode } from "@/components/EmailQRCode";
import EmailExpiryTimer from "@/components/EmailExpiryTimer";
import { useRecaptcha } from "@/hooks/useRecaptcha";
import { supabase } from "@/integrations/supabase/client";
import { tooltips } from "@/lib/tooltips";
import EmailLimitBanner from "@/components/EmailLimitBanner";
import EmailLimitModal from "@/components/EmailLimitModal";

interface RateLimitSettings {
  max_requests: number;
  window_minutes: number;
  guest_max_requests: number;
  guest_window_minutes: number;
}

interface EmailUsageStats {
  used: number;
  remaining: number;
  limit: number;
  resetAt: Date | null;
}

const EmailGenerator = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdminRole();
  const { t } = useLanguage();
  const {
    domains,
    currentEmail,
    isGenerating,
    generateEmail,
    generateCustomEmail,
    changeDomain,
    addCustomDomain,
    usernameStyle,
    setUsernameStyle,
  } = useEmailService();
  const { executeRecaptcha, isEnabled: captchaEnabled, isReady: captchaReady, loadError: captchaError, settings: captchaSettings } = useRecaptcha();
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [customDomainDialog, setCustomDomainDialog] = useState(false);
  const [customEmailDialog, setCustomEmailDialog] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [customUsername, setCustomUsername] = useState("");
  const [selectedCustomDomain, setSelectedCustomDomain] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [rateLimitSettings, setRateLimitSettings] = useState<RateLimitSettings>({
    max_requests: 30,
    window_minutes: 60,
    guest_max_requests: 10,
    guest_window_minutes: 60,
  });
  const [emailUsage, setEmailUsage] = useState<EmailUsageStats>({
    used: 0,
    remaining: 30,
    limit: 30,
    resetAt: null,
  });

  // Load rate limit settings from subscription tiers (for registered users) or app_settings (for guests)
  const loadRateLimitSettings = useCallback(async () => {
    try {
      // First fetch the subscription tiers to get limits for registered users
      const { data: tiers } = await supabase
        .from("subscription_tiers")
        .select("name, max_temp_emails")
        .order("price_monthly", { ascending: true });

      // Get user's current tier if logged in
      let userTierLimit = 5; // Default for free tier
      if (user) {
        const { data: subscription } = await supabase
          .from("user_subscriptions")
          .select("tier_id, subscription_tiers(max_temp_emails)")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (subscription?.subscription_tiers) {
          const tierData = subscription.subscription_tiers as { max_temp_emails: number };
          userTierLimit = tierData.max_temp_emails === -1 ? 9999 : tierData.max_temp_emails;
        } else if (tiers && tiers.length > 0) {
          // Use free tier limit
          const freeTier = tiers.find(t => t.name.toLowerCase() === 'free');
          if (freeTier) {
            userTierLimit = freeTier.max_temp_emails === -1 ? 9999 : freeTier.max_temp_emails;
          }
        }
      } else {
        // For guests, get the free tier limit
        if (tiers && tiers.length > 0) {
          const freeTier = tiers.find(t => t.name.toLowerCase() === 'free');
          if (freeTier) {
            userTierLimit = freeTier.max_temp_emails === -1 ? 9999 : freeTier.max_temp_emails;
          }
        }
      }

      // Fetch guest limits from app_settings (for window minutes)
      const { data: appSettings } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "rate_limit_temp_email_create")
        .single();

      let guestWindow = 60;
      
      if (appSettings?.value && typeof appSettings.value === 'object' && !Array.isArray(appSettings.value)) {
        const value = appSettings.value as Record<string, unknown>;
        guestWindow = typeof value.guest_window_minutes === 'number' ? value.guest_window_minutes : 60;
      }

      setRateLimitSettings({
        max_requests: userTierLimit,
        window_minutes: 60, // Daily for registered users
        guest_max_requests: userTierLimit, // Use same tier limit for guests
        guest_window_minutes: guestWindow,
      });

      return userTierLimit;
    } catch (err) {
      console.error('Failed to load rate limit settings:', err);
      return 5;
    }
  }, [user]);

  // Update email usage count - uses rate_limits for accurate tracking with 24h reset
  const updateEmailUsage = useCallback(async (limit: number, windowMinutes: number = 1440) => {
    try {
      let used = 0;
      let resetAt: Date | null = null;
      
      // Calculate reset time based on window
      const now = new Date();
      const windowMs = windowMinutes * 60 * 1000;
      const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
      resetAt = new Date(windowStart.getTime() + windowMs);
      
      if (user) {
        // For logged-in users, check rate_limits table
        const { data } = await supabase
          .from("rate_limits")
          .select("request_count, window_start")
          .eq("identifier", user.id)
          .eq("action_type", "generate_email")
          .order("window_start", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          const recordWindow = new Date(data.window_start);
          // Check if record is within current window
          if (recordWindow >= windowStart) {
            used = data.request_count || 0;
          }
        }
      } else {
        // For guests, check rate_limits table
        const deviceId = localStorage.getItem('nullsto_device_id') || '';
        if (deviceId) {
          const { data } = await supabase
            .from("rate_limits")
            .select("request_count, window_start")
            .eq("identifier", deviceId)
            .eq("action_type", "generate_email")
            .order("window_start", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (data) {
            const recordWindow = new Date(data.window_start);
            if (recordWindow >= windowStart) {
              used = data.request_count || 0;
            }
          }
        }
        
        // Also check localStorage for initial load count
        const localCount = getLocalEmailCount();
        if (localCount > used) {
          used = localCount;
        }
      }

      const remaining = limit === 9999 ? 9999 : Math.max(0, limit - used);
      setEmailUsage({ used, remaining, limit: limit === 9999 ? -1 : limit, resetAt });
    } catch (err) {
      console.error('Failed to update email usage:', err);
    }
  }, [user]);

  // Helper to get local email creation count
  const getLocalEmailCount = (): number => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = JSON.parse(localStorage.getItem('nullsto_email_creation_count') || '{}');
      if (data.date === today) {
        return data.count || 0;
      }
      return 0;
    } catch {
      return 0;
    }
  };

  // Load settings on mount and subscribe to real-time changes
  useEffect(() => {
    let cancelled = false;
    
    const init = async () => {
      if (cancelled) return;
      const limit = await loadRateLimitSettings();
      if (cancelled) return;
      const windowMinutes = user ? rateLimitSettings.window_minutes : rateLimitSettings.guest_window_minutes;
      await updateEmailUsage(limit, windowMinutes || 1440);
    };
    init();

    // Subscribe to real-time changes in settings, tiers, and temp_emails
    const channel = supabase.channel('email_usage_tracking');
    
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.rate_limit_temp_email_create'
        },
        async () => {
          if (cancelled) return;
          const limit = await loadRateLimitSettings();
          if (!cancelled) await updateEmailUsage(limit);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscription_tiers',
        },
        async () => {
          if (cancelled) return;
          const limit = await loadRateLimitSettings();
          if (!cancelled) await updateEmailUsage(limit);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'temp_emails',
        },
        async () => {
          if (cancelled) return;
          // Immediately update usage when a new temp email is created
          const limit = user ? rateLimitSettings.max_requests : rateLimitSettings.guest_max_requests;
          await updateEmailUsage(limit || 5);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rate_limits',
        },
        async () => {
          if (cancelled) return;
          // Update usage when rate_limits changes (including admin reset)
          const limit = user ? rateLimitSettings.max_requests : rateLimitSettings.guest_max_requests;
          const windowMinutes = user ? rateLimitSettings.window_minutes : rateLimitSettings.guest_window_minutes;
          await updateEmailUsage(limit || 5, windowMinutes || 1440);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [loadRateLimitSettings, updateEmailUsage, user, rateLimitSettings.max_requests, rateLimitSettings.guest_max_requests]);

  // Update counter when currentEmail changes (including initial load)
  useEffect(() => {
    if (currentEmail) {
      const limit = user ? rateLimitSettings.max_requests : rateLimitSettings.guest_max_requests;
      updateEmailUsage(limit || 5);
    }
  }, [currentEmail?.id, user, rateLimitSettings.max_requests, rateLimitSettings.guest_max_requests, updateEmailUsage]);

  const verifyCaptcha = async (action: string): Promise<boolean> => {
    if (!captchaEnabled || !captchaSettings.enableOnEmailGen) {
      return true;
    }

    // Check for load error
    if (captchaError) {
      toast.error("reCAPTCHA failed to load. Please refresh the page.");
      return false;
    }

    setIsVerifying(true);
    try {
      const token = await executeRecaptcha(action);
      
      // If token is 'skip', captcha is not enabled
      if (token === 'skip') {
        return true;
      }
      
      if (!token) {
        toast.error("reCAPTCHA not ready (or blocked). Please wait a moment and try again.");
        return false;
      }

      const { data, error } = await supabase.functions.invoke('verify-recaptcha', {
        body: { token, action }
      });

      if (error) {
        console.error('Captcha verification error:', error);
        toast.error("Captcha verification failed. Please try again.");
        return false;
      }
      
      if (!data?.success) {
        toast.error(data?.error || "Captcha verification failed");
        return false;
      }
      return true;
    } catch (error) {
      console.error('Captcha verification error:', error);
      toast.error("Captcha verification failed. Please try again.");
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = async () => {
    if (!currentEmail) return;
    await navigator.clipboard.writeText(currentEmail.address);
    setCopied(true);
    toast.success("Email copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshEmail = async () => {
    // Get or create a unique device identifier for anonymous users
    let identifier = user?.id;
    if (!identifier) {
      let deviceId = localStorage.getItem('nullsto_device_id');
      if (!deviceId) {
        deviceId = 'anon_' + crypto.randomUUID();
        localStorage.setItem('nullsto_device_id', deviceId);
      }
      identifier = deviceId;
    }

    // Domains not available (backend down or still loading)
    if (!domains || domains.length === 0) {
      toast.error("Domains are not loading right now. Please try again in a moment.");
      return;
    }

    // Pre-flight check: Verify user hasn't reached their limit before making API call
    const currentLimit = user ? rateLimitSettings.max_requests : rateLimitSettings.guest_max_requests;
    if (currentLimit !== 9999 && emailUsage.remaining <= 0) {
      // Show the limit modal instead of just a toast
      setShowLimitModal(true);
      return;
    }

    // Use dynamic rate limit settings from admin config
    const maxRequests = user
      ? rateLimitSettings.max_requests
      : (rateLimitSettings.guest_max_requests || rateLimitSettings.max_requests);
    const windowMinutes = user
      ? rateLimitSettings.window_minutes
      : (rateLimitSettings.guest_window_minutes || rateLimitSettings.window_minutes);

    const { data: rateLimitOk, error: rateLimitError } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_action_type: 'generate_email',
      p_max_requests: maxRequests,
      p_window_minutes: windowMinutes
    });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
    }

    if (rateLimitOk === false) {
      const waitTime = windowMinutes >= 60 ? `${Math.round(windowMinutes / 60)} hour(s)` : `${windowMinutes} minute(s)`;
      toast.error(`Rate limit exceeded. You can create ${maxRequests} emails per ${waitTime}. Please wait.`);
      return;
    }

    // Verify captcha before generating new email
    if (!await verifyCaptcha('generate_email')) {
      return;
    }

    const currentDomainId = currentEmail?.domain_id || domains[0]?.id;
    const success = await generateEmail(currentDomainId);
    if (!success) {
      // generateEmail already shows a toast; just stop here to avoid false "success" state
      return;
    }

    // Immediately update usage after generating (don't wait for realtime)
    setEmailUsage(prev => ({
      ...prev,
      used: prev.used + 1,
      remaining: prev.limit === -1 ? 9999 : Math.max(0, prev.remaining - 1)
    }));

    toast.success("New email generated!");
  };

  const handleSave = () => {
    if (!user) {
      toast.error("Please sign in to save emails", {
        action: {
          label: "Sign In",
          onClick: () => window.location.href = "/auth",
        },
      });
      return;
    }
    toast.info("Email address saved to your account!");
  };

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
    toast.success(soundEnabled ? "Sound notifications disabled" : "Sound notifications enabled");
  };

  const handleAddCustomDomain = () => {
    if (addCustomDomain(newDomain)) {
      setNewDomain("");
      setCustomDomainDialog(false);
    }
  };

  const handleCreateCustomEmail = async () => {
    if (!customUsername.trim()) {
      toast.error("Please enter a username");
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(customUsername)) {
      toast.error("Username can only contain letters, numbers, dots, hyphens, and underscores");
      return;
    }

    if (customUsername.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    const domainId = selectedCustomDomain || domains[0]?.id;
    if (!domainId) {
      toast.error("Please select a domain");
      return;
    }

    // *** CRITICAL: Check daily limit before creating custom email ***
    const currentLimit = user ? rateLimitSettings.max_requests : rateLimitSettings.guest_max_requests;
    if (currentLimit !== 9999 && emailUsage.remaining <= 0) {
      setShowLimitModal(true);
      return;
    }

    // Verify captcha before creating custom email
    if (!await verifyCaptcha('custom_email')) {
      return;
    }

    // Use the generateCustomEmail function from the hook to properly create in database
    const success = await generateCustomEmail(customUsername, domainId);
    
    if (success) {
      setCustomUsername("");
      setSelectedCustomDomain("");
      setCustomEmailDialog(false);
    }
  };

  const currentDomain = domains.find(d => d.id === currentEmail?.domain_id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.4 }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="relative">
        {/* Email Limit Banner */}
        <EmailLimitBanner 
          used={emailUsage.used}
          limit={emailUsage.limit}
          resetAt={emailUsage.resetAt}
          onUpgrade={() => window.location.href = '/pricing'}
        />

        {/* Email Limit Modal */}
        <EmailLimitModal
          isOpen={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          resetAt={emailUsage.resetAt}
          limit={emailUsage.limit}
        />

        {/* Decorative Elements */}
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-accent/10 rounded-full blur-2xl" />
        
        <div className="glass-card p-8 md:p-10 relative overflow-hidden">
          {/* Static gradient border - no infinite JS animation */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary via-accent to-primary" />
          <div className="absolute inset-[1px] rounded-xl bg-card" />
          
          <div className="relative z-10">
            {/* Header */}
            <div className="text-center mb-8">
              <motion.div 
                className="inline-flex items-center gap-2 mb-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">{t('yourTempEmail')}</span>
                <Sparkles className="w-4 h-4 text-primary" />
              </motion.div>
            </div>

            {/* Email Display */}
            <div className="relative mb-10">
              <motion.div
                key={currentEmail?.address}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300 opacity-50" />
                <div className="relative bg-secondary/50 rounded-2xl p-6 md:p-8 border border-primary/20 backdrop-blur-sm">
                  <motion.p 
                    className={`font-mono text-xl md:text-2xl lg:text-3xl text-center text-foreground break-all font-medium tracking-wide ${isGenerating ? 'blur-sm' : ''}`}
                    animate={isGenerating ? { opacity: [1, 0.5, 1] } : {}}
                    transition={{ duration: 0.5, repeat: isGenerating ? Infinity : 0 }}
                  >
                    {isGenerating 
                      ? "Generating..." 
                      : currentEmail?.address 
                        ? currentEmail.address 
                        : domains.length === 0 
                          ? "Loading domains..." 
                          : "Click Generate to create email"}
                  </motion.p>
                </div>
              </motion.div>
              
            </div>

            {/* Email Options + Usage Counter - Inline compact layout */}
            <div className="mt-4 mb-2">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {/* Username Style */}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/30 border border-border/50">
                  <User className="w-3 h-3 text-primary shrink-0" />
                  <div className="flex rounded overflow-hidden border border-border/40">
                    <button
                      onClick={() => setUsernameStyle('human')}
                      className={`px-2 py-0.5 text-[11px] font-medium transition-all ${
                        usernameStyle === 'human' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-card hover:bg-secondary text-muted-foreground'
                      }`}
                    >
                      Human
                    </button>
                    <button
                      onClick={() => setUsernameStyle('random')}
                      className={`px-2 py-0.5 text-[11px] font-medium transition-all ${
                        usernameStyle === 'random' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-card hover:bg-secondary text-muted-foreground'
                      }`}
                    >
                      Random
                    </button>
                  </div>
                </div>

                {/* Domain Selector */}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/30 border border-border/50">
                  <Mail className="w-3 h-3 text-primary shrink-0" />
                  <Select 
                    value={currentDomain?.id || ""} 
                    onValueChange={changeDomain}
                    disabled={isGenerating}
                  >
                    <SelectTrigger className="w-28 sm:w-36 bg-card border-border/40 text-[11px] h-6">
                      <SelectValue placeholder="Domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {domains.map((domain) => (
                        <SelectItem key={domain.id} value={domain.id}>
                          {domain.name} {domain.is_premium && "⭐"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCustomDomainDialog(true)}
                      className="h-6 w-6"
                      title="Add custom domain (Admin only)"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* Usage Counter - Inline with Tooltip */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/30 border border-border/50 cursor-help">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">{emailUsage.used}</span>/{emailUsage.limit === -1 ? '∞' : emailUsage.limit}
                      </span>
                      {emailUsage.limit !== -1 && (
                        <div className="w-12 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${
                              emailUsage.remaining <= 1 ? 'bg-destructive' : 'bg-primary'
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (emailUsage.used / emailUsage.limit) * 100)}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="text-xs space-y-1">
                      <p className="font-medium flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        Email Generation Limit
                      </p>
                      <p className="text-muted-foreground">
                        You can create {emailUsage.limit === -1 ? 'unlimited' : emailUsage.limit} emails per 24 hours.
                      </p>
                      <p className="text-muted-foreground">
                        Used: {emailUsage.used} | Remaining: {emailUsage.remaining === 9999 ? '∞' : emailUsage.remaining}
                      </p>
                      {emailUsage.resetAt && emailUsage.limit !== -1 && (
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Resets: {emailUsage.resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Upgrade prompt when low */}
              {emailUsage.limit !== -1 && emailUsage.remaining <= 1 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex justify-center mt-2"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = "/pricing"}
                    className="h-6 text-[10px] text-primary hover:text-primary gap-1"
                  >
                    <Zap className="w-3 h-3" />
                    {emailUsage.remaining === 0 ? 'Upgrade for more' : 'Running low'}
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="default"
                      size="lg"
                      onClick={copyToClipboard}
                      className="min-w-[150px] bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25"
                      disabled={!currentEmail}
                    >
                      <AnimatePresence mode="wait">
                        {copied ? (
                          <motion.span
                            key="copied"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex items-center gap-2"
                          >
                            <Check className="w-4 h-4" /> {t('copied')}
                          </motion.span>
                        ) : (
                          <motion.span
                            key="copy"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex items-center gap-2"
                          >
                            <Copy className="w-4 h-4" /> {t('copy')}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tooltips.emailGenerator.copy}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={refreshEmail}
                      disabled={isGenerating || isVerifying}
                      className="border-primary/30 hover:bg-primary/10"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating || isVerifying ? 'animate-spin' : ''}`} />
                      {isVerifying ? 'Verifying...' : t('newEmail')}
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tooltips.emailGenerator.refresh}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setCustomEmailDialog(true)}
                      className="border-accent/30 hover:bg-accent/10"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Custom
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tooltips.emailGenerator.custom}</p>
                </TooltipContent>
              </Tooltip>

              {/* QR Code Button with Modal */}
              {currentEmail && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <EmailQRCode email={currentEmail.address} />
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{tooltips.emailGenerator.qrCode}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      onClick={handleSave}
                      className="border-border hover:bg-secondary"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      {t('save')}
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tooltips.emailGenerator.save}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button 
                      variant={soundEnabled ? "outline" : "secondary"} 
                      size="lg"
                      onClick={toggleSound}
                      className={soundEnabled ? "border-border hover:bg-secondary" : ""}
                    >
                      <Volume2 className="w-4 h-4 mr-2" />
                      {t('sound')}
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tooltips.emailGenerator.sound}</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Expiration Timer */}
            {currentEmail && (
              <motion.div 
                className="flex flex-col items-center gap-2 mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <EmailExpiryTimer 
                        expiresAt={currentEmail.expires_at} 
                        onExpired={() => {
                          toast.info("Email expired. Generating a new one...");
                          refreshEmail();
                        }}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{tooltips.emailGenerator.timer}</p>
                  </TooltipContent>
                </Tooltip>
                {!user && (
                  <p className="text-xs text-muted-foreground">
                    <span className="text-primary cursor-pointer hover:underline" onClick={() => window.location.href = "/auth"}>
                      {t('signInToExtend')}
                    </span>
                  </p>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Domain Dialog */}
      <Dialog open={customDomainDialog} onOpenChange={setCustomDomainDialog}>
        <DialogContent className="glass-card border-border">
          <DialogHeader>
            <DialogTitle>Add Custom Domain</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Domain Name</label>
            <Input
              placeholder="@yourdomain.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="bg-secondary/50"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Note: Custom domains work for demo purposes. In production, DNS configuration would be required.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCustomDomainDialog(false)}>Cancel</Button>
            <Button onClick={handleAddCustomDomain} className="bg-gradient-to-r from-primary to-accent">Add Domain</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Email Dialog */}
      <Dialog open={customEmailDialog} onOpenChange={setCustomEmailDialog}>
        <DialogContent className="glass-card border-border">
          <DialogHeader>
            <DialogTitle>Create Custom Email Address</DialogTitle>
            <DialogDescription>
              Choose your own username for a personalized temporary email address
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Username</label>
              <Input
                placeholder="john.doe"
                value={customUsername}
                onChange={(e) => setCustomUsername(e.target.value.toLowerCase())}
                className="bg-secondary/50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Letters, numbers, dots, hyphens, and underscores only
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Domain</label>
              <Select 
                value={selectedCustomDomain || domains[0]?.id} 
                onValueChange={setSelectedCustomDomain}
              >
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  {domains.map((domain) => (
                    <SelectItem key={domain.id} value={domain.id}>
                      {domain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {customUsername && (
              <motion.div 
                className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl border border-primary/20"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="text-sm text-muted-foreground">Preview:</p>
                <p className="font-mono text-lg text-primary font-medium">
                  {customUsername}{domains.find(d => d.id === (selectedCustomDomain || domains[0]?.id))?.name || "@example.com"}
                </p>
              </motion.div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCustomEmailDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateCustomEmail} className="bg-gradient-to-r from-primary to-accent">Create Email</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default EmailGenerator;
