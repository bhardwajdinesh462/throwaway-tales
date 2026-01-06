import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { useEmailVerification } from "@/hooks/useEmailVerification";
import { toast } from "sonner";

interface EmailVerificationBannerProps {
  onVerified?: () => void;
  showVerifiedStatus?: boolean;
}

export const EmailVerificationBanner = ({ onVerified, showVerifiedStatus = false }: EmailVerificationBannerProps) => {
  const { requiresVerification, resendVerificationEmail, isResending, userEmail, loading, emailVerified, refreshVerificationStatus } = useEmailVerification();
  const [isRechecking, setIsRechecking] = useState(false);

  const handleRecheck = async () => {
    setIsRechecking(true);
    try {
      // Clear any cached status
      localStorage.removeItem('email_verification_status');
      await refreshVerificationStatus();
      toast.success("Verification status refreshed");
    } catch (error) {
      toast.error("Failed to refresh status");
    } finally {
      setIsRechecking(false);
    }
  };

  // Don't render anything while loading to prevent flicker
  if (loading) {
    return null;
  }

  // Show verified indicator if requested and user is verified
  if (showVerifiedStatus && emailVerified) {
    return (
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 gap-1.5 py-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Email Verified
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRecheck}
          disabled={isRechecking}
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRechecking ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    );
  }

  if (!requiresVerification()) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Email Verification Required</AlertTitle>
      <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Please verify your email address ({userEmail}) to access premium features.
        </span>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRecheck}
            disabled={isRechecking}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${isRechecking ? 'animate-spin' : ''}`} />
            Re-check
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resendVerificationEmail}
            disabled={isResending}
          >
            <Mail className="mr-2 h-4 w-4" />
            {isResending ? "Sending..." : "Resend Email"}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default EmailVerificationBanner;