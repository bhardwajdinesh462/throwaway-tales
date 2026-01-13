import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Copy, Check, ChevronDown, ChevronUp, QrCode, Server, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

const USDT_ADDRESS = "TSssRNtfSiDL9H8yo9hDdFiDuJURoY9LJg";

const DonationWidget = () => {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 my-4"
    >
      {/* Animated border glow */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 opacity-50 blur-xl -z-10 animate-pulse" />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
            className="p-2 rounded-full bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-red-500/30"
          >
            <Heart className="w-5 h-5 text-red-500" fill="currentColor" />
          </motion.div>
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              Support Nullsto
              <Sparkles className="w-4 h-4 text-yellow-500" />
            </h3>
            <p className="text-xs text-muted-foreground">Help keep this free service running</p>
          </div>
        </div>

        {/* Message */}
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Your donation helps us upgrade to <span className="text-primary font-medium inline-flex items-center gap-1"><Server className="w-3 h-3" />dedicated servers</span> and keep Nullsto free for everyone.
        </p>

        {/* USDT Address */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-4 h-4 rounded-full bg-[#26A17B] flex items-center justify-center">
              <span className="text-[8px] font-bold text-white">₮</span>
            </div>
            <span className="font-medium">USDT (TRC20)</span>
          </div>
          
          <div 
            onClick={handleCopy}
            className="group flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border hover:border-primary/50 cursor-pointer transition-all hover:bg-secondary/80"
          >
            <code className="flex-1 text-xs font-mono text-foreground break-all select-all">
              {USDT_ADDRESS}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* QR Code Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowQR(!showQR)}
        >
          <QrCode className="w-4 h-4 mr-2" />
          {showQR ? "Hide QR Code" : "Show QR Code"}
          {showQR ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
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
              <div className="flex justify-center pt-4">
                <div className="p-3 bg-white rounded-xl shadow-lg">
                  <QRCodeSVG
                    value={USDT_ADDRESS}
                    size={140}
                    level="H"
                    includeMargin={false}
                  />
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-2">
                Scan with your wallet app
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-center gap-2">
          <motion.span 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-green-500"
          >
            💚
          </motion.span>
          <span className="text-xs text-muted-foreground">Every contribution matters!</span>
        </div>
      </div>
    </motion.div>
  );
};

export default DonationWidget;
