import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, RefreshCw, Star, Clock, User, ChevronRight, Inbox as InboxIcon, TestTube, Loader2, Bell, Paperclip, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReceivedEmail } from "@/hooks/useSecureEmailService";
import { useEmailService } from "@/contexts/EmailServiceContext";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDistanceToNow } from "date-fns";
import { storage } from "@/lib/storage";
import { useRealtimeEmails } from "@/hooks/useRealtimeEmails";
import EmailAttachments, { Attachment } from "@/components/EmailAttachments";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
interface NotificationPreferences {
  soundEnabled: boolean;
  pushEnabled: boolean;
  emailDigest: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
}

const Inbox = () => {
  // All hooks must be called in the same order on every render
  // 1. Context hooks
  const { user } = useAuth();
  const { t } = useLanguage();
  
  // 2. Custom hooks - Using secure email service with token-based access
  const { receivedEmails, isLoading, markAsRead, saveEmail, currentEmail, refetch, triggerImapFetch } = useEmailService();
  
  // 3. All useState hooks together
  const [selectedEmail, setSelectedEmail] = useState<ReceivedEmail | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savedEmails, setSavedEmails] = useState<Set<string>>(new Set());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [countdown, setCountdown] = useState(30);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [isCheckingMail, setIsCheckingMail] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  
  // 4. All useRef hooks together
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const refreshRef = useRef<NodeJS.Timeout | null>(null);

  // 5. All useCallback hooks together
  const handleNewEmail = useCallback(() => {
    if (refetch) {
      refetch();
    }
  }, [refetch]);

  // 6. Real-time hook (must be called unconditionally)
  const { newEmailCount, resetCount, pushPermission, requestPushPermission } = useRealtimeEmails({
    tempEmailId: currentEmail?.id,
    onNewEmail: handleNewEmail,
    showToast: true,
    playSound: soundEnabled,
    enablePushNotifications: true,
  });

  // 7. All useEffect hooks together
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

  const handleRefresh = useCallback(
    async (isAuto = false, opts?: { pollImap?: boolean }) => {
      setIsRefreshing(true);
      setCountdown(refreshInterval);

      try {
        // For fast delivery, auto-refresh performs a lightweight IMAP poll (latest-N).
        if (opts?.pollImap) {
          await triggerImapFetch({ mode: "latest", limit: 10 });
        } else {
          await refetch();
        }
      } finally {
        setIsRefreshing(false);

        // Reset countdown on manual refresh
        if (!isAuto) {
          setCountdown(refreshInterval);
        }
      }
    },
    [refreshInterval, refetch, triggerImapFetch]
  );

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefreshEnabled) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (refreshRef.current) clearInterval(refreshRef.current);
      return;
    }

    // Countdown timer
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    // Refresh timer
    refreshRef.current = setInterval(() => {
      void handleRefresh(true, { pollImap: true });
    }, refreshInterval * 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [autoRefreshEnabled, refreshInterval, handleRefresh, currentEmail?.id]);

  // When switching to a new temp address, clear selected email UI to prevent “mixed inbox” confusion
  useEffect(() => {
    setSelectedEmail(null);
    setAttachments([]);
  }, [currentEmail?.id]);


  // Check for new emails from IMAP server
  // Use 'latest' mode to avoid huge UNSEEN scans on mailboxes with many unseen messages.
  const handleCheckMail = async () => {
    setIsCheckingMail(true);
    try {
      const result = await triggerImapFetch({ mode: "latest", limit: 20 });
      const stats = result?.stats;
      if (stats?.stored > 0) {
        toast.success(`Found ${stats.stored} new email${stats.stored > 1 ? 's' : ''}!`);
      } else if (stats?.noMatch > 0) {
        toast.info(`${stats.noMatch} emails scanned but none matched your temp address`);
      } else {
        toast.info('No new emails found');
      }
    } catch (error) {
      console.error('Error checking mail:', error);
      toast.error('Failed to check for new emails');
    } finally {
      setIsCheckingMail(false);
    }
  };

  // Send a test email to the currently generated temp address (uses SMTP settings)
  const handleSendTestEmail = async () => {
    if (!currentEmail?.address) {
      toast.error('No active email address yet');
      return;
    }

    setIsSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('send-test-email', {
        body: {
          recipientEmail: currentEmail.address,
          subject: 'Nullsto inbox test',
          body: `<p>Test message for <strong>${currentEmail.address}</strong></p>`,
        },
      });

      if (error) throw error;

      toast.success('Test email sent! Waiting for delivery...');

      // Wait a bit for SMTP delivery before fetching
      await new Promise((resolve) => setTimeout(resolve, 3000));

      toast.loading('Checking for new mail...');
      const result = await triggerImapFetch({ mode: "latest", limit: 20 });
      toast.dismiss();

      const stats = result?.stats;
      if (stats?.stored > 0) {
        toast.success(`Email received! ${stats.stored} new message${stats.stored > 1 ? 's' : ''}`);
      } else if (stats?.noMatch > 0) {
        toast.warning('Mail scanned but did not match your temp address. Check logs for recipient parsing.');
      } else {
        toast.info('No new emails yet. Try clicking Check Mail again in a few seconds.');
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast.error(error?.message || 'Failed to send test email');
    } finally {
      setIsSendingTest(false);
    }
  };


  const handleSelectEmail = async (email: ReceivedEmail) => {
    setSelectedEmail(email);
    setAttachments([]);
    
    if (!email.is_read) {
      markAsRead(email.id);
    }

    // Fetch attachments for this email
    setLoadingAttachments(true);
    try {
      const { data, error } = await supabase
        .from("email_attachments")
        .select("*")
        .eq("received_email_id", email.id);
      
      if (!error && data) {
        setAttachments(data as Attachment[]);
      }
    } catch (error) {
      console.error("Error fetching attachments:", error);
    } finally {
      setLoadingAttachments(false);
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
        <div className="flex flex-col gap-3 p-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <Mail className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground shrink-0">{t('inbox')}</h2>
              <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full shrink-0">
                {receivedEmails.filter(e => !e.is_read).length} new
              </span>
              {newEmailCount > 0 && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shrink-0"
                >
                  <Bell className="w-3 h-3" />
                  {newEmailCount} live
                </motion.span>
              )}
            </div>

            {/* Synced Active Address — always matches the Generator via shared EmailServiceContext */}
            <div className="flex items-center gap-2 text-xs min-w-0 bg-secondary/40 px-2.5 py-1 rounded-md border border-border/50">
              <span className="text-muted-foreground shrink-0">Inbox for:</span>
              <span className="font-mono text-primary font-medium truncate">{currentEmail?.address || "..."}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
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
            <div className="flex items-center gap-1 text-xs text-green-500">
              <Shield className="w-3 h-3" />
              <span>Encrypted</span>
            </div>
            
            {pushPermission !== "granted" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={requestPushPermission}
                className="text-xs"
                title="Enable browser notifications"
              >
                <Bell className="w-4 h-4 mr-1" />
                Enable Notifications
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleSendTestEmail}
              disabled={!currentEmail || isSendingTest}
              className="border-accent/30 hover:bg-accent/10"
              title="Send a test email to this temp address"
            >
              <TestTube className={`w-4 h-4 mr-1 ${isSendingTest ? 'animate-pulse' : ''}`} />
              {isSendingTest ? 'Sending…' : 'Test'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckMail}
              disabled={isCheckingMail}
              className="border-primary/30 hover:bg-primary/10"
            >
              <Mail className={`w-4 h-4 mr-1 ${isCheckingMail ? 'animate-pulse' : ''}`} />
              {isCheckingMail ? 'Checking...' : 'Check Mail'}
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
                <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-secondary/60 border border-primary/20">
                  <span className="text-xs text-muted-foreground">Inbox for:</span>
                  <span className="font-mono text-primary font-medium">{currentEmail?.address || "..."}</span>
                </div>
                <div className="flex items-center justify-center gap-2 mt-3 text-xs text-green-500">
                  <Shield className="w-3 h-3" />
                  <span>Token-secured access</span>
                </div>
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
                
                {/* Attachments */}
                {loadingAttachments ? (
                  <div className="mt-4 flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading attachments...</span>
                  </div>
                ) : (
                  <EmailAttachments attachments={attachments} emailId={selectedEmail.id} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Inbox;
