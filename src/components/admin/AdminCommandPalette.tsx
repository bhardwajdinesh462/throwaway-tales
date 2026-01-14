import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  Users,
  Globe,
  Mail,
  FileText,
  Palette,
  Newspaper,
  Cog,
  Paintbrush,
  Shield,
  Languages,
  Megaphone,
  ShieldCheck,
  Key,
  Clock,
  Database,
  MailOpen,
  UserCog,
  BarChart3,
  Wand2,
  LayoutList,
  CreditCard,
  Crown,
  Ban,
  FileWarning,
  Activity,
  Bell,
  HardDrive,
  Heart,
  DollarSign,
  Wrench,
  ArrowRight,
  Command,
  Plus,
  RefreshCw,
  Settings,
  ExternalLink,
  LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  action: () => void;
  category: string;
  keywords?: string[];
}

interface AdminCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminCommandPalette = ({ isOpen, onClose }: AdminCommandPaletteProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    { id: "nav-dashboard", title: "Go to Dashboard", icon: LayoutDashboard, action: () => navigate("/admin"), category: "Navigation", keywords: ["home", "main"] },
    { id: "nav-analytics", title: "Go to Analytics", icon: BarChart3, action: () => navigate("/admin/analytics"), category: "Navigation", keywords: ["stats", "metrics"] },
    { id: "nav-users", title: "Go to Users", icon: Users, action: () => navigate("/admin/users"), category: "Navigation", keywords: ["accounts", "members"] },
    { id: "nav-emails", title: "Go to Emails", icon: Mail, action: () => navigate("/admin/emails"), category: "Navigation", keywords: ["inbox", "messages"] },
    { id: "nav-domains", title: "Go to Domains", icon: Globe, action: () => navigate("/admin/domains"), category: "Navigation" },
    { id: "nav-blogs", title: "Go to Blogs", icon: Newspaper, action: () => navigate("/admin/blogs"), category: "Navigation", keywords: ["posts", "articles"] },
    { id: "nav-mailboxes", title: "Go to Mailboxes", icon: Mail, action: () => navigate("/admin/mailboxes"), category: "Navigation", keywords: ["imap", "smtp"] },
    { id: "nav-settings", title: "Go to Settings Overview", icon: LayoutList, action: () => navigate("/admin/settings-overview"), category: "Navigation" },
    { id: "nav-general", title: "Go to General Settings", icon: Settings, action: () => navigate("/admin/general-settings"), category: "Navigation" },
    { id: "nav-appearance", title: "Go to Appearance", icon: Paintbrush, action: () => navigate("/admin/appearance"), category: "Navigation", keywords: ["theme", "colors"] },
    { id: "nav-themes", title: "Go to Themes", icon: Palette, action: () => navigate("/admin/themes"), category: "Navigation" },
    { id: "nav-pages", title: "Go to Pages", icon: FileText, action: () => navigate("/admin/pages"), category: "Navigation" },
    { id: "nav-homepage", title: "Go to Homepage", icon: LayoutDashboard, action: () => navigate("/admin/homepage"), category: "Navigation" },
    { id: "nav-seo", title: "Go to SEO Settings", icon: Search, action: () => navigate("/admin/seo"), category: "Navigation", keywords: ["search", "optimization"] },
    { id: "nav-payments", title: "Go to Payments", icon: CreditCard, action: () => navigate("/admin/payments"), category: "Navigation", keywords: ["billing", "stripe"] },
    { id: "nav-subscriptions", title: "Go to Subscriptions", icon: Crown, action: () => navigate("/admin/subscriptions"), category: "Navigation", keywords: ["plans", "premium"] },
    { id: "nav-pricing", title: "Go to Pricing", icon: DollarSign, action: () => navigate("/admin/pricing"), category: "Navigation" },
    { id: "nav-admins", title: "Go to Admin Management", icon: Shield, action: () => navigate("/admin/admins"), category: "Navigation" },
    { id: "nav-smtp", title: "Go to SMTP Settings", icon: Cog, action: () => navigate("/admin/smtp"), category: "Navigation", keywords: ["email", "outgoing"] },
    { id: "nav-imap", title: "Go to IMAP Settings", icon: MailOpen, action: () => navigate("/admin/imap"), category: "Navigation", keywords: ["email", "incoming"] },
    { id: "nav-languages", title: "Go to Languages", icon: Languages, action: () => navigate("/admin/languages"), category: "Navigation", keywords: ["i18n", "translations"] },
    { id: "nav-user-settings", title: "Go to User Settings", icon: UserCog, action: () => navigate("/admin/user-settings"), category: "Navigation" },
    { id: "nav-registration", title: "Go to Registration", icon: Shield, action: () => navigate("/admin/registration"), category: "Navigation", keywords: ["signup"] },
    { id: "nav-alerts", title: "Go to Alerts", icon: Bell, action: () => navigate("/admin/alerts"), category: "Navigation", keywords: ["notifications"] },
    { id: "nav-maintenance", title: "Go to Maintenance", icon: Wrench, action: () => navigate("/admin/maintenance"), category: "Navigation" },
    { id: "nav-announcement", title: "Go to Announcement", icon: Megaphone, action: () => navigate("/admin/announcement"), category: "Navigation", keywords: ["banner"] },
    { id: "nav-audit-logs", title: "Go to Audit Logs", icon: Clock, action: () => navigate("/admin/audit-logs"), category: "Navigation", keywords: ["history"] },
    { id: "nav-email-logs", title: "Go to Email Logs", icon: FileWarning, action: () => navigate("/admin/email-logs"), category: "Navigation" },
    { id: "nav-error-logs", title: "Go to Error Logs", icon: FileWarning, action: () => navigate("/admin/error-logs"), category: "Navigation" },
    { id: "nav-ip-blocking", title: "Go to IP Blocking", icon: ShieldCheck, action: () => navigate("/admin/ip-blocking"), category: "Navigation", keywords: ["security"] },
    { id: "nav-email-blocking", title: "Go to Email Blocking", icon: Ban, action: () => navigate("/admin/email-blocking"), category: "Navigation" },
    { id: "nav-rate-limits", title: "Go to Rate Limits", icon: Clock, action: () => navigate("/admin/rate-limits"), category: "Navigation" },
    { id: "nav-api", title: "Go to API Settings", icon: Key, action: () => navigate("/admin/api"), category: "Navigation", keywords: ["keys", "tokens"] },
    { id: "nav-webhooks", title: "Go to Webhooks", icon: Globe, action: () => navigate("/admin/webhooks"), category: "Navigation" },
    { id: "nav-backup", title: "Go to Backup", icon: HardDrive, action: () => navigate("/admin/backup"), category: "Navigation" },
    { id: "nav-cache", title: "Go to Cache", icon: Database, action: () => navigate("/admin/cache"), category: "Navigation" },
    { id: "nav-cron", title: "Go to Cron Jobs", icon: Clock, action: () => navigate("/admin/cron"), category: "Navigation", keywords: ["scheduled", "tasks"] },
    { id: "nav-captcha", title: "Go to Captcha", icon: ShieldCheck, action: () => navigate("/admin/captcha"), category: "Navigation", keywords: ["recaptcha"] },
    { id: "nav-banners", title: "Go to Banners", icon: Megaphone, action: () => navigate("/admin/banners"), category: "Navigation", keywords: ["ads"] },
    { id: "nav-friendly", title: "Go to Friendly Websites", icon: Heart, action: () => navigate("/admin/friendly-websites"), category: "Navigation" },
    { id: "nav-donation", title: "Go to Donation Settings", icon: Heart, action: () => navigate("/admin/donation"), category: "Navigation" },
    { id: "nav-email-templates", title: "Go to Email Templates", icon: MailOpen, action: () => navigate("/admin/email-templates"), category: "Navigation" },
    { id: "nav-status", title: "Go to Status Settings", icon: Activity, action: () => navigate("/admin/status-settings"), category: "Navigation" },
    { id: "nav-mailbox-health", title: "Go to Mailbox Health", icon: Activity, action: () => navigate("/admin/mailbox-health"), category: "Navigation" },
    { id: "nav-deployment-health", title: "Go to Deployment Health", icon: Shield, action: () => navigate("/admin/deployment-health"), category: "Navigation" },
    
    // Quick Actions
    { id: "action-new-blog", title: "Create New Blog Post", icon: Plus, action: () => navigate("/admin/blogs", { state: { openNew: true } }), category: "Quick Actions", keywords: ["add", "write"] },
    { id: "action-new-domain", title: "Add New Domain", icon: Plus, action: () => navigate("/admin/domains", { state: { openNew: true } }), category: "Quick Actions", keywords: ["add"] },
    { id: "action-new-mailbox", title: "Add New Mailbox", icon: Plus, action: () => navigate("/admin/mailboxes", { state: { openNew: true } }), category: "Quick Actions", keywords: ["add"] },
    { id: "action-refresh", title: "Refresh Current Page", icon: RefreshCw, action: () => window.location.reload(), category: "Quick Actions", keywords: ["reload"] },
    { id: "action-back-site", title: "Back to Main Site", icon: ExternalLink, action: () => navigate("/"), category: "Quick Actions", keywords: ["exit", "leave"] },
  ], [navigate, t]);

  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;
    
    const searchLower = search.toLowerCase();
    return commands.filter(cmd => {
      const titleMatch = cmd.title.toLowerCase().includes(searchLower);
      const descMatch = cmd.description?.toLowerCase().includes(searchLower);
      const keywordMatch = cmd.keywords?.some(k => k.toLowerCase().includes(searchLower));
      const categoryMatch = cmd.category.toLowerCase().includes(searchLower);
      return titleMatch || descMatch || keywordMatch || categoryMatch;
    });
  }, [search, commands]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  const executeCommand = useCallback((command: CommandItem) => {
    command.action();
    onClose();
    setSearch("");
    setSelectedIndex(0);
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          setSearch("");
          setSelectedIndex(0);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, executeCommand, onClose]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-command-palette]")) {
        onClose();
        setSearch("");
        setSelectedIndex(0);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />

          {/* Command Palette */}
          <motion.div
            data-command-palette
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-[15%] -translate-x-1/2 z-50 w-full max-w-xl"
          >
            <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search commands..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-base placeholder:text-muted-foreground"
                  autoFocus
                />
                <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-mono bg-secondary border border-border rounded">
                  <span>esc</span>
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[400px] overflow-y-auto p-2">
                {filteredCommands.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No commands found</p>
                    <p className="text-sm">Try a different search term</p>
                  </div>
                ) : (
                  Object.entries(groupedCommands).map(([category, items]) => (
                    <div key={category} className="mb-4 last:mb-0">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {category}
                      </div>
                      {items.map((item) => {
                        flatIndex++;
                        const isSelected = flatIndex === selectedIndex;
                        const currentIndex = flatIndex;
                        
                        return (
                          <button
                            key={item.id}
                            onClick={() => executeCommand(item)}
                            onMouseEnter={() => setSelectedIndex(currentIndex)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                              isSelected
                                ? "bg-primary/10 text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                            )}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              isSelected ? "bg-primary/20" : "bg-secondary"
                            )}>
                              <item.icon className={cn(
                                "w-4 h-4",
                                isSelected ? "text-primary" : "text-muted-foreground"
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.title}</p>
                              {item.description && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <ArrowRight className="w-4 h-4 text-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-border bg-secondary/30">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded">↑</kbd>
                      <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded">↓</kbd>
                      <span>Navigate</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded">↵</kbd>
                      <span>Select</span>
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    <Command className="w-3 h-3" />
                    <span>+</span>
                    <kbd className="px-1.5 py-0.5 bg-secondary border border-border rounded">K</kbd>
                    <span>to toggle</span>
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AdminCommandPalette;
