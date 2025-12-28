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

import ErrorBoundary, { PageErrorBoundary } from "@/components/ErrorBoundary";
import UpdatePrompt from "@/components/UpdatePrompt";
import ProtectedRoute from "@/components/ProtectedRoute";
import { lazy, Suspense, useEffect, ComponentType } from "react";

// Lazy loading wrapper with retry for stale chunk errors
function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error: any) {
      // Check if it's a chunk loading error
      if (
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('Loading CSS chunk')
      ) {
        console.warn('[App] Stale chunk detected, reloading page...', error);
        // Clear any cached modules
        window.location.reload();
        // Return a placeholder to prevent the error from propagating
        return { default: (() => null) as unknown as T };
      }
      throw error;
    }
  });
}

// Import Index directly (no lazy loading for main page - faster initial load)
import Index from "./pages/Index";
const Blog = lazyWithRetry(() => import("./pages/Blog"));
const BlogPost = lazyWithRetry(() => import("./pages/BlogPost"));
const Contact = lazyWithRetry(() => import("./pages/Contact"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const VerifyEmail = lazyWithRetry(() => import("./pages/VerifyEmail"));
const History = lazyWithRetry(() => import("./pages/History"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const DeployGuide = lazyWithRetry(() => import("./pages/DeployGuide"));
const AdminGuide = lazyWithRetry(() => import("./pages/AdminGuide"));
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazyWithRetry(() => import("./pages/TermsOfService"));
const CookiePolicy = lazyWithRetry(() => import("./pages/CookiePolicy"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const Pricing = lazyWithRetry(() => import("./pages/Pricing"));
const BillingHistory = lazyWithRetry(() => import("./pages/BillingHistory"));
const PremiumFeatures = lazyWithRetry(() => import("./pages/PremiumFeatures"));
const APIAccess = lazyWithRetry(() => import("./pages/APIAccess"));
const About = lazyWithRetry(() => import("./pages/About"));
const Changelog = lazyWithRetry(() => import("./pages/Changelog"));
const Status = lazyWithRetry(() => import("./pages/Status"));
const HostingGuide = lazyWithRetry(() => import("./pages/HostingGuide"));
// Lazy load admin pages with retry
const AdminLayout = lazyWithRetry(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const AdminAnalytics = lazyWithRetry(() => import("./pages/admin/AdminAnalytics"));
const AdminUsers = lazyWithRetry(() => import("./pages/admin/AdminUsers"));
const AdminDomains = lazyWithRetry(() => import("./pages/admin/AdminDomains"));
const AdminEmails = lazyWithRetry(() => import("./pages/admin/AdminEmails"));
const AdminSettings = lazyWithRetry(() => import("./pages/admin/AdminSettings"));
const AdminBlogs = lazyWithRetry(() => import("./pages/admin/AdminBlogs"));
const AdminPages = lazyWithRetry(() => import("./pages/admin/AdminPages"));
const AdminThemes = lazyWithRetry(() => import("./pages/admin/AdminThemes"));
const AdminCustomDomains = lazyWithRetry(() => import("./pages/admin/AdminCustomDomains"));
const AdminGeneralSettings = lazyWithRetry(() => import("./pages/admin/AdminGeneralSettings"));
const AdminSMTPSettings = lazyWithRetry(() => import("./pages/admin/AdminSMTPSettings"));
const AdminIMAPSettings = lazyWithRetry(() => import("./pages/admin/AdminIMAPSettings"));
const AdminAppearance = lazyWithRetry(() => import("./pages/admin/AdminAppearance"));
const AdminUserSettings = lazyWithRetry(() => import("./pages/admin/AdminUserSettings"));
const AdminAdmins = lazyWithRetry(() => import("./pages/admin/AdminAdmins"));
const AdminSEO = lazyWithRetry(() => import("./pages/admin/AdminSEO"));
const AdminBlogSettings = lazyWithRetry(() => import("./pages/admin/AdminBlogSettings"));
const AdminEmailTemplates = lazyWithRetry(() => import("./pages/admin/AdminEmailTemplates"));
const AdminLanguages = lazyWithRetry(() => import("./pages/admin/AdminLanguages"));
const AdminAds = lazyWithRetry(() => import("./pages/admin/AdminAds"));
const AdminCaptcha = lazyWithRetry(() => import("./pages/admin/AdminCaptcha"));
const AdminAPI = lazyWithRetry(() => import("./pages/admin/AdminAPI"));
const AdminCron = lazyWithRetry(() => import("./pages/admin/AdminCron"));
const AdminCache = lazyWithRetry(() => import("./pages/admin/AdminCache"));
const AdminAdvancedSettings = lazyWithRetry(() => import("./pages/admin/AdminAdvancedSettings"));
const AdminBanners = lazyWithRetry(() => import("./pages/admin/AdminBanners"));
const AdminAuditLogs = lazyWithRetry(() => import("./pages/admin/AdminAuditLogs"));
const AdminEmailSetup = lazyWithRetry(() => import("./pages/admin/AdminEmailSetup"));
const AdminDeployGuide = lazyWithRetry(() => import("./pages/admin/AdminDeployGuide"));
const AdminRateLimits = lazyWithRetry(() => import("./pages/admin/AdminRateLimits"));
const AdminRoleApprovals = lazyWithRetry(() => import("./pages/admin/AdminRoleApprovals"));
const AdminSettingsOverview = lazyWithRetry(() => import("./pages/admin/AdminSettingsOverview"));
const AdminRegistration = lazyWithRetry(() => import("./pages/admin/AdminRegistration"));
const AdminPayments = lazyWithRetry(() => import("./pages/admin/AdminPayments"));
const AdminIPBlocking = lazyWithRetry(() => import("./pages/admin/AdminIPBlocking"));
const AdminSubscriptions = lazyWithRetry(() => import("./pages/admin/AdminSubscriptions"));
const AdminEmailRestrictions = lazyWithRetry(() => import("./pages/admin/AdminEmailRestrictions"));
const AdminMailboxes = lazyWithRetry(() => import("./pages/admin/AdminMailboxes"));
const AdminEmailLogs = lazyWithRetry(() => import("./pages/admin/AdminEmailLogs"));
const AdminMailboxHealth = lazyWithRetry(() => import("./pages/admin/AdminMailboxHealth"));
const AdminAnnouncement = lazyWithRetry(() => import("./pages/admin/AdminAnnouncement"));
const AdminStatusSettings = lazyWithRetry(() => import("./pages/admin/AdminStatusSettings"));
const AdminFriendlyWebsites = lazyWithRetry(() => import("./pages/admin/AdminFriendlyWebsites"));
const AdminBackup = lazyWithRetry(() => import("./pages/admin/AdminBackup"));
const AdminPricing = lazyWithRetry(() => import("./pages/admin/AdminPricing"));
const AdminHomepage = lazyWithRetry(() => import("./pages/admin/AdminHomepage"));
const AdminWebhooks = lazyWithRetry(() => import("./pages/admin/AdminWebhooks"));

// Redirect www to non-www
if (typeof window !== 'undefined' && window.location.hostname.startsWith('www.')) {
  const nonWwwUrl = window.location.href.replace('://www.', '://');
  window.location.replace(nonWwwUrl);
}

// Defer initialization to idle time
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => initializeDefaultData());
} else {
  setTimeout(() => initializeDefaultData(), 1);
}

// Create query client with optimized caching
const queryClient = createQueryClient();

// Minimal page loader - reduced delay for faster perceived load
const PageLoader = () => null;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <SettingsProvider>
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
                          <Route path="/hosting-guide" element={
                            <ProtectedRoute requireAuth requireAdmin>
                              <PageErrorBoundary name="HostingGuide">
                                <HostingGuide />
                              </PageErrorBoundary>
                            </ProtectedRoute>
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
                            <Route path="status-settings" element={<AdminStatusSettings />} />
                            <Route path="friendly-websites" element={<AdminFriendlyWebsites />} />
                            <Route path="homepage" element={<AdminHomepage />} />
                            <Route path="backup" element={<AdminBackup />} />
                            <Route path="pricing" element={<AdminPricing />} />
                            <Route path="webhooks" element={<AdminWebhooks />} />
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
