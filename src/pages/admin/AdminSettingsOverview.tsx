import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Settings, 
  Search, 
  Paintbrush, 
  UserCog, 
  Globe, 
  Check, 
  X, 
  RefreshCw,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { storage } from "@/lib/storage";
import { useNavigate } from "react-router-dom";

interface SettingsSummary {
  general: {
    siteName: string;
    maintenanceMode: boolean;
    registrationEnabled: boolean;
    contactEmail: string;
  } | null;
  seo: {
    siteTitle: string;
    googleAnalyticsId: string;
    enableSitemap: boolean;
  } | null;
  appearance: {
    logoUrl: string;
    darkMode: boolean;
    showAnimations: boolean;
    primaryColor: string;
  } | null;
  userSettings: {
    allowGuestEmails: boolean;
    maxEmailsPerUser: number;
    emailExpirationHours: number;
    allowCustomUsername: boolean;
  } | null;
  languages: {
    defaultLanguage: string;
    enabledLanguages: string[];
  } | null;
}

const AdminSettingsOverview = () => {
  const [summary, setSummary] = useState<SettingsSummary>({
    general: null,
    seo: null,
    appearance: null,
    userSettings: null,
    languages: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    setIsLoading(true);
    try {
      // Load all settings from database
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['general', 'seo', 'appearance', 'user_settings', 'languages']);

      if (error) throw error;

      const settingsMap: Record<string, any> = {};
      data?.forEach(row => {
        settingsMap[row.key] = row.value;
      });

      // Fallback to localStorage for missing settings
      const general = settingsMap['general'] || storage.get('trashmails_general_settings', null);
      const seo = settingsMap['seo'] || storage.get('trashmails_seo_settings', null);
      const appearance = settingsMap['appearance'] || storage.get('trashmails_appearance_settings', null);
      const userSettings = settingsMap['user_settings'] || storage.get('trashmails_user_settings', null);
      const languages = settingsMap['languages'] || storage.get('trashmails_languages', null);

      setSummary({
        general: general ? {
          siteName: general.siteName || 'Nullsto',
          maintenanceMode: general.maintenanceMode || false,
          registrationEnabled: general.registrationEnabled !== false,
          contactEmail: general.contactEmail || '',
        } : null,
        seo: seo ? {
          siteTitle: seo.siteTitle || '',
          googleAnalyticsId: seo.googleAnalyticsId || '',
          enableSitemap: seo.enableSitemap !== false,
        } : null,
        appearance: appearance ? {
          logoUrl: appearance.logoUrl || '',
          darkMode: appearance.darkMode !== false,
          showAnimations: appearance.showAnimations !== false,
          primaryColor: appearance.primaryColor || '#0d9488',
        } : null,
        userSettings: userSettings ? {
          allowGuestEmails: userSettings.allowGuestEmails !== false,
          maxEmailsPerUser: userSettings.maxEmailsPerUser || 5,
          emailExpirationHours: userSettings.emailExpirationHours || 24,
          allowCustomUsername: userSettings.allowCustomUsername !== false,
        } : null,
        languages: languages ? {
          defaultLanguage: languages.defaultLanguage || 'en',
          enabledLanguages: languages.enabledLanguages || ['en'],
        } : null,
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const StatusBadge = ({ enabled, label }: { enabled: boolean; label?: string }) => (
    <Badge variant={enabled ? "default" : "secondary"} className={enabled ? "bg-green-500/20 text-green-500 border-green-500/30" : ""}>
      {enabled ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
      {label || (enabled ? "Enabled" : "Disabled")}
    </Badge>
  );

  const SettingRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings Overview</h1>
          <p className="text-muted-foreground">Summary of all configured settings</p>
        </div>
        <Button variant="outline" onClick={loadAllSettings} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* General Settings */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0 }}>
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/admin/general-settings')}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">General</CardTitle>
                    <CardDescription>Site configuration</CardDescription>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-6 w-1/2" />
                </div>
              ) : summary.general ? (
                <div className="space-y-1">
                  <SettingRow label="Site Name" value={summary.general.siteName} />
                  <SettingRow label="Maintenance" value={<StatusBadge enabled={!summary.general.maintenanceMode} label={summary.general.maintenanceMode ? "On" : "Off"} />} />
                  <SettingRow label="Registration" value={<StatusBadge enabled={summary.general.registrationEnabled} />} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Not configured</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* SEO Settings */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/admin/seo')}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Search className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">SEO</CardTitle>
                    <CardDescription>Search optimization</CardDescription>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
              ) : summary.seo ? (
                <div className="space-y-1">
                  <SettingRow label="Site Title" value={summary.seo.siteTitle || <span className="italic text-muted-foreground">Default</span>} />
                  <SettingRow label="Analytics" value={<StatusBadge enabled={!!summary.seo.googleAnalyticsId} label={summary.seo.googleAnalyticsId ? "Connected" : "Not Set"} />} />
                  <SettingRow label="Sitemap" value={<StatusBadge enabled={summary.seo.enableSitemap} />} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Not configured</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Appearance Settings */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.2 }}>
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/admin/appearance')}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Paintbrush className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Appearance</CardTitle>
                    <CardDescription>Visual settings</CardDescription>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
              ) : summary.appearance ? (
                <div className="space-y-1">
                  <SettingRow label="Logo" value={<StatusBadge enabled={!!summary.appearance.logoUrl} label={summary.appearance.logoUrl ? "Custom" : "Default"} />} />
                  <SettingRow label="Dark Mode" value={<StatusBadge enabled={summary.appearance.darkMode} />} />
                  <SettingRow label="Animations" value={<StatusBadge enabled={summary.appearance.showAnimations} />} />
                  <SettingRow label="Primary Color" value={
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: summary.appearance.primaryColor }} />
                      <span className="text-xs font-mono">{summary.appearance.primaryColor}</span>
                    </div>
                  } />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Not configured</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* User Settings */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.3 }}>
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/admin/user-settings')}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <UserCog className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">User & Guest</CardTitle>
                    <CardDescription>User permissions</CardDescription>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
              ) : summary.userSettings ? (
                <div className="space-y-1">
                  <SettingRow label="Guest Emails" value={<StatusBadge enabled={summary.userSettings.allowGuestEmails} />} />
                  <SettingRow label="Max Emails" value={summary.userSettings.maxEmailsPerUser} />
                  <SettingRow label="Expiration" value={`${summary.userSettings.emailExpirationHours}h`} />
                  <SettingRow label="Custom Username" value={<StatusBadge enabled={summary.userSettings.allowCustomUsername} />} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Not configured</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Languages */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ delay: 0.4 }}>
          <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate('/admin/languages')}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Languages</CardTitle>
                    <CardDescription>Localization</CardDescription>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
              ) : summary.languages ? (
                <div className="space-y-1">
                  <SettingRow label="Default" value={summary.languages.defaultLanguage.toUpperCase()} />
                  <SettingRow label="Languages" value={`${summary.languages.enabledLanguages.length} enabled`} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Not configured</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminSettingsOverview;
