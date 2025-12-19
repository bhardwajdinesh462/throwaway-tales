import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({ 
  children, 
  requireAuth = true, 
  requireAdmin = false 
}: ProtectedRouteProps) => {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    // If auth required but no user, redirect to login
    if (requireAuth && !user) {
      navigate("/auth", { replace: true });
      return;
    }

    // If admin required but user is not admin, redirect to dashboard
    if (requireAdmin && !isAdmin) {
      navigate("/dashboard", { replace: true });
      return;
    }
  }, [user, isAdmin, isLoading, requireAuth, requireAdmin, navigate]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If auth required but no user, don't render
  if (requireAuth && !user) {
    return null;
  }

  // If admin required but not admin, don't render
  if (requireAdmin && !isAdmin) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
