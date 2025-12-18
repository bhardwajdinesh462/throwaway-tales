import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, RefreshCw, Trash2, Star, Clock, User, ChevronRight, Inbox as InboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmailService, ReceivedEmail } from "@/hooks/useEmailService";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

const Inbox = () => {
  const { user } = useAuth();
  const { receivedEmails, isLoading, markAsRead, saveEmail, generateEmail, currentEmail } = useEmailService();
  const [selectedEmail, setSelectedEmail] = useState<ReceivedEmail | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savedEmails, setSavedEmails] = useState<Set<string>>(new Set());

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Just trigger a re-render, real-time handles updates
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleSelectEmail = (email: ReceivedEmail) => {
    setSelectedEmail(email);
    if (!email.is_read) {
      markAsRead(email.id);
    }
  };

  const handleSave = async (emailId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const success = await saveEmail(emailId);
    if (success) {
      setSavedEmails(prev => new Set([...prev, emailId]));
    }
  };

  const formatTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="w-full max-w-4xl mx-auto mt-8"
    >
      <div className="glass-card overflow-hidden">
        {/* Inbox Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Inbox</h2>
            <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">
              {receivedEmails.filter(e => !e.is_read).length} new
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Email List */}
        <div className="divide-y divide-border">
          <AnimatePresence>
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-muted-foreground">Loading inbox...</p>
              </div>
            ) : receivedEmails.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-12 text-center"
              >
                <InboxIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-foreground font-medium mb-2">No emails yet</p>
                <p className="text-sm text-muted-foreground">
                  Waiting for incoming messages at:
                </p>
                <p className="text-sm text-primary font-mono mt-1">
                  {currentEmail?.address || "..."}
                </p>
              </motion.div>
            ) : (
              receivedEmails.map((email, index) => (
                <motion.div
                  key={email.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelectEmail(email)}
                  className={`group p-4 cursor-pointer transition-colors hover:bg-secondary/30 ${
                    !email.is_read ? 'bg-primary/5' : ''
                  } ${selectedEmail?.id === email.id ? 'bg-secondary/50' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>

                    {/* Email Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm truncate ${!email.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {email.from_address}
                        </span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">{formatTime(email.received_at)}</span>
                        </div>
                      </div>
                      <p className={`text-sm truncate ${!email.is_read ? 'font-medium text-foreground' : 'text-foreground/80'}`}>
                        {email.subject || "(No subject)"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {email.body?.slice(0, 100) || "(No content)"}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {user && (
                        <button
                          onClick={(e) => handleSave(email.id, e)}
                          className={`p-1.5 rounded hover:bg-secondary transition-colors ${
                            savedEmails.has(email.id) ? 'text-yellow-400' : 'text-muted-foreground'
                          }`}
                        >
                          <Star className="w-4 h-4" fill={savedEmails.has(email.id) ? "currentColor" : "none"} />
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Selected Email Preview */}
        <AnimatePresence>
          {selectedEmail && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border bg-secondary/20"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    {selectedEmail.subject || "(No subject)"}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)}>
                    Close
                  </Button>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedEmail.from_address}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(selectedEmail.received_at)}</p>
                  </div>
                </div>
                <div className="prose prose-invert max-w-none">
                  {selectedEmail.html_body ? (
                    <div 
                      className="text-foreground/80"
                      dangerouslySetInnerHTML={{ __html: selectedEmail.html_body }} 
                    />
                  ) : (
                    <p className="text-foreground/80 whitespace-pre-wrap">{selectedEmail.body || "(No content)"}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Inbox;
