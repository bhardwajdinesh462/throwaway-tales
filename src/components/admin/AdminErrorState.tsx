import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const AdminErrorState = ({
  title = "Failed to load data",
  message = "An error occurred while fetching data. Please try again.",
  onRetry,
  isRetrying = false,
}: AdminErrorStateProps) => {
  return (
    <div className="glass-card p-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-destructive/10">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-md">{message}</p>
        </div>
        {onRetry && (
          <Button
            variant="outline"
            onClick={onRetry}
            disabled={isRetrying}
            className="mt-2"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "Retrying..." : "Try Again"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default AdminErrorState;
