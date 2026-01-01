import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Mail, AlertCircle } from "lucide-react";
import { useEmailVerification } from "@/hooks/useEmailVerification";

interface EmailVerificationBannerProps {
  onVerified?: () => void;
}

export const EmailVerificationBanner = ({ onVerified }: EmailVerificationBannerProps) => {
  const { requiresVerification, resendVerificationEmail, isResending, userEmail, loading } = useEmailVerification();

  // Don't render anything while loading to prevent flicker
  if (loading) {
    return null;
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
        <Button
          variant="outline"
          size="sm"
          onClick={resendVerificationEmail}
          disabled={isResending}
          className="shrink-0"
        >
          <Mail className="mr-2 h-4 w-4" />
          {isResending ? "Sending..." : "Resend Email"}
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default EmailVerificationBanner;