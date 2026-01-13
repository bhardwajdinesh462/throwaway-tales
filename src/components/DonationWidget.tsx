import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Copy, Check, ChevronDown, ChevronUp, QrCode, Server, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

const USDT_ADDRESS = "TSssRNtfSiDL9H8yo9hDdFiDuJURoY9LJg";

interface DonationWidgetProps {
  variant?: 'compact' | 'full';
}

const DonationWidget = ({ variant = 'full' }: DonationWidgetProps) => {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(USDT_ADDRESS);
      setCopied(true);
      toast.success("Address copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy address");
    }
  };

  // Compact variant - just a small pill button
  if (variant === 'compact') {
    return (
      <>
        <motion.button
          onClick={() => setExpanded(!expanded)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/20 hover:border-red-500/40 transition-all"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
          >
            <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" fill="currentColor" />
          </motion.div>
          <span className="text-[10px] sm:text-xs font-medium text-red-400 hidden xs:inline">Support</span>
        </motion.button>

        {/* Expanded modal overlay */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setExpanded(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-sm"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 z-10 h-8 w-8 rounded-full bg-background border border-border"
                  onClick={() => setExpanded(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
                <DonationWidgetContent
                  copied={copied}
                  showQR={showQR}
                  setShowQR={setShowQR}
                  handleCopy={handleCopy}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Full variant
  return (
    <DonationWidgetContent
      copied={copied}
      showQR={showQR}
      setShowQR={setShowQR}
      handleCopy={handleCopy}
    />
  );
};

// Shared content component for both variants
interface DonationWidgetContentProps {
  copied: boolean;
  showQR: boolean;
  setShowQR: (show: boolean) => void;
  handleCopy: () => void;
}

const DonationWidgetContent = ({ copied, showQR, setShowQR, handleCopy }: DonationWidgetContentProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-3 sm:p-4"
  >
    {/* Animated border glow */}
    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 opacity-50 blur-xl -z-10 animate-pulse" />
    
    {/* Content */}
    <div className="relative z-10">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
          className="p-1.5 sm:p-2 rounded-full bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-red-500/30"
        >
          <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" fill="currentColor" />
        </motion.div>
        <div>
          <h3 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-1 sm:gap-2">
            Support Nullsto
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500" />
          </h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Help keep this free service running</p>
        </div>
      </div>

      {/* Message */}
      <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 leading-relaxed">
        Your donation helps us upgrade to <span className="text-primary font-medium inline-flex items-center gap-1"><Server className="w-3 h-3" />dedicated servers</span> and keep Nullsto free for everyone.
      </p>

      {/* USDT Address */}
      <div className="space-y-1.5 sm:space-y-2">
        <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground">
          <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-[#26A17B] flex items-center justify-center">
            <span className="text-[6px] sm:text-[8px] font-bold text-white">₮</span>
          </div>
          <span className="font-medium">USDT (TRC20)</span>
        </div>
        
        <div 
          onClick={handleCopy}
          className="group flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-secondary/50 border border-border hover:border-primary/50 cursor-pointer transition-all hover:bg-secondary/80"
        >
          <code className="flex-1 text-[9px] sm:text-xs font-mono text-foreground break-all select-all">
            {USDT_ADDRESS}
          </code>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 sm:h-8 sm:w-8 shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
          >
            {copied ? (
              <Check className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* QR Code Toggle */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full mt-2 sm:mt-3 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground h-7 sm:h-8"
        onClick={() => setShowQR(!showQR)}
      >
        <QrCode className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
        <span className="hidden xs:inline">{showQR ? "Hide QR Code" : "Show QR Code"}</span>
        <span className="xs:hidden">QR</span>
        {showQR ? <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4 ml-1" /> : <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />}
      </Button>

      {/* QR Code */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex justify-center pt-3 sm:pt-4">
              <div className="p-2 sm:p-3 bg-white rounded-xl shadow-lg">
                <QRCodeSVG
                  value={USDT_ADDRESS}
                  size={100}
                  level="H"
                  includeMargin={false}
                  className="sm:w-[140px] sm:h-[140px]"
                />
              </div>
            </div>
            <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-2">
              Scan with your wallet app
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-border/50 flex items-center justify-center gap-2">
        <motion.span 
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-green-500"
        >
          💚
        </motion.span>
        <span className="text-[10px] sm:text-xs text-muted-foreground">Every contribution matters!</span>
      </div>
    </div>
  </motion.div>
);

export default DonationWidget;
