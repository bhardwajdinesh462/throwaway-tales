import { useAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useCallback, useEffect, useRef } from "react";

const CACHE_KEY = 'email_verification_status';
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (shorter for faster updates)

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
  const lastUserIdRef = useRef<string | null>(null);

  // Clear cache when user changes or on verification success
  const clearVerificationCache = useCallback(() => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Fetch email_verified from profiles table with caching
  useEffect(() => {
    const fetchVerificationStatus = async () => {
      if (!user?.id) {
        setEmailVerified(null);
        setLoading(false);
        setVerificationChecked(true);
        lastUserIdRef.current = null;
        return;
      }

      // If user changed, reset the fetch ref
      if (lastUserIdRef.current !== user.id) {
        fetchedRef.current = false;
        lastUserIdRef.current = user.id;
        clearVerificationCache(); // Clear old cache for new user
      }

      // Check cache first to prevent flicker
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed: CachedStatus = JSON.parse(cached);
          if (parsed.userId === user.id && Date.now() - parsed.timestamp < CACHE_DURATION) {
            // If cached as verified, trust it
            if (parsed.verified) {
              setEmailVerified(true);
              setLoading(false);
              setVerificationChecked(true);
              return; // Don't fetch again if verified
            }
            // If cached as NOT verified, still fetch to check for updates
            setEmailVerified(parsed.verified);
            setLoading(false);
            setVerificationChecked(true);
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
          .maybeSingle(); // Use maybeSingle to handle missing profile

        if (error) {
          console.error('Error fetching email verification status:', error);
          // If we can't read the profile, default to NOT verified (safer)
          if (emailVerified === null) {
            setEmailVerified(false);
          }
        } else if (!data) {
          // No profile row yet (common right after signup). Fall back to auth email confirmation.
          const { data: authData, error: authError } = await supabase.auth.getUser();
          const confirmed =
            !authError &&
            Boolean(
              (authData.user as any)?.email_confirmed_at ||
                (authData.user as any)?.confirmed_at
            );

          setEmailVerified(confirmed);

          // If auth says confirmed, also create/update profile so the rest of the app can rely on it.
          if (confirmed && user.email) {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();

            if (existingProfile?.id) {
              await supabase
                .from('profiles')
                .update({ email_verified: true, email: user.email })
                .eq('user_id', user.id);
            } else {
              await supabase.from('profiles').insert({
                user_id: user.id,
                email: user.email,
                email_verified: true,
              });
            }
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
      // Don't reset fetchedRef on cleanup - only when user changes
    };
  }, [user?.id, clearVerificationCache]);

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

  // Refresh verification status (bypass cache, force fresh fetch)
  const refreshVerificationStatus = useCallback(async () => {
    if (!user?.id) return;
    
    // Clear cache first
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // ignore
    }
    
    // Reset fetchedRef to allow a fresh fetch
    fetchedRef.current = false;
    
    setLoading(true);
    try {
      // First check auth provider for latest status
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const confirmed =
        !authError &&
        Boolean(
          (authData.user as any)?.email_confirmed_at ||
            (authData.user as any)?.confirmed_at
        );

      // Then check profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('email_verified')
        .eq('user_id', user.id)
        .maybeSingle();

      let verified = !error && data?.email_verified === true;

      // If profile says not verified but auth says confirmed, update profile
      if (!verified && confirmed && user.email) {
        verified = true;
        
        if (data) {
          await supabase
            .from('profiles')
            .update({ email_verified: true, email: user.email })
            .eq('user_id', user.id);
        } else {
          await supabase.from('profiles').insert({
            user_id: user.id,
            email: user.email,
            email_verified: true,
          });
        }
      }

      setEmailVerified(verified);
      
      // Update cache with new value
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          userId: user.id,
          verified,
          timestamp: Date.now()
        }));
      } catch {
        // ignore
      }
    } catch (err) {
      console.error('Error refreshing verification status:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email]);

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
