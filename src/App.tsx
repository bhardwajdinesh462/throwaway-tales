import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useLocalAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/components/NotificationSystem";
import { initializeDefaultData } from "@/lib/storage";
import Index from "./pages/Index";
import Blog from "./pages/Blog";
import Contact from "./pages/Contact";
import Auth from "./pages/Auth";
import History from "./pages/History";
import DeployGuide from "./pages/DeployGuide";
import NotFound from "./pages/NotFound";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminDomains from "./pages/admin/AdminDomains";
import AdminEmails from "./pages/admin/AdminEmails";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminBlogs from "./pages/admin/AdminBlogs";
import AdminPages from "./pages/admin/AdminPages";
import AdminThemes from "./pages/admin/AdminThemes";
import AdminCustomDomains from "./pages/admin/AdminCustomDomains";
import AdminGeneralSettings from "./pages/admin/AdminGeneralSettings";
import AdminSMTPSettings from "./pages/admin/AdminSMTPSettings";
import AdminAppearance from "./pages/admin/AdminAppearance";
import AdminUserSettings from "./pages/admin/AdminUserSettings";
import AdminAdmins from "./pages/admin/AdminAdmins";
import AdminSEO from "./pages/admin/AdminSEO";
import AdminBlogSettings from "./pages/admin/AdminBlogSettings";
import AdminEmailTemplates from "./pages/admin/AdminEmailTemplates";
import AdminLanguages from "./pages/admin/AdminLanguages";
import AdminAds from "./pages/admin/AdminAds";
import AdminCaptcha from "./pages/admin/AdminCaptcha";
import AdminAPI from "./pages/admin/AdminAPI";
import AdminCron from "./pages/admin/AdminCron";
import AdminCache from "./pages/admin/AdminCache";
import AdminAdvancedSettings from "./pages/admin/AdminAdvancedSettings";

// Initialize default data on app load
initializeDefaultData();

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <NotificationProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/history" element={<History />} />
                <Route path="/deploy-guide" element={<DeployGuide />} />
                
                {/* Admin Routes */}
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="domains" element={<AdminDomains />} />
                  <Route path="custom-domains" element={<AdminCustomDomains />} />
                  <Route path="emails" element={<AdminEmails />} />
                  <Route path="blogs" element={<AdminBlogs />} />
                  <Route path="pages" element={<AdminPages />} />
                  <Route path="themes" element={<AdminThemes />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="general-settings" element={<AdminGeneralSettings />} />
                  <Route path="smtp" element={<AdminSMTPSettings />} />
                  <Route path="appearance" element={<AdminAppearance />} />
                  <Route path="user-settings" element={<AdminUserSettings />} />
                  <Route path="admins" element={<AdminAdmins />} />
                  <Route path="seo" element={<AdminSEO />} />
                  <Route path="blog-settings" element={<AdminBlogSettings />} />
                  <Route path="email-templates" element={<AdminEmailTemplates />} />
                  <Route path="languages" element={<AdminLanguages />} />
                  <Route path="ads" element={<AdminAds />} />
                  <Route path="captcha" element={<AdminCaptcha />} />
                  <Route path="api" element={<AdminAPI />} />
                  <Route path="cron" element={<AdminCron />} />
                  <Route path="cache" element={<AdminCache />} />
                  <Route path="advanced" element={<AdminAdvancedSettings />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </NotificationProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
