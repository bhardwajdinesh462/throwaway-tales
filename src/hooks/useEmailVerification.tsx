import { useAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useCallback, useEffect } from "react";

export const useEmailVerification = () => {
  const { user } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch email_verified from profiles table
  useEffect(() => {
    const fetchVerificationStatus = async () => {
      if (!user?.id) {
        setEmailVerified(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email_verified')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching email verification status:', error);
          setEmailVerified(false);
        } else {
          setEmailVerified(data?.email_verified ?? false);
        }
      } catch (err) {
        console.error('Error fetching verification status:', err);
        setEmailVerified(false);
      } finally {
        setLoading(false);
      }
    };

    fetchVerificationStatus();
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
  };
};

export default useEmailVerification;
