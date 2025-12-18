import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, RefreshCw, Check, QrCode, Star, Volume2, Plus, Edit2, Sparkles } from "lucide-react";
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
import { useAuth } from "@/hooks/useSupabaseAuth";
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

    const domain = domains.find(d => d.id === domainId);
    if (domain) {
      const customEmails = JSON.parse(localStorage.getItem("nullsto_temp_emails") || "[]");
      const newEmail = {
        id: `custom_${Date.now()}`,
        user_id: user?.id || null,
        address: `${customUsername}${domain.name}`,
        domain_id: domainId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
        is_custom: true,
        created_at: new Date().toISOString(),
      };
      customEmails.push(newEmail);
      localStorage.setItem("nullsto_temp_emails", JSON.stringify(customEmails));
      
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
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.4 }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="relative">
        {/* Decorative Elements */}
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-accent/10 rounded-full blur-2xl" />
        
        <div className="glass-card p-8 md:p-10 relative overflow-hidden">
          {/* Animated Border */}
          <div className="absolute inset-0 rounded-xl">
            <motion.div
              className="absolute inset-0 rounded-xl"
              style={{
                background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))",
                backgroundSize: "200% 100%",
              }}
              animate={{
                backgroundPosition: ["0% 0%", "200% 0%"],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
            />
            <div className="absolute inset-[1px] rounded-xl bg-card" />
          </div>
          
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
                    {currentEmail?.address || "generating..."}
                  </motion.p>
                </div>
              </motion.div>
              
              {/* Domain Selector */}
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <Select 
                  value={currentDomain?.id || ""} 
                  onValueChange={changeDomain}
                  disabled={isGenerating}
                >
                  <SelectTrigger className="w-52 bg-card border-primary/30 text-sm shadow-lg">
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
                    variant="secondary"
                    size="icon"
                    onClick={() => setCustomDomainDialog(true)}
                    className="shadow-lg"
                    title="Add custom domain"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap justify-center gap-3 mt-10">
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

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={refreshEmail}
                  disabled={isGenerating}
                  className="border-primary/30 hover:bg-primary/10"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                  {t('newEmail')}
                </Button>
              </motion.div>

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

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowQR(!showQR)}
                  disabled={!currentEmail}
                  className="border-border hover:bg-secondary"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  {t('qrCode')}
                </Button>
              </motion.div>

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
            </div>

            {/* QR Code Display */}
            <AnimatePresence>
              {showQR && currentEmail && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex justify-center mt-8 pt-8 border-t border-border/50"
                >
                  <motion.div 
                    className="bg-white p-4 rounded-2xl shadow-2xl"
                    initial={{ scale: 0.8, rotate: -5 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <QRCodeSVG value={currentEmail.address} size={160} />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Expiration Notice */}
            {currentEmail && (
              <motion.p 
                className="text-center text-xs text-muted-foreground mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                {t('expiresIn')} {!user && <span className="text-primary cursor-pointer hover:underline">{t('signInToExtend')}</span>}
              </motion.p>
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
