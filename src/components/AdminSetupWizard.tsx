import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { toast } from "sonner";

interface AdminSetupWizardProps {
  onComplete: () => void;
}

const AdminSetupWizard = ({ onComplete }: AdminSetupWizardProps) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claimAdminRole = async () => {
    if (!user) {
      toast.error("You must be logged in to claim admin role");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('claim_first_admin');

      if (rpcError) {
        console.error('Error claiming admin:', rpcError);
        setError(rpcError.message);
        toast.error(rpcError.message);
      } else if (data === true) {
        toast.success("🎉 Admin role claimed successfully! You now have full access.");
        onComplete();
      }
    } catch (err) {
      console.error('Error claiming admin:', err);
      setError("An unexpected error occurred");
      toast.error("Failed to claim admin role");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="glass-card border-primary/20">
          <CardHeader className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto p-4 rounded-full bg-primary/10"
            >
              <Shield className="w-12 h-12 text-primary" />
            </motion.div>
            <CardTitle className="text-2xl">Welcome to Admin Setup</CardTitle>
            <CardDescription className="text-base">
              No administrators have been configured yet. As the first user, you can claim the admin role to get started.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current User Info */}
            <div className="p-4 bg-muted/50 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground">Logged in as:</p>
              <p className="font-medium text-foreground">{user?.email}</p>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-600 dark:text-amber-400">
                <p className="font-medium">Important</p>
                <p>This action can only be performed once. The admin role grants full access to manage the application.</p>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Claim Button */}
            <Button
              onClick={claimAdminRole}
              disabled={isLoading}
              className="w-full gap-2"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Claiming Admin Role...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  Claim Admin Role
                </>
              )}
            </Button>

            {/* Success indicator styling */}
            <div className="text-center text-xs text-muted-foreground">
              <CheckCircle className="w-4 h-4 inline mr-1" />
              Secure one-time setup process
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default AdminSetupWizard;
