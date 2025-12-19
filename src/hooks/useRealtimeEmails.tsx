import { useEffect, useCallback, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useSupabaseAuth";

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
  playSound?: boolean;
  enablePushNotifications?: boolean;
}

export const useRealtimeEmails = (options: UseRealtimeEmailsOptions = {}) => {
  const { tempEmailId, onNewEmail, showToast = true, playSound = true, enablePushNotifications = true } = options;
  const { user } = useAuth();
  const [newEmailCount, setNewEmailCount] = useState(0);
  const [lastEmail, setLastEmail] = useState<ReceivedEmail | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Check and request push notification permission
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
      toast.error('Notifications can’t be enabled in the embedded preview. Open the app in a new tab, then try again.');
      return false;
    }

    // If the user previously blocked notifications, we cannot re-prompt programmatically.
    if (Notification.permission === 'denied') {
      setPushPermission('denied');
      toast.error('Notification permission is blocked in your browser settings for this site.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission === 'granted') {
        toast.success('Notifications enabled!');
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
      // Try service worker notification first
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
        // Fallback to regular notification
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

  // Get or create audio context
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Unlock audio - must be called from user interaction
  const unlockAudio = useCallback(async () => {
    try {
      const audioContext = getAudioContext();
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // Play a silent sound to unlock
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.001);
      
      setAudioUnlocked(true);
      console.log('[useRealtimeEmails] Audio unlocked');
      return true;
    } catch (error) {
      console.error('[useRealtimeEmails] Failed to unlock audio:', error);
      return false;
    }
  }, [getAudioContext]);

  const playNotificationSound = useCallback(async () => {
    if (!playSound) return;
    
    try {
      const audioContext = getAudioContext();
      
      // Resume context if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      // Create a simple notification sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      if (!audioUnlocked) {
        setAudioUnlocked(true);
      }
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }, [playSound, getAudioContext, audioUnlocked]);

  useEffect(() => {
    // Build the filter for the channel
    const filterConfig: any = {
      event: 'INSERT',
      schema: 'public',
      table: 'received_emails'
    };

    // If tempEmailId is provided, filter by it
    if (tempEmailId) {
      filterConfig.filter = `temp_email_id=eq.${tempEmailId}`;
    }

    console.log('Setting up realtime subscription for received_emails', filterConfig);

    const channelName = tempEmailId ? `received-emails-${tempEmailId}` : 'received-emails-all';

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        filterConfig,
        (payload) => {
          console.log('New email received via realtime:', payload);
          
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

          // Play notification sound (only if caller doesn't handle new-email behavior)
          if (!onNewEmail) {
            playNotificationSound();
          }

          // Show push notification (if page is not visible)
          if (document.hidden) {
            showPushNotification(newEmail);
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [tempEmailId, onNewEmail, showToast, playNotificationSound, showPushNotification]);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  const resetCount = useCallback(() => {
    setNewEmailCount(0);
  }, []);

  return {
    newEmailCount,
    lastEmail,
    resetCount,
    pushPermission,
    requestPushPermission,
    audioUnlocked,
    unlockAudio,
  };
};

export default useRealtimeEmails;
