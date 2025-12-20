import { useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";

const AdminLayout = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  // Render immediately - ProtectedRoute handles auth gating
  // Don't block render on user check for faster admin panel

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/admin") return t('dashboard');
    if (path.includes("users")) return t('users');
    if (path.includes("domains")) return t('domains');
    if (path.includes("emails")) return t('emails');
    if (path.includes("blogs")) return t('blogs');
    if (path.includes("pages")) return t('pages');
    if (path.includes("themes")) return t('themes');
    if (path.includes("settings")) return t('settings');
    return "";
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border flex items-center px-4 bg-card/50 backdrop-blur-xl sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-lg font-semibold text-foreground">{getPageTitle()}</h1>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
