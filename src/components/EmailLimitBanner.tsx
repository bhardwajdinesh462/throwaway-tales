import { motion } from 'framer-motion';
import { AlertTriangle, Clock, Crown, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';

interface EmailLimitBannerProps {
  used: number;
  limit: number;
  resetAt: Date | null;
  onUpgrade?: () => void;
}

const EmailLimitBanner = ({ used, limit, resetAt, onUpgrade }: EmailLimitBannerProps) => {
  const { telegramLink, telegramEnabled, hasPaidPaymentMethod } = usePaymentSettings();

  // Don't show for unlimited users
  if (limit === -1) return null;

  const remaining = Math.max(0, limit - used);
  const percentUsed = (used / limit) * 100;
  
  // Only show when 20% or less remaining
  if (remaining > limit * 0.2) return null;

  const formatTimeRemaining = () => {
    if (!resetAt) return '';
    const now = new Date();
    const diff = resetAt.getTime() - now.getTime();
    
    if (diff <= 0) return 'Resetting soon...';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m until reset`;
    }
    return `${minutes}m until reset`;
  };

  const isAtLimit = remaining === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border p-4 mb-4 ${
        isAtLimit 
          ? 'bg-destructive/10 border-destructive/50' 
          : 'bg-amber-500/10 border-amber-500/50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-full ${isAtLimit ? 'bg-destructive/20' : 'bg-amber-500/20'}`}>
          <AlertTriangle className={`w-5 h-5 ${isAtLimit ? 'text-destructive' : 'text-amber-500'}`} />
        </div>
        
        <div className="flex-1 space-y-3">
          <div>
            <h4 className={`font-semibold ${isAtLimit ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>
              {isAtLimit ? 'Daily Email Limit Reached!' : 'Running Low on Emails'}
            </h4>
            <p className="text-sm text-muted-foreground">
              {isAtLimit 
                ? 'You\'ve used all your daily temporary emails.' 
                : `Only ${remaining} email${remaining !== 1 ? 's' : ''} remaining today.`
              }
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{used} / {limit} emails used</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeRemaining()}
              </span>
            </div>
            <Progress value={percentUsed} className="h-2" />
          </div>

          <div className="flex flex-wrap gap-2">
            {hasPaidPaymentMethod && onUpgrade && (
              <Button size="sm" onClick={onUpgrade} className="gap-1">
                <Crown className="w-4 h-4" />
                Upgrade for Unlimited
              </Button>
            )}
            {telegramEnabled && (
              <Button 
                size="sm" 
                variant={hasPaidPaymentMethod ? "outline" : "default"}
                onClick={() => window.open(telegramLink, '_blank')}
                className="gap-1"
              >
                <MessageCircle className="w-4 h-4" />
                Contact on Telegram
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default EmailLimitBanner;
