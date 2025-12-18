import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, RefreshCw, Trash2, Star, Clock, User, ChevronRight, Inbox as InboxIcon, TestTube, Loader2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmailService, ReceivedEmail } from "@/hooks/useLocalEmailService";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDistanceToNow } from "date-fns";
import { storage } from "@/lib/storage";
import { useRealtimeEmails } from "@/hooks/useRealtimeEmails";

interface NotificationPreferences {
  soundEnabled: boolean;
  pushEnabled: boolean;
  emailDigest: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
}

const Inbox = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { receivedEmails, isLoading, markAsRead, saveEmail, currentEmail, simulateIncomingEmail, refetch } = useEmailService();
  const [selectedEmail, setSelectedEmail] = useState<ReceivedEmail | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savedEmails, setSavedEmails] = useState<Set<string>>(new Set());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [countdown, setCountdown] = useState(30);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const refreshRef = useRef<NodeJS.Timeout | null>(null);

  // Get notification preferences
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Real-time email notifications
  const handleNewEmail = useCallback((email: any) => {
    // Refetch emails when a new one arrives
    if (refetch) {
      refetch();
    }
  }, [refetch]);

  const { newEmailCount, resetCount } = useRealtimeEmails({
    tempEmailId: currentEmail?.id,
    onNewEmail: handleNewEmail,
    showToast: true,
    playSound: soundEnabled,
  });

  // Load user preferences
  useEffect(() => {
    if (user) {
      const prefs = storage.get<NotificationPreferences>(`notification_prefs_${user.id}`, {
        soundEnabled: true,
        pushEnabled: false,
        emailDigest: false,
        autoRefresh: true,
        refreshInterval: 30,
      });
      setAutoRefreshEnabled(prefs.autoRefresh);
      setRefreshInterval(prefs.refreshInterval);
      setCountdown(prefs.refreshInterval);
      setSoundEnabled(prefs.soundEnabled);
    }
  }, [user]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefreshEnabled) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (refreshRef.current) clearTimeout(refreshRef.current);
      return;
    }

    // Countdown timer
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    // Refresh timer
    refreshRef.current = setInterval(() => {
      handleRefresh(true);
    }, refreshInterval * 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [autoRefreshEnabled, refreshInterval]);

  const handleRefresh = async (isAuto = false) => {
    setIsRefreshing(true);
    setCountdown(refreshInterval);
    
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setIsRefreshing(false);
    
    if (!isAuto) {
      // Reset countdown on manual refresh
      setCountdown(refreshInterval);
    }
  };

  const handleSelectEmail = (email: ReceivedEmail) => {
    setSelectedEmail(email);
    if (!email.is_read) {
      markAsRead(email.id);
    }
  };

  const handleSave = async (emailId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = saveEmail(emailId);
    if (success) {
      setSavedEmails(prev => new Set([...prev, emailId]));
    }
  };

  const formatTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const toggleAutoRefresh = () => {
    const newValue = !autoRefreshEnabled;
    setAutoRefreshEnabled(newValue);
    if (user) {
      const prefs = storage.get<NotificationPreferences>(`notification_prefs_${user.id}`, {
        soundEnabled: true,
        pushEnabled: false,
        emailDigest: false,
        autoRefresh: true,
        refreshInterval: 30,
      });
      storage.set(`notification_prefs_${user.id}`, { ...prefs, autoRefresh: newValue });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="w-full"
    >
      <div className="glass-card overflow-hidden">
        {/* Inbox Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">{t('inbox')}</h2>
            <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">
              {receivedEmails.filter(e => !e.is_read).length} new
            </span>
            {newEmailCount > 0 && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1"
              >
                <Bell className="w-3 h-3" />
                {newEmailCount} live
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Auto-refresh indicator */}
            <div 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all ${
                autoRefreshEnabled 
                  ? 'bg-primary/10 text-primary border border-primary/20' 
                  : 'bg-secondary/50 text-muted-foreground'
              }`}
              onClick={toggleAutoRefresh}
              title={autoRefreshEnabled ? "Click to disable auto-refresh" : "Click to enable auto-refresh"}
            >
              {autoRefreshEnabled ? (
                <>
                  <motion.div
                    className="relative w-4 h-4"
                    animate={{ rotate: isRefreshing ? 360 : 0 }}
                    transition={{ duration: 0.5, repeat: isRefreshing ? Infinity : 0, ease: "linear" }}
                  >
                    <Loader2 className="w-4 h-4" />
                  </motion.div>
                  <span className="font-mono">{countdown}s</span>
                </>
              ) : (
                <span>Auto-refresh off</span>
              )}
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={simulateIncomingEmail}
              title="Simulate receiving an email (for demo)"
            >
              <TestTube className="w-4 h-4" />
              Test
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => handleRefresh(false)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>
        </div>

        {/* Refreshing Indicator Bar */}
        <AnimatePresence>
          {isRefreshing && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="h-0.5 bg-gradient-to-r from-primary to-accent origin-left"
            />
          )}
        </AnimatePresence>

        {/* Email List */}
        <div className="divide-y divide-border">
          <AnimatePresence>
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-muted-foreground">Loading inbox...</p>
              </div>
            ) : receivedEmails.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-12 text-center"
              >
                <InboxIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-foreground font-medium mb-2">{t('noEmails')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('waitingForMessages')}
                </p>
                <p className="text-sm text-primary font-mono mt-2">
                  {currentEmail?.address || "..."}
                </p>
                <Button variant="outline" className="mt-4 border-primary/30" onClick={simulateIncomingEmail}>
                  <TestTube className="w-4 h-4 mr-2" />
                  Send Test Email
                </Button>
                {autoRefreshEnabled && (
                  <p className="text-xs text-muted-foreground mt-4">
                    Auto-checking every {refreshInterval} seconds...
                  </p>
                )}
              </motion.div>
            ) : (
              receivedEmails.map((email, index) => (
                <motion.div
                  key={email.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelectEmail(email)}
                  className={`group p-4 cursor-pointer transition-colors hover:bg-secondary/30 ${
                    !email.is_read ? 'bg-primary/5' : ''
                  } ${selectedEmail?.id === email.id ? 'bg-secondary/50' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm truncate ${!email.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {email.from_address}
                        </span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">{formatTime(email.received_at)}</span>
                        </div>
                      </div>
                      <p className={`text-sm truncate ${!email.is_read ? 'font-medium text-foreground' : 'text-foreground/80'}`}>
                        {email.subject || t('noSubject')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {email.body?.slice(0, 100) || t('noContent')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {user && (
                        <button
                          onClick={(e) => handleSave(email.id, e)}
                          className={`p-1.5 rounded hover:bg-secondary transition-colors ${
                            savedEmails.has(email.id) ? 'text-yellow-400' : 'text-muted-foreground'
                          }`}
                        >
                          <Star className="w-4 h-4" fill={savedEmails.has(email.id) ? "currentColor" : "none"} />
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Selected Email Preview */}
        <AnimatePresence>
          {selectedEmail && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border bg-secondary/20"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    {selectedEmail.subject || t('noSubject')}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)}>
                    {t('close')}
                  </Button>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedEmail.from_address}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(selectedEmail.received_at)}</p>
                  </div>
                </div>
                <div className="prose prose-invert max-w-none">
                  {selectedEmail.html_body ? (
                    <div 
                      className="text-foreground/80"
                      dangerouslySetInnerHTML={{ __html: selectedEmail.html_body }} 
                    />
                  ) : (
                    <p className="text-foreground/80 whitespace-pre-wrap">{selectedEmail.body || t('noContent')}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Inbox;
