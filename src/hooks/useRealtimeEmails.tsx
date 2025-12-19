import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReceivedEmail {
  id: string;
  from_address: string;
  subject: string | null;
  body: string | null;
  is_read: boolean;
  received_at: string;
  temp_email_id: string;
}

interface UseRealtimeEmailsOptions {
  tempEmailId?: string;
  onNewEmail?: (email: ReceivedEmail) => void;
  showToast?: boolean;
  playSoundCallback?: () => void; // Accept sound callback from parent
  enablePushNotifications?: boolean;
}

export const useRealtimeEmails = (options: UseRealtimeEmailsOptions = {}) => {
  const { tempEmailId, onNewEmail, showToast = true, playSoundCallback, enablePushNotifications = true } = options;
  const [newEmailCount, setNewEmailCount] = useState(0);
  const [lastEmail, setLastEmail] = useState<ReceivedEmail | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");

  // Check push notification permission
  useEffect(() => {
    if ("Notification" in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  const isInIframe = useCallback(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const requestPushPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    // Browsers commonly block permission prompts inside embedded previews/iframes.
    if (isInIframe()) {
      toast.error('Push notifications can\'t be enabled in the embedded preview. Open the app in a new tab to enable.');
      return false;
    }

    if (Notification.permission === 'denied') {
      setPushPermission('denied');
      toast.error('Notification permission is blocked in your browser settings for this site.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission === 'granted') {
        toast.success('Push notifications enabled!');
        return true;
      }

      if (permission === 'denied') {
        toast.error('Notification permission denied. Please enable it in your browser settings.');
        return false;
      }

      toast.info('Notification permission dismissed');
      return false;
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Failed to request notification permission');
      return false;
    }
  }, [isInIframe]);

  const showPushNotification = useCallback((email: ReceivedEmail) => {
    if (!enablePushNotifications || pushPermission !== "granted") return;

    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification("New Email Received!", {
            body: `From: ${email.from_address}\n${email.subject || "(No Subject)"}`,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: `email-${email.id}`,
            requireInteraction: false,
            data: { emailId: email.id },
          });
        });
      } else {
        new Notification("New Email Received!", {
          body: `From: ${email.from_address}\n${email.subject || "(No Subject)"}`,
          icon: "/favicon.ico",
          tag: `email-${email.id}`,
        });
      }
    } catch (error) {
      console.log("Could not show push notification:", error);
    }
  }, [enablePushNotifications, pushPermission]);

  useEffect(() => {
    const filterConfig: any = {
      event: 'INSERT',
      schema: 'public',
      table: 'received_emails'
    };

    if (tempEmailId) {
      filterConfig.filter = `temp_email_id=eq.${tempEmailId}`;
    }

    console.log('[useRealtimeEmails] Setting up realtime subscription', filterConfig);

    const channelName = tempEmailId ? `received-emails-${tempEmailId}` : 'received-emails-all';

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        filterConfig,
        (payload) => {
          console.log('[useRealtimeEmails] New email received via realtime:', payload);
          
          const newEmail = payload.new as ReceivedEmail;
          setNewEmailCount(prev => prev + 1);
          setLastEmail(newEmail);

          // Call the callback if provided
          if (onNewEmail) {
            onNewEmail(newEmail);
          }

          // Show toast notification
          if (showToast) {
            toast.success('New Email Received!', {
              description: `From: ${newEmail.from_address}\nSubject: ${newEmail.subject || '(No Subject)'}`,
              duration: 5000,
            });
          }

          // Play sound using the callback from parent
          if (playSoundCallback) {
            console.log('[useRealtimeEmails] Playing sound via callback');
            playSoundCallback();
          }

          // Show push notification if page is hidden
          if (document.hidden) {
            showPushNotification(newEmail);
          }
        }
      )
      .subscribe((status) => {
        console.log('[useRealtimeEmails] Subscription status:', status);
      });

    return () => {
      console.log('[useRealtimeEmails] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [tempEmailId, onNewEmail, showToast, playSoundCallback, showPushNotification]);

  const resetCount = useCallback(() => {
    setNewEmailCount(0);
  }, []);

  return {
    newEmailCount,
    lastEmail,
    resetCount,
    pushPermission,
    requestPushPermission,
  };
};

export default useRealtimeEmails;
