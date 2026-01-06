import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, RefreshCw, Star, Clock, User, ChevronRight, Inbox as InboxIcon, Loader2, Bell, Shield, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ReceivedEmail } from "@/hooks/useSecureEmailService";
import { useEmailService } from "@/contexts/EmailServiceContext";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDistanceToNow } from "date-fns";
import { storage } from "@/lib/storage";
import { useRealtimeEmails } from "@/hooks/useRealtimeEmails";
import { Attachment } from "@/components/EmailAttachments";
import EmailPreview from "@/components/EmailPreview";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { saveImapFetchStats } from "@/components/InboxDiagnostics";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import KeyboardShortcutsHelp from "@/components/KeyboardShortcutsHelp";
import { useNotificationSounds } from "@/hooks/useNotificationSounds";
import { getErrorMessage } from "@/lib/errorHandler";
import { useAdminRole } from "@/hooks/useAdminRole";
import InboxDiagnostics from "@/components/InboxDiagnostics";
import { tooltips } from "@/lib/tooltips";
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
  const { isAdmin } = useAdminRole();
  
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // 4. All useRef hooks together
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const refreshRef = useRef<NodeJS.Timeout | null>(null);

  // Notification sounds - auto-unlocks on user interaction
  const { playSound } = useNotificationSounds();
  const skipNextListSoundRef = useRef(false);

  const playSoundFromRealtime = useCallback(() => {
    skipNextListSoundRef.current = true;
    void playSound();
  }, [playSound]);

  // 5. All useCallback hooks together
  const handleNewEmail = useCallback(() => {
    console.log('[Inbox] New email received via realtime, refetching...');
    if (refetch) {
      refetch();
    }
    // Note: Sound is played by useRealtimeEmails via playSoundFromRealtime
  }, [refetch]);

  // 6. Real-time hook
  const { newEmailCount, resetCount, pushPermission, requestPushPermission } = useRealtimeEmails({
    tempEmailId: currentEmail?.id,
    onNewEmail: handleNewEmail,
    showToast: true,
    playSoundCallback: playSoundFromRealtime,
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
          try {
            const result = await triggerImapFetch({ mode: "latest", limit: 10 });
            if ((result?.stats?.stored ?? 0) > 0) {
              playSound();
            }
          } catch (e) {
            // Prevent background refresh from crashing the UI if IMAP is temporarily failing.
            console.warn("[Inbox] IMAP poll failed during refresh:", e);
          }
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
    [refreshInterval, refetch, triggerImapFetch, playSound]
  );

  // Auto-refresh functionality
  useEffect(() => {
    // Don't start polling until we actually have an inbox selected
    if (!currentEmail?.id) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (refreshRef.current) clearInterval(refreshRef.current);
      return;
    }

    if (!autoRefreshEnabled) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (refreshRef.current) clearInterval(refreshRef.current);
      return;
    }

    // Countdown timer (visual only - no IMAP polling on auto-refresh to reduce server load)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-refresh timer - only refetch from DB (realtime handles new emails)
    // NO IMAP polling here - that's manual only via "Check Mail" button
    refreshRef.current = setInterval(() => {
      void handleRefresh(true, { pollImap: false });
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
    const startTime = Date.now();
    try {
      const result = await triggerImapFetch({ mode: "latest", limit: 20 });
      const stats = result?.stats;
      
      // Save stats for diagnostics panel
      saveImapFetchStats({
        scanned: stats?.scanned || 0,
        matched: stats?.matched || 0,
        stored: stats?.stored || 0,
        noMatch: stats?.noMatch || 0,
        failed: stats?.failed || 0,
        duration: Date.now() - startTime,
      });
      
      if (stats?.stored > 0) {
        if (soundEnabled) {
          playSound();
        }
        toast.success(`Found ${stats.stored} new email${stats.stored > 1 ? 's' : ''}!`);
      } else if (stats?.noMatch > 0) {
        toast.info(`${stats.noMatch} emails scanned but none matched your temp address`);
      } else {
        toast.info('No new emails found');
      }
    } catch (error: any) {
      console.error('Error checking mail:', error);
      const errorMsg = getErrorMessage(error);
      saveImapFetchStats({
        scanned: 0,
        matched: 0,
        stored: 0,
        noMatch: 0,
        failed: 1,
        duration: Date.now() - startTime,
        error: errorMsg,
      });
      toast.error(errorMsg);
    } finally {
      setIsCheckingMail(false);
    }
  };

  // Send a test email to the currently generated temp address (uses stored SMTP settings)
  const handleSendTestEmail = async () => {
    if (!currentEmail?.address) {
      toast.error('No active email address yet');
      return;
    }

    setIsSendingTest(true);
    try {
      // Load SMTP settings from local storage (same as Admin SMTP panel)
      const storedSmtp = storage.get<{
        host: string;
        port: number;
        username: string;
        password: string;
        encryption: 'none' | 'ssl' | 'tls';
        fromEmail: string;
        fromName: string;
      } | null>('smtp_settings', null);

      // Build smtpConfig - use username as fromEmail if fromEmail is empty
      const smtpConfig = storedSmtp ? {
        host: storedSmtp.host,
        port: storedSmtp.port,
        username: storedSmtp.username,
        password: storedSmtp.password,
        encryption: storedSmtp.encryption,
        fromEmail: storedSmtp.fromEmail || storedSmtp.username, // Default to username
        fromName: storedSmtp.fromName || 'Nullsto',
      } : undefined;

      if (!smtpConfig?.host || !smtpConfig?.username) {
        toast.error('SMTP not configured. Please set up SMTP in Admin → Email → SMTP Settings');
        setIsSendingTest(false);
        return;
      }

      console.log('[Test Email] Using SMTP:', smtpConfig.host, smtpConfig.port, 'from:', smtpConfig.fromEmail);

      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          recipientEmail: currentEmail.address,
          subject: 'Nullsto inbox test',
          body: `<p>Test message for <strong>${currentEmail.address}</strong></p>`,
          smtpConfig,
        },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Send failed');

      toast.success(`Test email sent via ${smtpConfig.host}! Waiting for delivery...`);

      // Wait a bit for SMTP delivery before fetching
      await new Promise((resolve) => setTimeout(resolve, 3000));

      toast.loading('Checking for new mail...');
      const fetchStart = Date.now();
      const result = await triggerImapFetch({ mode: "latest", limit: 20 });
      toast.dismiss();

      const stats = result?.stats;
      
      // Save stats for diagnostics panel
      saveImapFetchStats({
        scanned: stats?.scanned || 0,
        matched: stats?.matched || 0,
        stored: stats?.stored || 0,
        noMatch: stats?.noMatch || 0,
        failed: stats?.failed || 0,
        duration: Date.now() - fetchStart,
      });
      
      if (stats?.stored > 0) {
        if (soundEnabled) {
          playSound();
        }
        toast.success(`Email received! ${stats.stored} new message${stats.stored > 1 ? 's' : ''}`);
      } else if (stats?.noMatch > 0) {
        toast.warning('Mail scanned but did not match your temp address. Check logs for recipient parsing.');
      } else {
        toast.info('No new emails yet. Try clicking Check Mail again in a few seconds.');
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast.error(getErrorMessage(error));
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

  // Copy current email address to clipboard
  const copyEmailAddress = useCallback(() => {
    if (currentEmail?.address) {
      navigator.clipboard.writeText(currentEmail.address);
      toast.success("Email address copied!");
    }
  }, [currentEmail?.address]);

  // Navigate emails with J/K keys - using refs to avoid stale closures
  const navigateUp = useCallback(() => {
    if (receivedEmails.length === 0) return;
    setSelectedIndex(prev => {
      const newIndex = Math.max(0, prev - 1);
      const email = receivedEmails[newIndex];
      if (email) {
        setSelectedEmail(email);
        if (!email.is_read) markAsRead(email.id);
      }
      return newIndex;
    });
  }, [receivedEmails, markAsRead]);

  const navigateDown = useCallback(() => {
    if (receivedEmails.length === 0) return;
    setSelectedIndex(prev => {
      const newIndex = Math.min(receivedEmails.length - 1, prev + 1);
      const email = receivedEmails[newIndex];
      if (email) {
        setSelectedEmail(email);
        if (!email.is_read) markAsRead(email.id);
      }
      return newIndex;
    });
  }, [receivedEmails, markAsRead]);

  // Open selected email with Enter
  const openSelectedEmail = useCallback(() => {
    if (receivedEmails.length > 0) {
      const email = receivedEmails[selectedIndex];
      if (email) {
        setSelectedEmail(email);
        if (!email.is_read) markAsRead(email.id);
      }
    }
  }, [receivedEmails, selectedIndex, markAsRead]);

  // Close email preview with Escape
  const closeEmailPreview = useCallback(() => {
    setSelectedEmail(null);
  }, []);

  // Keyboard shortcuts
  const { showHelp, setShowHelp, shortcuts } = useKeyboardShortcuts({
    enabled: true,
    shortcuts: [
      { key: 'r', description: 'Refresh inbox', action: () => handleRefresh(false) },
      { key: 'c', description: 'Copy email address', action: copyEmailAddress },
      { key: 'j', description: 'Next email', action: navigateDown },
      { key: 'k', description: 'Previous email', action: navigateUp },
      { key: 'Enter', description: 'Open email', action: openSelectedEmail },
      { key: 'Escape', description: 'Close email preview', action: closeEmailPreview },
      { key: 'n', description: 'Check new mail', action: handleCheckMail },
    ],
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="w-full h-full flex flex-col"
    >
      <div className="glass-card overflow-hidden flex-1 flex flex-col">
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

            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>
                <p>{tooltips.inbox.refresh}</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleRefresh(false)}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {t('refresh')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh inbox to check for new emails</p>
              </TooltipContent>
            </Tooltip>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(true)}
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
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
        <div className="divide-y divide-border flex-1 overflow-auto">
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
              receivedEmails.map((email, index) => {
                // Clean preview snippet - remove MIME artifacts and HTML
                const getCleanPreview = (body: string | null | undefined) => {
                  if (!body) return 'No content';
                  let clean = body
                    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
                    .replace(/--[A-Za-z0-9_-]+/g, '') // Remove MIME boundaries
                    .replace(/Content-Type:[^\n]+/gi, '')
                    .replace(/Content-Transfer-Encoding:[^\n]+/gi, '')
                    .replace(/charset=[^\s;]+/gi, '')
                    .replace(/boundary=[^\s;]+/gi, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                  return clean.slice(0, 200) || 'No content';
                };

                return (
                  <TooltipProvider key={email.id} delayDuration={400}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.div
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
                      </TooltipTrigger>
                      <TooltipContent 
                        side="right" 
                        className="max-w-xs p-3 bg-popover border border-border shadow-lg"
                        sideOffset={8}
                      >
                        <div className="space-y-2">
                          <p className="font-medium text-sm text-foreground line-clamp-1">
                            {email.subject || 'No Subject'}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-4">
                            {getCleanPreview(email.body)}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Selected Email Preview */}
        <AnimatePresence>
          {selectedEmail && (
            <EmailPreview
              email={selectedEmail}
              attachments={attachments}
              loadingAttachments={loadingAttachments}
              onClose={() => setSelectedEmail(null)}
            />
          )}
        </AnimatePresence>

        {/* Diagnostics Panel - Only for admins */}
        {isAdmin && <InboxDiagnostics />}
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        shortcuts={shortcuts}
      />
    </motion.div>
  );
};

export default Inbox;
