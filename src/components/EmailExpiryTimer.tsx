import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, AlertCircle } from "lucide-react";

interface EmailExpiryTimerProps {
  expiresAt: string;
  onExpired?: () => void;
}

const EmailExpiryTimer = ({ expiresAt, onExpired }: EmailExpiryTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const difference = expiry - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft(null);
        onExpired?.();
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  if (isExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-destructive/20 border border-destructive/30 rounded-full"
      >
        <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive flex-shrink-0" />
        <span className="text-xs sm:text-sm font-medium text-destructive whitespace-nowrap">Expired</span>
      </motion.div>
    );
  }

  if (!timeLeft) return null;

  const isLowTime = timeLeft.hours === 0 && timeLeft.minutes < 15;
  const isCritical = timeLeft.hours === 0 && timeLeft.minutes < 5;

  const formatNumber = (num: number) => num.toString().padStart(2, '0');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-full border transition-colors ${
        isCritical
          ? 'bg-destructive/20 border-destructive/30'
          : isLowTime
          ? 'bg-amber-500/20 border-amber-500/30'
          : 'bg-primary/10 border-primary/20'
      }`}
    >
      <Clock className={`w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 ${
        isCritical 
          ? 'text-destructive' 
          : isLowTime 
          ? 'text-amber-500' 
          : 'text-primary'
      }`} />
      <div className="flex items-center gap-0.5 sm:gap-1 font-mono text-xs sm:text-sm font-medium">
        <TimeUnit value={timeLeft.hours} label="h" isCritical={isCritical} isLowTime={isLowTime} />
        <span className={isCritical ? 'text-destructive' : isLowTime ? 'text-amber-500' : 'text-muted-foreground'}>:</span>
        <TimeUnit value={timeLeft.minutes} label="m" isCritical={isCritical} isLowTime={isLowTime} />
        <span className={isCritical ? 'text-destructive' : isLowTime ? 'text-amber-500' : 'text-muted-foreground'}>:</span>
        <TimeUnit value={timeLeft.seconds} label="s" isCritical={isCritical} isLowTime={isLowTime} />
      </div>
      <span className={`hidden sm:inline text-xs ${
        isCritical 
          ? 'text-destructive' 
          : isLowTime 
          ? 'text-amber-500' 
          : 'text-muted-foreground'
      }`}>
        remaining
      </span>
    </motion.div>
  );
};

const TimeUnit = ({ 
  value, 
  label, 
  isCritical, 
  isLowTime 
}: { 
  value: number; 
  label: string; 
  isCritical: boolean; 
  isLowTime: boolean;
}) => {
  const colorClass = isCritical 
    ? 'text-destructive' 
    : isLowTime 
    ? 'text-amber-500' 
    : 'text-foreground';

  return (
    <motion.span
      key={value}
      initial={{ opacity: 0.5, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={colorClass}
    >
      {value.toString().padStart(2, '0')}
    </motion.span>
  );
};

export default EmailExpiryTimer;
