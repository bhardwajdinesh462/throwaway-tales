import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useMemo, useCallback } from "react";
import {
  LayoutDashboard,
  Users,
  Globe,
  Mail,
  Settings,
  ArrowLeft,
  FileText,
  Palette,
  Newspaper,
  Link as LinkIcon,
  Cog,
  Paintbrush,
  Shield,
  Search,
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
  X,
  Bell,
  HardDrive,
  Heart,
  Edit3,
  Check,
  LucideIcon,
  DollarSign,
  Wrench,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebarIcons } from "@/hooks/useSidebarIcons";
import FontAwesomeIconPicker from "@/components/admin/FontAwesomeIconPicker";
import { toast } from "sonner";
import { usePrefetchAdmin } from "@/hooks/usePrefetchAdmin";

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { t } = useLanguage();
  const collapsed = state === "collapsed";
  const [searchQuery, setSearchQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const { icons, setIcon, getIcon, isSaving } = useSidebarIcons();
  const { prefetchRoute } = usePrefetchAdmin();

  const mainMenuItems: MenuItem[] = [
    { title: t('dashboard'), url: "/admin", icon: LayoutDashboard },
    { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
    { title: t('users'), url: "/admin/users", icon: Users },
    { title: t('emails'), url: "/admin/emails", icon: Mail },
  ];

  const domainMenuItems: MenuItem[] = [
    { title: t('domains'), url: "/admin/domains", icon: Globe },
    { title: "Custom Domains", url: "/admin/custom-domains", icon: LinkIcon },
  ];

  const contentMenuItems: MenuItem[] = [
    { title: "Homepage", url: "/admin/homepage", icon: LayoutDashboard },
    { title: t('blogs'), url: "/admin/blogs", icon: Newspaper },
    { title: t('pages'), url: "/admin/pages", icon: FileText },
    { title: "Email Templates", url: "/admin/email-templates", icon: MailOpen },
    { title: "Friendly Sites", url: "/admin/friendly-websites", icon: Heart },
  ];

  const settingsMenuItems: MenuItem[] = [
    { title: "Overview", url: "/admin/settings-overview", icon: LayoutList },
    { title: "General", url: "/admin/general-settings", icon: Settings },
    { title: "Appearance", url: "/admin/appearance", icon: Paintbrush },
    { title: t('themes'), url: "/admin/themes", icon: Palette },
    { title: "User & Guest", url: "/admin/user-settings", icon: UserCog },
    { title: "Registration", url: "/admin/registration", icon: Shield },
    { title: "Payments", url: "/admin/payments", icon: CreditCard },
    { title: "Subscriptions", url: "/admin/subscriptions", icon: Crown },
    { title: "Pricing", url: "/admin/pricing", icon: DollarSign },
    { title: "Email Restrictions", url: "/admin/email-restrictions", icon: Ban },
    { title: "Admins", url: "/admin/admins", icon: Shield },
    { title: "Email Setup", url: "/admin/email-setup", icon: Wand2 },
    { title: "SMTP", url: "/admin/smtp", icon: Cog },
    { title: "IMAP", url: "/admin/imap", icon: MailOpen },
    { title: "Mailboxes", url: "/admin/mailboxes", icon: Mail },
    { title: "SEO", url: "/admin/seo", icon: Search },
    { title: "Blog Settings", url: "/admin/blog-settings", icon: Newspaper },
    { title: "Languages", url: "/admin/languages", icon: Languages },
  ];

  const advancedMenuItems: MenuItem[] = [
    { title: "Alerts", url: "/admin/alerts", icon: Bell },
    { title: "Maintenance", url: "/admin/maintenance", icon: Wrench },
    { title: "Announcement", url: "/admin/announcement", icon: Megaphone },
    { title: "Status Settings", url: "/admin/status-settings", icon: Activity },
    { title: "Mailbox Health", url: "/admin/mailbox-health", icon: Activity },
    { title: "Deployment Health", url: "/admin/deployment-health", icon: Shield },
    { title: "Email Logs", url: "/admin/email-logs", icon: FileWarning },
    { title: "Error Logs", url: "/admin/error-logs", icon: FileWarning },
    { title: "Webhooks", url: "/admin/webhooks", icon: Globe },
    { title: "Audit Logs", url: "/admin/audit-logs", icon: Clock },
    { title: "IP Blocking", url: "/admin/ip-blocking", icon: ShieldCheck },
    { title: "Email Blocking", url: "/admin/email-blocking", icon: Ban },
    { title: "Registration IPs", url: "/admin/registration-ips", icon: Globe },
    { title: "Rate Limits", url: "/admin/rate-limits", icon: Clock },
    { title: "Role Approvals", url: "/admin/role-approvals", icon: ShieldCheck },
    { title: "Advanced", url: "/admin/advanced", icon: Cog },
    { title: "Banners", url: "/admin/banners", icon: Megaphone },
    { title: "Ads", url: "/admin/ads", icon: Megaphone },
    { title: "Captcha", url: "/admin/captcha", icon: ShieldCheck },
    { title: "API", url: "/admin/api", icon: Key },
    { title: "Cron Jobs", url: "/admin/cron", icon: Clock },
    { title: "Cache", url: "/admin/cache", icon: Database },
    { title: "Backup", url: "/admin/backup", icon: HardDrive },
  ];

  // Combine all menu items for search
  const allMenuItems = useMemo(() => [
    ...mainMenuItems.map(item => ({ ...item, group: "Main" })),
    ...domainMenuItems.map(item => ({ ...item, group: "Domains" })),
    ...contentMenuItems.map(item => ({ ...item, group: "Content" })),
    ...settingsMenuItems.map(item => ({ ...item, group: "Settings" })),
    ...advancedMenuItems.map(item => ({ ...item, group: "Advanced" })),
  ], [t]);

  // Filter menu items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return allMenuItems.filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, allMenuItems]);

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  const handleIconSelect = useCallback(async (url: string, iconClass: string) => {
    const success = await setIcon(url, iconClass);
    if (success) {
      toast.success("Icon updated");
    } else {
      toast.error("Failed to update icon");
    }
    setEditingUrl(null);
  }, [setIcon]);

  const renderIcon = (item: MenuItem) => {
    const customIcon = getIcon(item.url);
    
    if (customIcon) {
      return <i className={`${customIcon} w-4 h-4`} />;
    }
    
    return <item.icon className="w-4 h-4" />;
  };

  const renderMenuItems = (items: MenuItem[]) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton asChild>
            {editMode ? (
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer",
                  "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  editingUrl === item.url && "ring-2 ring-primary"
                )}
                onClick={() => setEditingUrl(item.url)}
              >
                <FontAwesomeIconPicker
                  value={getIcon(item.url) || ""}
                  onChange={(iconClass) => handleIconSelect(item.url, iconClass)}
                  trigger={
                    <div className="relative group">
                      {renderIcon(item)}
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit3 className="w-2 h-2 text-primary-foreground" />
                      </div>
                    </div>
                  }
                />
                {!collapsed && <span className="text-sm">{item.title}</span>}
              </div>
            ) : (
              <NavLink
                to={item.url}
                end={item.url === "/admin"}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  isActive(item.url)
                    ? "bg-primary/20 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                onMouseEnter={() => prefetchRoute(item.url)}
                onFocus={() => prefetchRoute(item.url)}
              >
                {renderIcon(item)}
                {!collapsed && <span className="text-sm">{item.title}</span>}
              </NavLink>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  const handleSearchSelect = (url: string) => {
    setSearchQuery("");
    navigate(url);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Mail className="w-4 h-4 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <p className="font-semibold text-foreground">Nullsto</p>
                <p className="text-xs text-muted-foreground">{t('adminPanel')}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <Button
              variant={editMode ? "default" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setEditMode(!editMode)}
              title={editMode ? "Done editing" : "Edit icons"}
            >
              {editMode ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            </Button>
          )}
        </div>

        {/* Edit Mode Banner */}
        {!collapsed && editMode && (
          <div className="mt-2 p-2 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-xs text-primary text-center">
              Click any icon to change it
            </p>
          </div>
        )}

        {/* Search Box */}
        {!collapsed && !editMode && (
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 bg-secondary/50 border-border/50 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-secondary rounded"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}

            {/* Search Results Dropdown */}
            <AnimatePresence>
              {filteredItems && filteredItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
                >
                  {filteredItems.map((item) => (
                    <button
                      key={item.url}
                      onClick={() => handleSearchSelect(item.url)}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-secondary/80 transition-colors",
                        isActive(item.url) && "bg-primary/10"
                      )}
                    >
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.group}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
              {filteredItems && filteredItems.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 p-3 text-center"
                >
                  <p className="text-sm text-muted-foreground">No results found</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="h-[calc(100vh-180px)]">
          <SidebarGroup>
            <SidebarGroupLabel>Main</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(mainMenuItems)}
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Domains</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(domainMenuItems)}
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Content</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(contentMenuItems)}
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(settingsMenuItems)}
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Advanced</SidebarGroupLabel>
            <SidebarGroupContent>
              {renderMenuItems(advancedMenuItems)}
            </SidebarGroupContent>
          </SidebarGroup>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        <Button variant="ghost" className="w-full justify-start" asChild>
          <NavLink to="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            {!collapsed && <span>{t('backToSite')}</span>}
          </NavLink>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;