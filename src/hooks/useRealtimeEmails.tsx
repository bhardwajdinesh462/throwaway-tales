import { useEffect, useCallback, useState } from "react";
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
}

export const useRealtimeEmails = (options: UseRealtimeEmailsOptions = {}) => {
  const { tempEmailId, onNewEmail, showToast = true, playSound = true } = options;
  const { user } = useAuth();
  const [newEmailCount, setNewEmailCount] = useState(0);
  const [lastEmail, setLastEmail] = useState<ReceivedEmail | null>(null);

  const playNotificationSound = useCallback(() => {
    if (!playSound) return;
    
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }, [playSound]);

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

    const channel = supabase
      .channel('received-emails-realtime')
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

          // Play notification sound
          playNotificationSound();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [tempEmailId, onNewEmail, showToast, playNotificationSound]);

  const resetCount = useCallback(() => {
    setNewEmailCount(0);
  }, []);

  return {
    newEmailCount,
    lastEmail,
    resetCount,
  };
};

export default useRealtimeEmails;
