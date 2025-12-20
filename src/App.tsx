import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useSupabaseAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { NotificationProvider } from "@/components/NotificationSystem";
import { initializeDefaultData } from "@/lib/storage";
import { EmailServiceProvider } from "@/contexts/EmailServiceContext";
import { createQueryClient } from "@/lib/queryClient";
import CacheRefresh from "@/components/CacheRefresh";
import ErrorBoundary, { PageErrorBoundary } from "@/components/ErrorBoundary";
import UpdatePrompt from "@/components/UpdatePrompt";
import ProtectedRoute from "@/components/ProtectedRoute";
import { lazy, Suspense, useEffect } from "react";

// Import Index directly (no lazy loading for main page - faster initial load)
import Index from "./pages/Index";
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Contact = lazy(() => import("./pages/Contact"));
const Auth = lazy(() => import("./pages/Auth"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const History = lazy(() => import("./pages/History"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const DeployGuide = lazy(() => import("./pages/DeployGuide"));
const AdminGuide = lazy(() => import("./pages/AdminGuide"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Pricing = lazy(() => import("./pages/Pricing"));
const BillingHistory = lazy(() => import("./pages/BillingHistory"));
const PremiumFeatures = lazy(() => import("./pages/PremiumFeatures"));
const APIAccess = lazy(() => import("./pages/APIAccess"));
const About = lazy(() => import("./pages/About"));
const Changelog = lazy(() => import("./pages/Changelog"));
const Status = lazy(() => import("./pages/Status"));

// Lazy load admin pages
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminDomains = lazy(() => import("./pages/admin/AdminDomains"));
const AdminEmails = lazy(() => import("./pages/admin/AdminEmails"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminBlogs = lazy(() => import("./pages/admin/AdminBlogs"));
const AdminPages = lazy(() => import("./pages/admin/AdminPages"));
const AdminThemes = lazy(() => import("./pages/admin/AdminThemes"));
const AdminCustomDomains = lazy(() => import("./pages/admin/AdminCustomDomains"));
const AdminGeneralSettings = lazy(() => import("./pages/admin/AdminGeneralSettings"));
const AdminSMTPSettings = lazy(() => import("./pages/admin/AdminSMTPSettings"));
const AdminIMAPSettings = lazy(() => import("./pages/admin/AdminIMAPSettings"));
const AdminAppearance = lazy(() => import("./pages/admin/AdminAppearance"));
const AdminUserSettings = lazy(() => import("./pages/admin/AdminUserSettings"));
const AdminAdmins = lazy(() => import("./pages/admin/AdminAdmins"));
const AdminSEO = lazy(() => import("./pages/admin/AdminSEO"));
const AdminBlogSettings = lazy(() => import("./pages/admin/AdminBlogSettings"));
const AdminEmailTemplates = lazy(() => import("./pages/admin/AdminEmailTemplates"));
const AdminLanguages = lazy(() => import("./pages/admin/AdminLanguages"));
const AdminAds = lazy(() => import("./pages/admin/AdminAds"));
const AdminCaptcha = lazy(() => import("./pages/admin/AdminCaptcha"));
const AdminAPI = lazy(() => import("./pages/admin/AdminAPI"));
const AdminCron = lazy(() => import("./pages/admin/AdminCron"));
const AdminCache = lazy(() => import("./pages/admin/AdminCache"));
const AdminAdvancedSettings = lazy(() => import("./pages/admin/AdminAdvancedSettings"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminEmailSetup = lazy(() => import("./pages/admin/AdminEmailSetup"));
const AdminDeployGuide = lazy(() => import("./pages/admin/AdminDeployGuide"));
const AdminRateLimits = lazy(() => import("./pages/admin/AdminRateLimits"));
const AdminRoleApprovals = lazy(() => import("./pages/admin/AdminRoleApprovals"));
const AdminSettingsOverview = lazy(() => import("./pages/admin/AdminSettingsOverview"));
const AdminRegistration = lazy(() => import("./pages/admin/AdminRegistration"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminIPBlocking = lazy(() => import("./pages/admin/AdminIPBlocking"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminEmailRestrictions = lazy(() => import("./pages/admin/AdminEmailRestrictions"));
const AdminMailboxes = lazy(() => import("./pages/admin/AdminMailboxes"));
const AdminEmailLogs = lazy(() => import("./pages/admin/AdminEmailLogs"));
const AdminMailboxHealth = lazy(() => import("./pages/admin/AdminMailboxHealth"));
const AdminAnnouncement = lazy(() => import("./pages/admin/AdminAnnouncement"));

// Defer initialization to idle time
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => initializeDefaultData());
} else {
  setTimeout(() => initializeDefaultData(), 1);
}

// Create query client with optimized caching
const queryClient = createQueryClient();

// Minimal page loader for lazy routes (not shown on Index)
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <SettingsProvider>
            {/* Ensures old caches are cleared once per version for all users */}
            <CacheRefresh />
            <UpdatePrompt />

            {/* Provide email service to ALL routes (Index, History, Profile, Admin, etc.) */}
            <EmailServiceProvider>
              <NotificationProvider>
                <TooltipProvider>
                  <ErrorBoundary level="page" name="App">
                    <Toaster />
                    <Sonner />
                    <BrowserRouter>
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          {/* Public Routes */}
                          <Route path="/" element={
                            <PageErrorBoundary name="Home">
                              <Index />
                            </PageErrorBoundary>
                          } />
                          <Route path="/blog" element={
                            <PageErrorBoundary name="Blog">
                              <Blog />
                            </PageErrorBoundary>
                          } />
                          <Route path="/blog/:slug" element={
                            <PageErrorBoundary name="BlogPost">
                              <BlogPost />
                            </PageErrorBoundary>
                          } />
                          <Route path="/contact" element={
                            <PageErrorBoundary name="Contact">
                              <Contact />
                            </PageErrorBoundary>
                          } />
                          <Route path="/auth" element={
                            <PageErrorBoundary name="Auth">
                              <Auth />
                            </PageErrorBoundary>
                          } />
                          <Route path="/verify-email" element={
                            <PageErrorBoundary name="VerifyEmail">
                              <VerifyEmail />
                            </PageErrorBoundary>
                          } />
                          <Route path="/privacy" element={<PrivacyPolicy />} />
                          <Route path="/terms" element={<TermsOfService />} />
                          <Route path="/cookies" element={<CookiePolicy />} />
                          <Route path="/pricing" element={
                            <PageErrorBoundary name="Pricing">
                              <Pricing />
                            </PageErrorBoundary>
                          } />
                          <Route path="/features" element={
                            <PageErrorBoundary name="Features">
                              <PremiumFeatures />
                            </PageErrorBoundary>
                          } />
                          <Route path="/about" element={
                            <PageErrorBoundary name="About">
                              <About />
                            </PageErrorBoundary>
                          } />
                          <Route path="/changelog" element={
                            <PageErrorBoundary name="Changelog">
                              <Changelog />
                            </PageErrorBoundary>
                          } />
                          <Route path="/status" element={
                            <PageErrorBoundary name="Status">
                              <Status />
                            </PageErrorBoundary>
                          } />
                          <Route path="/billing" element={
                            <ProtectedRoute requireAuth>
                              <PageErrorBoundary name="Billing">
                                <BillingHistory />
                              </PageErrorBoundary>
                            </ProtectedRoute>
                          } />
                          <Route path="/api-access" element={
                            <ProtectedRoute requireAuth>
                              <PageErrorBoundary name="APIAccess">
                                <APIAccess />
                              </PageErrorBoundary>
                            </ProtectedRoute>
                          } />
                          
                          {/* Protected User Routes - Require Authentication */}
                          <Route path="/history" element={
                            <ProtectedRoute requireAuth>
                              <PageErrorBoundary name="History">
                                <History />
                              </PageErrorBoundary>
                            </ProtectedRoute>
                          } />
                          <Route path="/dashboard" element={
                            <ProtectedRoute requireAuth>
                              <PageErrorBoundary name="Dashboard">
                                <Dashboard />
                              </PageErrorBoundary>
                            </ProtectedRoute>
                          } />
                          <Route path="/profile" element={
                            <ProtectedRoute requireAuth>
                              <PageErrorBoundary name="Profile">
                                <Profile />
                              </PageErrorBoundary>
                            </ProtectedRoute>
                          } />

                          {/* Hidden Admin Guides - Protected */}
                          <Route path="/deploy-guide" element={
                            <ProtectedRoute requireAuth requireAdmin>
                              <DeployGuide />
                            </ProtectedRoute>
                          } />
                          <Route path="/admin-guide" element={
                            <ProtectedRoute requireAuth requireAdmin>
                              <AdminGuide />
                            </ProtectedRoute>
                          } />

                          {/* Admin Routes - Require Admin Role */}
                          <Route path="/admin" element={
                            <ProtectedRoute requireAuth requireAdmin>
                              <PageErrorBoundary name="Admin">
                                <AdminLayout />
                              </PageErrorBoundary>
                            </ProtectedRoute>
                          }>
                            <Route index element={<AdminDashboard />} />
                            <Route path="analytics" element={<AdminAnalytics />} />
                            <Route path="users" element={<AdminUsers />} />
                            <Route path="domains" element={<AdminDomains />} />
                            <Route path="custom-domains" element={<AdminCustomDomains />} />
                            <Route path="emails" element={<AdminEmails />} />
                            <Route path="blogs" element={<AdminBlogs />} />
                            <Route path="pages" element={<AdminPages />} />
                            <Route path="themes" element={<AdminThemes />} />
                            <Route path="settings" element={<AdminSettings />} />
                            <Route path="settings-overview" element={<AdminSettingsOverview />} />
                            <Route path="general-settings" element={<AdminGeneralSettings />} />
                            <Route path="smtp" element={<AdminSMTPSettings />} />
                            <Route path="imap" element={<AdminIMAPSettings />} />
                            <Route path="email-setup" element={<AdminEmailSetup />} />
                            <Route path="deploy-guide" element={<AdminDeployGuide />} />
                            <Route path="appearance" element={<AdminAppearance />} />
                            <Route path="user-settings" element={<AdminUserSettings />} />
                            <Route path="registration" element={<AdminRegistration />} />
                            <Route path="payments" element={<AdminPayments />} />
                            <Route path="ip-blocking" element={<AdminIPBlocking />} />
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
                            <Route path="banners" element={<AdminBanners />} />
                            <Route path="audit-logs" element={<AdminAuditLogs />} />
                            <Route path="rate-limits" element={<AdminRateLimits />} />
                            <Route path="role-approvals" element={<AdminRoleApprovals />} />
                            <Route path="subscriptions" element={<AdminSubscriptions />} />
                            <Route path="email-restrictions" element={<AdminEmailRestrictions />} />
                            <Route path="mailboxes" element={<AdminMailboxes />} />
                            <Route path="email-logs" element={<AdminEmailLogs />} />
                            <Route path="mailbox-health" element={<AdminMailboxHealth />} />
                            <Route path="announcement" element={<AdminAnnouncement />} />
                          </Route>

                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                    </BrowserRouter>
                  </ErrorBoundary>
                </TooltipProvider>
              </NotificationProvider>
            </EmailServiceProvider>
          </SettingsProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
