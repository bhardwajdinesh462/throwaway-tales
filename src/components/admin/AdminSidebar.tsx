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

const AdminSidebar = () => {
  const location = useLocation();
  const { state } = useSidebar();
  const { t } = useLanguage();
  const collapsed = state === "collapsed";

  const menuItems = [
    { title: t('dashboard'), url: "/admin", icon: LayoutDashboard },
    { title: t('users'), url: "/admin/users", icon: Users },
    { title: t('domains'), url: "/admin/domains", icon: Globe },
    { title: "Custom Domains", url: "/admin/custom-domains", icon: LinkIcon },
    { title: t('emails'), url: "/admin/emails", icon: Mail },
    { title: t('blogs'), url: "/admin/blogs", icon: Newspaper },
    { title: t('pages'), url: "/admin/pages", icon: FileText },
    { title: t('themes'), url: "/admin/themes", icon: Palette },
    { title: t('settings'), url: "/admin/settings", icon: Settings },
  ];

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
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
              <p className="font-semibold text-foreground">TrashMails</p>
              <p className="text-xs text-muted-foreground">{t('adminPanel')}</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
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
                      <item.icon className="w-5 h-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
