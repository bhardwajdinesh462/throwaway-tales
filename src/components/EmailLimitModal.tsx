import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, Crown, MessageCircle, CreditCard, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';
import { useNavigate } from 'react-router-dom';

interface EmailLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  resetAt: Date | null;
  limit: number;
}

const EmailLimitModal = ({ isOpen, onClose, resetAt, limit }: EmailLimitModalProps) => {
  const navigate = useNavigate();
  const { 
    telegramLink, 
    telegramEnabled, 
    stripeEnabled, 
    paypalEnabled,
    hasPaidPaymentMethod 
  } = usePaymentSettings();
  const [timeRemaining, setTimeRemaining] = useState('');

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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-4"
          >
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="relative p-6 bg-gradient-to-br from-destructive/20 to-amber-500/20 border-b border-border">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4"
                  onClick={onClose}
                >
                  <X className="w-5 h-5" />
                </Button>

                <div className="flex flex-col items-center text-center">
                  <div className="p-4 rounded-full bg-destructive/20 mb-4">
                    <AlertTriangle className="w-10 h-10 text-destructive" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">
                    Daily Limit Reached
                  </h2>
                  <p className="text-muted-foreground mt-2">
                    You've used all {limit} temporary emails for today
                  </p>
                </div>
              </div>

              {/* Countdown Timer */}
              <div className="p-6 border-b border-border bg-secondary/30">
                <div className="flex items-center justify-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Limit resets in</p>
                    <p className="text-2xl font-bold font-mono text-primary">{timeRemaining}</p>
                  </div>
                </div>
              </div>

              {/* Upgrade Options */}
              <div className="p-6 space-y-4">
                {/* Always show a primary CTA button */}
                <div className="space-y-3">
                  {/* Primary CTA: Always visible */}
                  {hasPaidPaymentMethod ? (
                    <Button 
                      onClick={handleUpgrade} 
                      className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                      size="lg"
                    >
                      <Crown className="w-5 h-5" />
                      Upgrade Now
                    </Button>
                  ) : telegramEnabled ? (
                    <Button
                      onClick={() => window.open(telegramLink, '_blank')}
                      className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                      size="lg"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Upgrade via Telegram
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleUpgrade} 
                      className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
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
                      className="w-full gap-2"
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

                {/* Tier comparison */}
                <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
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
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default EmailLimitModal;
