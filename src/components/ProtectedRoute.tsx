import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({
  children,
  requireAuth = true,
  requireAdmin = false,
}: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const [adminCheckLoading, setAdminCheckLoading] = useState(false);
  const [adminVerified, setAdminVerified] = useState(false);

  // Auth gating
  useEffect(() => {
    if (isLoading) return;

    if (requireAuth && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, isLoading, requireAuth, navigate]);

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
