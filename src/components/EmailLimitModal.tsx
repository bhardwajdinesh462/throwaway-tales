import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, Crown, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface EmailLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  resetAt: Date | null;
  limit: number;
}

interface LimitModalConfig {
  enabled: boolean;
  title: string;
  description: string;
  ctaText: string;
  showTimer: boolean;
  showBenefits: boolean;
  theme: 'default' | 'urgent' | 'friendly';
}

const defaultConfig: LimitModalConfig = {
  enabled: true,
  title: 'Daily Limit Reached',
  description: "You've used all {limit} temporary emails for today",
  ctaText: 'Upgrade Now',
  showTimer: true,
  showBenefits: true,
  theme: 'default',
};

const EmailLimitModal = ({ isOpen, onClose, resetAt, limit }: EmailLimitModalProps) => {
  const navigate = useNavigate();
  const { 
    telegramLink, 
    telegramEnabled, 
    hasPaidPaymentMethod 
  } = usePaymentSettings();
  const [timeRemaining, setTimeRemaining] = useState('');
  const [config, setConfig] = useState<LimitModalConfig>(defaultConfig);

  // Load modal config from database
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'limit_modal_config')
          .maybeSingle();
        
        if (data?.value && typeof data.value === 'object') {
          setConfig({ ...defaultConfig, ...data.value as Partial<LimitModalConfig> });
        }
      } catch (err) {
        console.error('Failed to load limit modal config:', err);
      }
    };
    loadConfig();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('limit_modal_config')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.limit_modal_config'
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'value' in payload.new) {
            const newValue = payload.new.value;
            if (newValue && typeof newValue === 'object') {
              setConfig({ ...defaultConfig, ...newValue as Partial<LimitModalConfig> });
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Update countdown timer
  useEffect(() => {
    if (!resetAt || !isOpen) return;

    const updateTimer = () => {
      const now = new Date();
      const diff = resetAt.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeRemaining('Resetting now...');
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [resetAt, isOpen]);

  const handleUpgrade = () => {
    navigate('/pricing');
    onClose();
  };

  // If modal is disabled in admin settings, don't render
  if (!config.enabled) {
    return null;
  }

  // Get theme-specific styles
  const getThemeStyles = () => {
    switch (config.theme) {
      case 'urgent':
        return {
          headerBg: 'bg-gradient-to-br from-red-500/30 to-orange-500/30',
          iconBg: 'bg-red-500/30',
          iconColor: 'text-red-500',
        };
      case 'friendly':
        return {
          headerBg: 'bg-gradient-to-br from-blue-500/20 to-purple-500/20',
          iconBg: 'bg-blue-500/20',
          iconColor: 'text-blue-500',
        };
      default:
        return {
          headerBg: 'bg-gradient-to-br from-destructive/20 to-amber-500/20',
          iconBg: 'bg-destructive/20',
          iconColor: 'text-destructive',
        };
    }
  };

  const themeStyles = getThemeStyles();
  const displayDescription = config.description.replace('{limit}', String(limit));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - Higher z-index */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/90 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />

          {/* Modal - Higher z-index, centered properly */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-md p-4"
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className={`relative p-6 ${themeStyles.headerBg} border-b border-border`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 text-foreground hover:bg-background/20"
                  onClick={onClose}
                >
                  <X className="w-5 h-5" />
                </Button>

                <div className="flex flex-col items-center text-center">
                  <div className={`p-4 rounded-full ${themeStyles.iconBg} mb-4`}>
                    <AlertTriangle className={`w-10 h-10 ${themeStyles.iconColor}`} />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">
                    {config.title}
                  </h2>
                  <p className="text-muted-foreground mt-2">
                    {displayDescription}
                  </p>
                </div>
              </div>

              {/* Countdown Timer */}
              {config.showTimer && (
                <div className="p-6 border-b border-border bg-secondary/30">
                  <div className="flex items-center justify-center gap-3">
                    <Clock className="w-5 h-5 text-primary" />
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Limit resets in</p>
                      <p className="text-2xl font-bold font-mono text-primary">{timeRemaining}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upgrade Options */}
              <div className="p-6 space-y-4">
                {/* Always show a primary CTA button */}
                <div className="space-y-3">
                  {/* Primary CTA: Always visible */}
                  {hasPaidPaymentMethod ? (
                    <Button 
                      onClick={handleUpgrade} 
                      className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
                      size="lg"
                    >
                      <Crown className="w-5 h-5" />
                      {config.ctaText}
                    </Button>
                  ) : telegramEnabled ? (
                    <Button
                      onClick={() => window.open(telegramLink, '_blank')}
                      className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
                      size="lg"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Upgrade via Telegram
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleUpgrade} 
                      className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
                      size="lg"
                    >
                      <Crown className="w-5 h-5" />
                      View Plans
                    </Button>
                  )}

                  {/* Secondary CTA: Show Telegram if paid method is primary */}
                  {hasPaidPaymentMethod && telegramEnabled && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(telegramLink, '_blank')}
                      className="w-full gap-2 border-border text-foreground hover:bg-secondary"
                      size="lg"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Contact on Telegram
                    </Button>
                  )}
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Get unlimited emails instantly after upgrading
                </p>

                {/* Premium Benefits */}
                {config.showBenefits && (
                  <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2 text-foreground">
                      <Crown className="w-4 h-4 text-primary" />
                      Premium Benefits
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>✓ Unlimited temporary emails</li>
                      <li>✓ Extended email expiry (24h+)</li>
                      <li>✓ Email forwarding</li>
                      <li>✓ Custom domains</li>
                      <li>✓ Priority support</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default EmailLimitModal;
