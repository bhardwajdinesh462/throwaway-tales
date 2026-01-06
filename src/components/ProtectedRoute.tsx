import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";
import { useRegistrationSettings } from "@/hooks/useRegistrationSettings";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requireEmailVerification?: boolean;
}

const ProtectedRoute = ({
  children,
  requireAuth = true,
  requireAdmin = false,
  requireEmailVerification = false,
}: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings: registrationSettings, isLoading: settingsLoading } = useRegistrationSettings();

  const [adminCheckLoading, setAdminCheckLoading] = useState(false);
  const [adminVerified, setAdminVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);

  // Auth gating
  useEffect(() => {
    if (isLoading) return;

    if (requireAuth && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, isLoading, requireAuth, navigate]);

  // Email verification check
  useEffect(() => {
    if (!user?.id || isLoading || settingsLoading) return;
    
    // Skip email verification check for admin users and certain pages
    const skipPaths = ['/auth', '/verify-email', '/'];
    if (skipPaths.includes(location.pathname)) return;

    // Only check if email confirmation is required by admin settings
    if (!registrationSettings.requireEmailConfirmation && !requireEmailVerification) {
      setEmailVerified(true);
      return;
    }

    let cancelled = false;

    (async () => {
      setEmailCheckLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('email_verified')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        let verified = !error && data?.email_verified === true;

        // If profile row is missing OR not marked verified, fall back to auth provider confirmation.
        if (!verified) {
          const { data: authData, error: authError } = await supabase.auth.getUser();
          const confirmed =
            !authError &&
            Boolean(
              (authData.user as any)?.email_confirmed_at ||
                (authData.user as any)?.confirmed_at
            );

          if (confirmed) {
            verified = true;

            // Persist so subsequent checks are fast and consistent.
            if (user.email) {
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
          }
        }

        setEmailVerified(verified);

        // If email not verified and confirmation is required, redirect to verify page
        if (!verified && (registrationSettings.requireEmailConfirmation || requireEmailVerification)) {
          // Check if user is admin - admins bypass email verification
          const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
          if (!isAdmin) {
            navigate("/verify-email", {
              replace: true,
              state: { email: user.email, from: location.pathname },
            });
          } else {
            setEmailVerified(true); // Admins are always considered verified
          }
        }
      } catch (err) {
        console.error("Email verification check failed:", err);
        setEmailVerified(false);
      } finally {
        if (!cancelled) setEmailCheckLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isLoading, settingsLoading, registrationSettings.requireEmailConfirmation, requireEmailVerification, navigate, location.pathname, user?.email]);

  // Admin gating (server-verified to avoid client-side race conditions)
  useEffect(() => {
    if (!requireAdmin) {
      setAdminCheckLoading(false);
      setAdminVerified(false);
      return;
    }

    if (isLoading) return;
    if (!user) return;

    let cancelled = false;

    (async () => {
      setAdminCheckLoading(true);
      const { data, error } = await supabase.rpc("is_admin", { _user_id: user.id });
      const ok = !error && data === true;

      if (cancelled) return;

      setAdminVerified(ok);
      setAdminCheckLoading(false);

      if (!ok) {
        navigate("/dashboard", { replace: true });
      }
    })().catch((err) => {
      console.error("Admin check failed:", err);
      if (cancelled) return;
      setAdminVerified(false);
      setAdminCheckLoading(false);
      navigate("/dashboard", { replace: true });
    });

    return () => {
      cancelled = true;
    };
  }, [requireAdmin, user, isLoading, navigate]);

  // Only show loader for initial auth check, not admin check (admin pages load faster)
  if (isLoading) {
    return null; // Return null for instant rendering
  }

  // For admin routes, render immediately while checking in background
  if (requireAdmin && adminCheckLoading) {
    return <>{children}</>; // Show content while verifying admin status
  }

  if (requireAuth && !user) return null;
  if (requireAdmin && !adminVerified) return null;

  return <>{children}</>;
};

export default ProtectedRoute;
