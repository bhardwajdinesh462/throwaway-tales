import { NavLink, useLocation } from "react-router-dom";
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
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";

const AdminSidebar = () => {
  const location = useLocation();
  const { state } = useSidebar();
  const { t } = useLanguage();
  const collapsed = state === "collapsed";

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
    { title: "Admins", url: "/admin/admins", icon: Shield },
    { title: "Email Setup", url: "/admin/email-setup", icon: Wand2 },
    { title: "SMTP", url: "/admin/smtp", icon: Cog },
    { title: "IMAP", url: "/admin/imap", icon: MailOpen },
    { title: "SEO", url: "/admin/seo", icon: Search },
    { title: "Blog Settings", url: "/admin/blog-settings", icon: Newspaper },
    { title: "Languages", url: "/admin/languages", icon: Languages },
  ];

  const advancedMenuItems = [
    { title: "Audit Logs", url: "/admin/audit-logs", icon: Shield },
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
