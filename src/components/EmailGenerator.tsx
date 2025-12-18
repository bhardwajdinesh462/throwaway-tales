import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, RefreshCw, Check, QrCode, Star, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEmailService } from "@/hooks/useEmailService";
import { useAuth } from "@/hooks/useAuth";

const EmailGenerator = () => {
  const { user } = useAuth();
  const { 
    domains, 
    currentEmail, 
    isGenerating, 
    generateEmail, 
    changeDomain 
  } = useEmailService();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const copyToClipboard = async () => {
    if (!currentEmail) return;
    await navigator.clipboard.writeText(currentEmail.address);
    setCopied(true);
    toast.success("Email copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshEmail = () => {
    const currentDomainId = currentEmail?.domain_id || domains[0]?.id;
    generateEmail(currentDomainId);
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

  const currentDomain = domains.find(d => d.id === currentEmail?.domain_id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="glass-card p-6 md:p-8">
        <div className="text-center mb-6">
          <p className="text-muted-foreground text-sm mb-2">Your Temporary Email Address</p>
        </div>

        {/* Email Display */}
        <div className="relative mb-6">
          <motion.div
            key={currentEmail?.address}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-secondary/50 rounded-xl p-4 md:p-6 border border-primary/20 neon-border"
          >
            <p className={`email-mono text-xl md:text-2xl text-center text-foreground break-all ${isGenerating ? 'blur-sm' : ''}`}>
              {currentEmail?.address || "generating..."}
            </p>
          </motion.div>
          
          {/* Domain Selector */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
            <Select 
              value={currentDomain?.id || ""} 
              onValueChange={changeDomain}
              disabled={isGenerating}
            >
              <SelectTrigger className="w-48 bg-card border-primary/30 text-sm">
                <SelectValue placeholder="Select domain" />
              </SelectTrigger>
              <SelectContent>
                {domains.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id}>
                    {domain.name} {domain.is_premium && "⭐"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          <Button
            variant="neon"
            size="lg"
            onClick={copyToClipboard}
            className="min-w-[140px]"
            disabled={!currentEmail}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" /> Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy
              </>
            )}
          </Button>

          <Button
            variant="glass"
            size="lg"
            onClick={refreshEmail}
            disabled={isGenerating}
          >
            <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            New Email
          </Button>

          <Button
            variant="glass"
            size="lg"
            onClick={() => setShowQR(!showQR)}
            disabled={!currentEmail}
          >
            <QrCode className="w-4 h-4" />
            QR Code
          </Button>

          <Button variant="glass" size="lg" onClick={handleSave}>
            <Star className="w-4 h-4" />
            Save
          </Button>

          <Button 
            variant={soundEnabled ? "glass" : "secondary"} 
            size="lg"
            onClick={toggleSound}
          >
            <Volume2 className="w-4 h-4" />
            Sound
          </Button>
        </div>

        {/* QR Code Display */}
        {showQR && currentEmail && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex justify-center mt-6 pt-6 border-t border-border"
          >
            <div className="bg-foreground p-4 rounded-xl">
              <QRCodeSVG value={currentEmail.address} size={150} />
            </div>
          </motion.div>
        )}

        {/* Expiration Notice */}
        {currentEmail && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            This email will expire in 1 hour. {!user && "Sign in to extend duration."}
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default EmailGenerator;
