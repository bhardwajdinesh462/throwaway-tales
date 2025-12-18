import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, RefreshCw, Check, QrCode, Star, Volume2, Plus, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
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
import { useEmailService } from "@/hooks/useLocalEmailService";
import { useAuth } from "@/hooks/useLocalAuth";
import { useLanguage } from "@/contexts/LanguageContext";

const EmailGenerator = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { 
    domains, 
    currentEmail, 
    isGenerating, 
    generateEmail, 
    changeDomain,
    addCustomDomain,
  } = useEmailService();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [customDomainDialog, setCustomDomainDialog] = useState(false);
  const [customEmailDialog, setCustomEmailDialog] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [customUsername, setCustomUsername] = useState("");
  const [selectedCustomDomain, setSelectedCustomDomain] = useState("");

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

  const handleAddCustomDomain = () => {
    if (addCustomDomain(newDomain)) {
      setNewDomain("");
      setCustomDomainDialog(false);
    }
  };

  const handleCreateCustomEmail = () => {
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

    // Create custom email using the email service
    const domain = domains.find(d => d.id === domainId);
    if (domain) {
      // Store custom email in localStorage
      const customEmails = JSON.parse(localStorage.getItem("nullsto_temp_emails") || "[]");
      const newEmail = {
        id: `custom_${Date.now()}`,
        user_id: user?.id || null,
        address: `${customUsername}${domain.name}`,
        domain_id: domainId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        is_active: true,
        is_custom: true,
        created_at: new Date().toISOString(),
      };
      customEmails.push(newEmail);
      localStorage.setItem("nullsto_temp_emails", JSON.stringify(customEmails));
      
      // Trigger reload
      generateEmail(domainId);
      toast.success(`Custom email created: ${customUsername}${domain.name}`);
    }

    setCustomUsername("");
    setSelectedCustomDomain("");
    setCustomEmailDialog(false);
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
          <p className="text-muted-foreground text-sm mb-2">{t('yourTempEmail')}</p>
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
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
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
                    {domain.name} {domain.is_premium && "⭐"} {domain.is_custom && "🔧"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCustomDomainDialog(true)}
                title="Add custom domain"
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
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
                <Check className="w-4 h-4" /> {t('copied')}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> {t('copy')}
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
            {t('newEmail')}
          </Button>

          <Button
            variant="glass"
            size="lg"
            onClick={() => setCustomEmailDialog(true)}
            title="Create custom email address"
          >
            <Edit2 className="w-4 h-4" />
            Custom
          </Button>

          <Button
            variant="glass"
            size="lg"
            onClick={() => setShowQR(!showQR)}
            disabled={!currentEmail}
          >
            <QrCode className="w-4 h-4" />
            {t('qrCode')}
          </Button>

          <Button variant="glass" size="lg" onClick={handleSave}>
            <Star className="w-4 h-4" />
            {t('save')}
          </Button>

          <Button 
            variant={soundEnabled ? "glass" : "secondary"} 
            size="lg"
            onClick={toggleSound}
          >
            <Volume2 className="w-4 h-4" />
            {t('sound')}
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
            {t('expiresIn')} {!user && t('signInToExtend')}
          </p>
        )}
      </div>

      {/* Custom Domain Dialog */}
      <Dialog open={customDomainDialog} onOpenChange={setCustomDomainDialog}>
        <DialogContent>
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
            <Button variant="neon" onClick={handleAddCustomDomain}>Add Domain</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Email Dialog */}
      <Dialog open={customEmailDialog} onOpenChange={setCustomEmailDialog}>
        <DialogContent>
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
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Preview:</p>
                <p className="font-mono text-primary">
                  {customUsername}{domains.find(d => d.id === (selectedCustomDomain || domains[0]?.id))?.name || "@example.com"}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCustomEmailDialog(false)}>Cancel</Button>
            <Button variant="neon" onClick={handleCreateCustomEmail}>Create Email</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default EmailGenerator;
