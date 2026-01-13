import { useState } from "react";
import { motion } from "framer-motion";
import { User, Clock, Mail, FileText, Code, X, ExternalLink, Reply, Forward, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow, format } from "date-fns";
import DOMPurify from "dompurify";
import EmailAttachments, { Attachment } from "@/components/EmailAttachments";
import EmailSummary from "@/components/EmailSummary";
import { useAdminRole } from "@/hooks/useAdminRole";
interface EmailPreviewProps {
  email: {
    id: string;
    from_address: string;
    subject: string | null;
    body: string | null;
    html_body: string | null;
    received_at: string;
    is_read: boolean;
  };
  attachments: Attachment[];
  loadingAttachments: boolean;
  loadingContent?: boolean;
  onClose: () => void;
}

// Parse email address to extract name and email
const parseEmailAddress = (address: string) => {
  const match = address.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].replace(/^"|"$/g, '').trim(),
      email: match[2].trim(),
    };
  }
  return {
    name: null,
    email: address.trim(),
  };
};

// Get initials from name or email
const getInitials = (name: string | null, email: string) => {
  if (name) {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
};

// Generate a consistent color based on email
const getAvatarColor = (email: string) => {
  const colors = [
    'from-blue-500 to-purple-600',
    'from-green-500 to-teal-600',
    'from-orange-500 to-red-600',
    'from-pink-500 to-rose-600',
    'from-indigo-500 to-blue-600',
    'from-cyan-500 to-blue-600',
    'from-violet-500 to-purple-600',
    'from-amber-500 to-orange-600',
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const EmailPreview = ({ email, attachments, loadingAttachments, loadingContent = false, onClose }: EmailPreviewProps) => {
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');
  const { isAdmin } = useAdminRole();
  
  const { name: senderName, email: senderEmail } = parseEmailAddress(email.from_address);
  const initials = getInitials(senderName, senderEmail);
  const avatarColor = getAvatarColor(senderEmail);
  // Sanitize HTML for safe rendering with more allowed tags for proper email display
  const sanitizedHtml = email.html_body 
    ? DOMPurify.sanitize(email.html_body, {
        ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'span', 'div', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'img', 'center', 'font', 'hr', 'sub', 'sup', 'small', 'big', 'address', 'article', 'section', 'header', 'footer', 'nav', 'aside', 'figure', 'figcaption', 'caption', 'colgroup', 'col', 'details', 'summary', 'mark', 'time', 'abbr', 'cite', 'dfn', 'kbd', 'samp', 'var', 'ins', 'del', 'q', 'dl', 'dt', 'dd', 'ruby', 'rt', 'rp', 'bdi', 'bdo', 'wbr'],
        ALLOWED_ATTR: ['href', 'target', 'style', 'class', 'src', 'alt', 'width', 'height', 'align', 'valign', 'bgcolor', 'color', 'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan', 'title', 'rel', 'id', 'name', 'size', 'face', 'dir', 'lang', 'datetime', 'cite', 'start', 'reversed', 'type', 'value'],
        ALLOW_DATA_ATTR: false,
        ADD_ATTR: ['target'],
        FORCE_BODY: true,
      })
    : null;

  const hasHtml = !!sanitizedHtml && sanitizedHtml.trim().length > 0;
  const hasText = !!email.body && email.body.trim().length > 0;

  // Format the body text nicely - clean up any remaining MIME artifacts
  const formattedBody = email.body
    ?.replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/--b\d+=_[^\n]+\n?/g, '') // Remove boundary markers
    .replace(/Content-Type:\s*[^\n]+\n?/gi, '') // Remove Content-Type headers
    .replace(/Content-Transfer-Encoding:\s*[^\n]+\n?/gi, '') // Remove encoding headers
    .replace(/boundary="?[^"\n]+"?\n?/gi, '') // Remove boundary declarations
    .trim();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="border-t border-border bg-background/95 backdrop-blur-sm"
    >
      {/* Email Header */}
      <div className="p-3 md:p-4 border-b border-border/50">
        <div className="flex items-start justify-between gap-3">
          {/* Sender Info */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className={`shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-semibold text-base shadow-md`}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-foreground truncate">
                  {email.subject || "(No Subject)"}
                </h3>
                {!email.is_read && (
                  <Badge variant="default" className="shrink-0 bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                    New
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-sm">
                <span className="font-medium text-foreground">
                  {senderName || senderEmail}
                </span>
                {senderName && (
                  <span className="text-muted-foreground text-xs">
                    &lt;{senderEmail}&gt;
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{format(new Date(email.received_at), 'PPp')}</span>
                </div>
                <span className="text-muted-foreground/50">•</span>
                <span>{formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <EmailSummary 
              emailId={email.id}
              subject={email.subject}
              body={email.body}
              htmlBody={email.html_body}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Reply">
              <Reply className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Forward">
              <Forward className="w-4 h-4" />
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete (Admin)">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} title="Close">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      {hasHtml && hasText && (
        <div className="px-3 md:px-4 py-1.5 border-b border-border/30 bg-secondary/20">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'html' | 'text')} className="w-fit">
            <TabsList className="h-7 bg-secondary/50">
              <TabsTrigger value="html" className="text-xs h-5 px-2.5 gap-1">
                <Code className="w-3 h-3" />
                HTML
              </TabsTrigger>
              <TabsTrigger value="text" className="text-xs h-5 px-2.5 gap-1">
                <FileText className="w-3 h-3" />
                Text
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Email Body */}
      <div className="p-3 md:p-4 max-h-[50vh] overflow-y-auto">
        {loadingContent ? (
          <div className="space-y-4">
            <div className="h-4 bg-secondary/50 rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-secondary/50 rounded w-full animate-pulse" />
            <div className="h-4 bg-secondary/50 rounded w-5/6 animate-pulse" />
            <div className="h-4 bg-secondary/50 rounded w-2/3 animate-pulse" />
            <div className="h-4 bg-secondary/50 rounded w-4/5 animate-pulse" />
            <div className="h-4 bg-secondary/50 rounded w-1/2 animate-pulse" />
            <p className="text-center text-sm text-muted-foreground mt-4">Loading email content...</p>
          </div>
        ) : !hasHtml && !hasText ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Mail className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">No content available</p>
            <p className="text-xs text-muted-foreground/60 mt-1">This email may have no body text</p>
          </div>
        ) : viewMode === 'html' && hasHtml ? (
          <div 
            className="email-html-content prose prose-sm dark:prose-invert max-w-none
              prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary
              prose-strong:text-foreground prose-blockquote:border-primary/30 prose-blockquote:text-muted-foreground
              prose-code:bg-secondary prose-code:text-foreground prose-code:rounded prose-code:px-1
              prose-pre:bg-secondary prose-pre:border prose-pre:border-border
              prose-img:rounded-lg prose-img:max-w-full prose-img:h-auto
              [&_table]:border-collapse [&_table]:border [&_table]:border-border
              [&_td]:border [&_td]:border-border [&_td]:p-2
              [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-secondary"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml! }} 
          />
        ) : hasText ? (
          <div className="font-mono text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed bg-secondary/30 rounded-lg p-3 border border-border/50">
            {formattedBody}
          </div>
        ) : null}
      </div>

      {/* Attachments */}
      <div className="px-3 md:px-4 pb-3">
        {loadingAttachments ? (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading attachments...</span>
          </div>
        ) : attachments.length > 0 ? (
          <div className="border-t border-border/50 pt-3">
            <EmailAttachments attachments={attachments} emailId={email.id} />
          </div>
        ) : null}
      </div>
    </motion.div>
  );
};

export default EmailPreview;
