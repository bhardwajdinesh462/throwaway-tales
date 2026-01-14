import { useState, useEffect, useCallback } from "react";
import { useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminCommandPalette from "@/components/admin/AdminCommandPalette";

const AdminLayout = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCloseCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
  }, []);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/admin") return t('dashboard');
    if (path.includes("pricing")) return "Pricing";
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
          <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card/50 backdrop-blur-xl sticky top-0 z-10">
            <div className="flex items-center">
              <SidebarTrigger className="mr-4" />
              <h1 className="text-lg font-semibold text-foreground">{getPageTitle()}</h1>
            </div>
            {/* Command Palette Hint */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary border border-border rounded-lg transition-colors"
            >
              <span>Search...</span>
              <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-mono bg-background border border-border rounded">
                <span className="text-[10px]">⌘</span>K
              </kbd>
            </button>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Global Command Palette */}
      <AdminCommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={handleCloseCommandPalette} 
      />
    </SidebarProvider>
  );
};

export default AdminLayout;
