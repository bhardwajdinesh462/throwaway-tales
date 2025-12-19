import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  Mail, 
  Star, 
  Bell, 
  Settings, 
  Shield, 
  Clock, 
  Trash2, 
  Edit2, 
  Save,
  ArrowLeft,
  Volume2,
  VolumeX,
  Palette,
  Globe
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useEmailService, ReceivedEmail } from "@/hooks/useLocalEmailService";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { storage, STORAGE_KEYS } from "@/lib/storage";
import { formatDistanceToNow } from "date-fns";
import TwoFactorSetup from "@/components/TwoFactorSetup";
import SubscriptionManagement from "@/components/SubscriptionManagement";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface NotificationPreferences {
  soundEnabled: boolean;
  pushEnabled: boolean;
  emailDigest: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile, updateProfile, signOut, isLoading, isAdmin } = useAuth();
  const { emailHistory } = useEmailService();
  const { theme, themes, setTheme } = useTheme();
  const { language, setLanguage, languages } = useLanguage();
  
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [savedEmails, setSavedEmails] = useState<ReceivedEmail[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    soundEnabled: true,
    pushEnabled: false,
    emailDigest: false,
    autoRefresh: true,
    refreshInterval: 30,
  });

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user && profile) {
      setDisplayName(profile.display_name || user.email?.split('@')[0] || '');
      
      // Load saved emails
      const savedEmailIds = storage.get<{ user_id: string; email_id: string }[]>(STORAGE_KEYS.SAVED_EMAILS, []);
      const userSavedIds = savedEmailIds.filter(s => s.user_id === user.id).map(s => s.email_id);
      const allReceived = storage.get<ReceivedEmail[]>(STORAGE_KEYS.RECEIVED_EMAILS, []);
      setSavedEmails(allReceived.filter(e => userSavedIds.includes(e.id)));
      
      // Load notification preferences
      const savedPrefs = storage.get<NotificationPreferences>(`notification_prefs_${user.id}`, {
        soundEnabled: true,
        pushEnabled: false,
        emailDigest: false,
        autoRefresh: true,
        refreshInterval: 30,
      });
      setNotificationPrefs(savedPrefs);
    }
  }, [user, profile]);

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      toast.error("Display name cannot be empty");
      return;
    }
    await updateProfile({ display_name: displayName });
    setIsEditing(false);
  };

  const handleNotificationChange = (key: keyof NotificationPreferences, value: boolean | number) => {
    const newPrefs = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(newPrefs);
    if (user) {
      storage.set(`notification_prefs_${user.id}`, newPrefs);
    }
    toast.success("Preferences saved");
  };

  const handleRemoveSavedEmail = (emailId: string) => {
    if (!user) return;
    
    const savedEmailIds = storage.get<{ user_id: string; email_id: string }[]>(STORAGE_KEYS.SAVED_EMAILS, []);
    const filtered = savedEmailIds.filter(s => !(s.user_id === user.id && s.email_id === emailId));
    storage.set(STORAGE_KEYS.SAVED_EMAILS, filtered);
    setSavedEmails(prev => prev.filter(e => e.id !== emailId));
    toast.success("Email removed from saved");
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    // Note: In production, you'd call a backend function to delete user data
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const currentDisplayName = profile?.display_name || user?.email?.split('@')[0] || 'User';
  const memberSince = profile?.created_at ? formatDistanceToNow(new Date(profile.created_at), { addSuffix: true }) : 'recently';

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            className="mb-6" 
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {/* Profile Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 mb-8"
          >
            <div className="flex flex-col md:flex-row items-center gap-6">
              <Avatar className="w-24 h-24 border-4 border-primary/20">
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-2xl text-primary-foreground">
                  {currentDisplayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 text-center md:text-left">
                {isEditing ? (
                  <div className="flex items-center gap-2 justify-center md:justify-start">
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="max-w-xs bg-secondary/50"
                    />
                    <Button size="icon" onClick={handleSaveProfile}>
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 justify-center md:justify-start">
                    <h1 className="text-2xl font-bold text-foreground">{currentDisplayName}</h1>
                    <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <p className="text-muted-foreground">{user.email}</p>
                <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                  <Badge variant={isAdmin ? 'default' : 'secondary'}>
                    {isAdmin ? 'admin' : 'user'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Member since {memberSince}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tabs */}
          <Tabs defaultValue="saved" className="space-y-6">
            <TabsList className="grid grid-cols-5 bg-card border border-border">
              <TabsTrigger value="saved" className="flex items-center gap-2">
                <Star className="w-4 h-4" />
                <span className="hidden sm:inline">Saved</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">History</span>
              </TabsTrigger>
              <TabsTrigger value="billing" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">Billing</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Notifications</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            {/* Saved Emails */}
            <TabsContent value="saved">
              <Card className="glass-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    Saved Emails
                  </CardTitle>
                  <CardDescription>Your favorite emails saved for later reference</CardDescription>
                </CardHeader>
                <CardContent>
                  {savedEmails.length === 0 ? (
                    <div className="text-center py-12">
                      <Star className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">No saved emails yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Click the star icon on any email to save it here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence>
                        {savedEmails.map((email, index) => (
                          <motion.div
                            key={email.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: index * 0.05 }}
                            className="p-4 rounded-lg bg-secondary/30 border border-border/50 hover:border-primary/30 transition-all"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground truncate">
                                  {email.subject || "No subject"}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  From: {email.from_address}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveSavedEmail(email.id)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Email History */}
            <TabsContent value="history">
              <Card className="glass-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    Email Address History
                  </CardTitle>
                  <CardDescription>All temporary emails you've generated</CardDescription>
                </CardHeader>
                <CardContent>
                  {emailHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <Mail className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">No email history yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {emailHistory.slice(0, 20).map((email, index) => (
                        <motion.div
                          key={email.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.03 }}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Mail className="w-4 h-4 text-primary" />
                            <span className="font-mono text-sm text-foreground">{email.address}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(email.created_at), { addSuffix: true })}
                            </span>
                            {new Date(email.expires_at) > new Date() ? (
                              <Badge variant="outline" className="text-neon-green border-neon-green/30">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Expired</Badge>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Billing/Subscription Tab */}
            <TabsContent value="billing">
              <SubscriptionManagement />
            </TabsContent>

            {/* Notifications */}
            <TabsContent value="notifications">
              <Card className="glass-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>Manage how you receive notifications</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Sound Notifications */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {notificationPrefs.soundEnabled ? (
                        <Volume2 className="w-5 h-5 text-primary" />
                      ) : (
                        <VolumeX className="w-5 h-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium text-foreground">Sound Notifications</p>
                        <p className="text-sm text-muted-foreground">Play a sound when new emails arrive</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationPrefs.soundEnabled}
                      onCheckedChange={(checked) => handleNotificationChange('soundEnabled', checked)}
                    />
                  </div>

                  {/* Push Notifications */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">Push Notifications</p>
                        <p className="text-sm text-muted-foreground">Receive browser push notifications</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationPrefs.pushEnabled}
                      onCheckedChange={(checked) => handleNotificationChange('pushEnabled', checked)}
                    />
                  </div>

                  {/* Auto Refresh */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Auto Refresh Inbox</p>
                        <p className="text-sm text-muted-foreground">Automatically check for new emails</p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationPrefs.autoRefresh}
                      onCheckedChange={(checked) => handleNotificationChange('autoRefresh', checked)}
                    />
                  </div>

                  {/* Refresh Interval */}
                  {notificationPrefs.autoRefresh && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex items-center justify-between pl-8"
                    >
                      <div>
                        <p className="font-medium text-foreground">Refresh Interval</p>
                        <p className="text-sm text-muted-foreground">How often to check for new emails</p>
                      </div>
                      <Select
                        value={notificationPrefs.refreshInterval.toString()}
                        onValueChange={(value) => handleNotificationChange('refreshInterval', parseInt(value))}
                      >
                        <SelectTrigger className="w-32 bg-secondary/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 seconds</SelectItem>
                          <SelectItem value="30">30 seconds</SelectItem>
                          <SelectItem value="60">1 minute</SelectItem>
                          <SelectItem value="120">2 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings */}
            <TabsContent value="settings">
              <div className="space-y-6">
                {/* Appearance */}
                <Card className="glass-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="w-5 h-5 text-primary" />
                      Appearance
                    </CardTitle>
                    <CardDescription>Customize the look and feel</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Theme</p>
                        <p className="text-sm text-muted-foreground">Choose your preferred color theme</p>
                      </div>
                      <Select value={theme.id} onValueChange={setTheme}>
                        <SelectTrigger className="w-40 bg-secondary/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {themes.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">Language</p>
                          <p className="text-sm text-muted-foreground">Select your preferred language</p>
                        </div>
                      </div>
                      <Select value={language} onValueChange={(value: any) => setLanguage(value)}>
                        <SelectTrigger className="w-32 bg-secondary/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                              {lang.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Account Security */}
                <Card className="glass-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      Account Security
                    </CardTitle>
                    <CardDescription>Manage your account security settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg bg-secondary/20 border border-border/50">
                      <p className="text-sm text-muted-foreground">
                        <strong className="text-foreground">Email:</strong> {user.email}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        <strong className="text-foreground">Account ID:</strong> {user.id.slice(0, 8)}...
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Two-Factor Authentication */}
                <TwoFactorSetup />

                {/* Danger Zone */}
                <Card className="glass-card border-destructive/30">
                  <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>Irreversible account actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full sm:w-auto">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Sign Out
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-card">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Sign out?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You will be signed out of your account.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteAccount}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Sign Out
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Profile;
