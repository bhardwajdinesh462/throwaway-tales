import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Copy, Check, Link, AlertCircle, Loader2, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import { storage } from "@/lib/storage";

interface EmailSummaryProps {
  emailId: string;
  subject: string | null;
  body: string | null;
  htmlBody: string | null;
}

interface SummaryResult {
  summary: string;
  otpCodes: string[];
  importantLinks: { text: string; url: string }[];
  actionItems: string[];
  sender_intent: string;
}

const AI_SUMMARY_USAGE_KEY = 'nullsto_ai_summary_usage';

interface UsageData {
  date: string;
  count: number;
}

const getUsageToday = (): number => {
  const today = new Date().toISOString().split('T')[0];
  const usage = storage.get<UsageData>(AI_SUMMARY_USAGE_KEY, { date: today, count: 0 });
  if (usage.date !== today) {
    return 0;
  }
  return usage.count;
};

const incrementUsage = () => {
  const today = new Date().toISOString().split('T')[0];
  const usage = storage.get<UsageData>(AI_SUMMARY_USAGE_KEY, { date: today, count: 0 });
  if (usage.date !== today) {
    storage.set(AI_SUMMARY_USAGE_KEY, { date: today, count: 1 });
  } else {
    storage.set(AI_SUMMARY_USAGE_KEY, { date: today, count: usage.count + 1 });
  }
};

const EmailSummary = ({ emailId, subject, body, htmlBody }: EmailSummaryProps) => {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState(0);

  useEffect(() => {
    setUsageCount(getUsageToday());
  }, []);

  // Determine limits based on user type
  const isGuest = !user;
  const dailyLimit = isGuest ? settings.guestAiSummaryLimit : settings.userAiSummaryLimit;
  const isDisabled = !settings.aiSummaryEnabled || dailyLimit === 0;
  const isLimitReached = usageCount >= dailyLimit && dailyLimit > 0;

  const handleSummarize = async () => {
    if (isDisabled) {
      toast.error('AI summaries are currently disabled');
      return;
    }
    
    if (isLimitReached) {
      toast.error(`Daily limit of ${dailyLimit} AI summaries reached`);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('summarize-email', {
        body: { subject, body, htmlBody }
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      
      setSummary(data);
      incrementUsage();
      setUsageCount(prev => prev + 1);
      toast.success('Email analyzed successfully!');
    } catch (err: any) {
      console.error('Error summarizing email:', err);
      const message = err?.message || 'Failed to analyze email';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(text);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  // If AI summaries are disabled
  if (isDisabled) {
    return null;
  }

  if (!summary && !isLoading) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleSummarize}
        disabled={isLimitReached}
        className="gap-2 border-primary/30 hover:bg-primary/10"
        title={isLimitReached ? `Daily limit of ${dailyLimit} reached` : undefined}
      >
        {isLimitReached ? (
          <Lock className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Sparkles className="w-4 h-4 text-primary" />
        )}
        AI Summary
        {dailyLimit > 0 && (
          <span className="text-xs text-muted-foreground">({usageCount}/{dailyLimit})</span>
        )}
      </Button>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-primary/10 rounded-lg border border-primary/20">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm text-foreground">Analyzing email with AI...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 rounded-lg border border-destructive/20">
        <AlertCircle className="w-4 h-4 text-destructive" />
        <span className="text-sm text-destructive">{error}</span>
        <Button variant="ghost" size="sm" onClick={handleSummarize} className="ml-auto">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-gradient-to-br from-primary/10 via-background to-accent/10 rounded-lg border border-primary/20 overflow-hidden"
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-primary/5 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">AI Analysis</span>
              {summary.otpCodes.length > 0 && (
                <Badge variant="secondary" className="bg-green-500/20 text-green-500 border-green-500/30">
                  {summary.otpCodes.length} Code{summary.otpCodes.length > 1 ? 's' : ''} Found
                </Badge>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>

          {/* Content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-border/50"
              >
                <div className="p-4 space-y-4">
                  {/* Summary */}
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Summary</h4>
                    <p className="text-sm text-foreground">{summary.summary}</p>
                  </div>

                  {/* OTP Codes */}
                  {summary.otpCodes.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Verification Codes
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {summary.otpCodes.map((code, index) => (
                          <motion.button
                            key={index}
                            onClick={() => copyToClipboard(code)}
                            className="flex items-center gap-2 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg transition-colors group"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <span className="font-mono text-lg font-bold text-green-500">{code}</span>
                            {copiedCode === code ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4 text-green-500/70 group-hover:text-green-500" />
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Important Links */}
                  {summary.importantLinks.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Important Links
                      </h4>
                      <div className="space-y-2">
                        {summary.importantLinks.map((link, index) => (
                          <a
                            key={index}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 bg-secondary/50 hover:bg-secondary border border-border rounded-lg transition-colors group"
                          >
                            <Link className="w-4 h-4 text-primary" />
                            <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                              {link.text || link.url}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Items */}
                  {summary.actionItems.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Action Items
                      </h4>
                      <ul className="space-y-1">
                        {summary.actionItems.map((item, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="text-primary mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Sender Intent */}
                  <div className="pt-2 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">Intent: </span>
                    <span className="text-xs text-foreground">{summary.sender_intent}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmailSummary;
