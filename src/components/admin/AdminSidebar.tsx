import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
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

const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { t } = useLanguage();
  const collapsed = state === "collapsed";
  const [searchQuery, setSearchQuery] = useState("");

  const mainMenuItems = [
    { title: t('dashboard'), url: "/admin", icon: LayoutDashboard },
    { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
    { title: t('users'), url: "/admin/users", icon: Users },
    { title: t('emails'), url: "/admin/emails", icon: Mail },
  ];

  const domainMenuItems = [
    { title: t('domains'), url: "/admin/domains", icon: Globe },
    { title: "Custom Domains", url: "/admin/custom-domains", icon: LinkIcon },
  ];

  const contentMenuItems = [
    { title: t('blogs'), url: "/admin/blogs", icon: Newspaper },
    { title: t('pages'), url: "/admin/pages", icon: FileText },
    { title: "Email Templates", url: "/admin/email-templates", icon: MailOpen },
  ];

  const settingsMenuItems = [
    { title: "Overview", url: "/admin/settings-overview", icon: LayoutList },
    { title: "General", url: "/admin/general-settings", icon: Settings },
    { title: "Appearance", url: "/admin/appearance", icon: Paintbrush },
    { title: t('themes'), url: "/admin/themes", icon: Palette },
    { title: "User & Guest", url: "/admin/user-settings", icon: UserCog },
    { title: "Registration", url: "/admin/registration", icon: Shield },
    { title: "Payments", url: "/admin/payments", icon: CreditCard },
    { title: "Subscriptions", url: "/admin/subscriptions", icon: Crown },
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

  const advancedMenuItems = [
    { title: "Announcement", url: "/admin/announcement", icon: Bell },
    { title: "Status Settings", url: "/admin/status-settings", icon: Activity },
    { title: "Mailbox Health", url: "/admin/mailbox-health", icon: Activity },
    { title: "Email Logs", url: "/admin/email-logs", icon: FileWarning },
    { title: "Audit Logs", url: "/admin/audit-logs", icon: Clock },
    { title: "IP Blocking", url: "/admin/ip-blocking", icon: ShieldCheck },
    { title: "Rate Limits", url: "/admin/rate-limits", icon: Clock },
    { title: "Role Approvals", url: "/admin/role-approvals", icon: ShieldCheck },
    { title: "Advanced", url: "/admin/advanced", icon: Cog },
    { title: "Banners", url: "/admin/banners", icon: Megaphone },
    { title: "Ads", url: "/admin/ads", icon: Megaphone },
    { title: "Captcha", url: "/admin/captcha", icon: ShieldCheck },
    { title: "API", url: "/admin/api", icon: Key },
    { title: "Cron Jobs", url: "/admin/cron", icon: Clock },
    { title: "Cache", url: "/admin/cache", icon: Database },
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

  const renderMenuItems = (items: typeof mainMenuItems) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton asChild>
            <NavLink
              to={item.url}
              end={item.url === "/admin"}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isActive(item.url)
                  ? "bg-primary/20 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="w-4 h-4" />
              {!collapsed && <span className="text-sm">{item.title}</span>}
            </NavLink>
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

        {/* Search Box */}
        {!collapsed && (
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
