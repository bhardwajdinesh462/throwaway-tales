import { useAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useCallback, useEffect, useRef } from "react";

const CACHE_KEY = 'email_verification_status';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedStatus {
  userId: string;
  verified: boolean;
  timestamp: number;
}

export const useEmailVerification = () => {
  const { user } = useAuth();
  const [isResending, setIsResending] = useState(false);
  // Start with null to indicate "unknown" - prevents showing banner until checked
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [verificationChecked, setVerificationChecked] = useState(false);
  const fetchedRef = useRef(false);

  // Fetch email_verified from profiles table with caching
  useEffect(() => {
    const fetchVerificationStatus = async () => {
      if (!user?.id) {
        setEmailVerified(null);
        setLoading(false);
        setVerificationChecked(true);
        return;
      }

      // Check cache first to prevent flicker
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed: CachedStatus = JSON.parse(cached);
          if (parsed.userId === user.id && Date.now() - parsed.timestamp < CACHE_DURATION) {
            setEmailVerified(parsed.verified);
            setLoading(false);
            setVerificationChecked(true);
            // Still fetch in background to update
          }
        }
      } catch {
        // Ignore cache errors
      }

      // Prevent duplicate fetches
      if (fetchedRef.current) return;
      fetchedRef.current = true;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email_verified')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching email verification status:', error);
          // Only set to false if we haven't already set from cache
          if (emailVerified === null) {
            setEmailVerified(false);
          }
        } else {
          const verified = data?.email_verified ?? false;
          setEmailVerified(verified);
          // Update cache
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
              userId: user.id,
              verified,
              timestamp: Date.now()
            }));
          } catch {
            // Ignore storage errors
          }
        }
      } catch (err) {
        console.error('Error fetching verification status:', err);
        if (emailVerified === null) {
          setEmailVerified(false);
        }
      } finally {
        setLoading(false);
        setVerificationChecked(true);
      }
    };

    fetchVerificationStatus();
    
    return () => {
      fetchedRef.current = false;
    };
  }, [user?.id]);

  const isEmailVerified = useCallback(() => {
    if (!user) return false;
    return emailVerified === true;
  }, [user, emailVerified]);

  const requiresVerification = useCallback(() => {
    if (!user) return true;
    return emailVerified !== true;
  }, [user, emailVerified]);

  const resendVerificationEmail = useCallback(async () => {
    if (!user?.email || !user?.id) {
      toast.error("No email address found");
      return false;
    }

    setIsResending(true);
    try {
      // Use the combined edge function that bypasses RLS
      const { data, error } = await supabase.functions.invoke('create-verification-and-send', {
        body: {
          userId: user.id,
          email: user.email,
          name: user.user_metadata?.display_name || user.email.split('@')[0]
        }
      });

      if (error) {
        console.error('Error sending verification email:', error);
        toast.error(error.message || "Failed to send verification email");
        return false;
      }

      if (data?.error) {
        toast.error(data.error);
        return false;
      }

      toast.success("Verification email sent! Check your inbox.");
      return true;
    } catch (error) {
      console.error('Error sending verification email:', error);
      toast.error("Failed to send verification email");
      return false;
    } finally {
      setIsResending(false);
    }
  }, [user?.email, user?.id, user?.user_metadata?.display_name]);

  // Refresh verification status
  const refreshVerificationStatus = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email_verified')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setEmailVerified(data.email_verified ?? false);
      }
    } catch (err) {
      console.error('Error refreshing verification status:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  return {
    isEmailVerified,
    requiresVerification,
    resendVerificationEmail,
    isResending,
    userEmail: user?.email,
    emailVerified,
    loading,
    refreshVerificationStatus,
    verificationChecked,
  };
};

export default useEmailVerification;
