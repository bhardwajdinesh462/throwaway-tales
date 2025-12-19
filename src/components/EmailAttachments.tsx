import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Paperclip, Download, Eye, File, FileImage, FileText, 
  FileVideo, FileAudio, Archive, X, Loader2, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
}

interface EmailAttachmentsProps {
  attachments: Attachment[];
  emailId: string;
}

const getFileIcon = (fileType: string) => {
  if (fileType.startsWith("image/")) return FileImage;
  if (fileType.startsWith("video/")) return FileVideo;
  if (fileType.startsWith("audio/")) return FileAudio;
  if (fileType.includes("pdf") || fileType.includes("document")) return FileText;
  if (fileType.includes("zip") || fileType.includes("archive") || fileType.includes("rar")) return Archive;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const EmailAttachments = ({ attachments, emailId }: EmailAttachmentsProps) => {
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

  const handleDownload = async (attachment: Attachment) => {
    try {
      setLoadingId(attachment.id);
      const { data, error } = await supabase.storage
        .from("email-attachments")
        .download(attachment.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Show success animation
      setDownloadedIds(prev => new Set(prev).add(attachment.id));
      toast.success(`Downloaded ${attachment.file_name}`);
      
      // Reset success state after 2 seconds
      setTimeout(() => {
        setDownloadedIds(prev => {
          const next = new Set(prev);
          next.delete(attachment.id);
          return next;
        });
      }, 2000);
    } catch (error) {
      toast.error("Failed to download file");
    } finally {
      setLoadingId(null);
    }
  };

  const handlePreview = async (attachment: Attachment) => {
    try {
      setLoadingId(attachment.id);
      const { data, error } = await supabase.storage
        .from("email-attachments")
        .download(attachment.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
      setPreviewAttachment(attachment);
    } catch (error) {
      toast.error("Failed to load preview");
    } finally {
      setLoadingId(null);
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewAttachment(null);
  };

  const canPreview = (fileType: string) => {
    return (
      fileType.startsWith("image/") ||
      fileType === "application/pdf" ||
      fileType.startsWith("text/")
    );
  };

  if (!attachments || attachments.length === 0) return null;

  return (
    <>
      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Paperclip className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Attachments ({attachments.length})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <AnimatePresence mode="popLayout">
            {attachments.map((attachment, index) => {
              const FileIcon = getFileIcon(attachment.file_type);
              const isLoading = loadingId === attachment.id;
              const isDownloaded = downloadedIds.has(attachment.id);
              
              return (
                <motion.div
                  key={attachment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors border border-border/50"
                >
                  <motion.div 
                    className="p-2 rounded-lg bg-primary/10"
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.3 }}
                  >
                    <FileIcon className="w-5 h-5 text-primary" />
                  </motion.div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {attachment.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.file_size)}
                    </p>
                  </div>
                  
                  {/* Always visible buttons with animations */}
                  <div className="flex items-center gap-1">
                    {canPreview(attachment.file_type) && (
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => handlePreview(attachment)}
                          disabled={isLoading}
                        >
                          {isLoading && loadingId === attachment.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </motion.div>
                    )}
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 transition-colors ${
                          isDownloaded 
                            ? 'text-green-500 bg-green-500/10' 
                            : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                        }`}
                        onClick={() => handleDownload(attachment)}
                        disabled={isLoading}
                      >
                        <AnimatePresence mode="wait">
                          {isLoading ? (
                            <motion.div
                              key="loading"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                            >
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </motion.div>
                          ) : isDownloaded ? (
                            <motion.div
                              key="check"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                            >
                              <Check className="w-4 h-4" />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="download"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                            >
                              <Download className="w-4 h-4" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewAttachment} onOpenChange={() => closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              {previewAttachment?.file_name}
            </DialogTitle>
          </DialogHeader>
          <motion.div 
            className="mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {previewUrl && previewAttachment && (
              <>
                {previewAttachment.file_type.startsWith("image/") && (
                  <motion.img
                    src={previewUrl}
                    alt={previewAttachment.file_name}
                    className="max-w-full h-auto rounded-lg"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
                {previewAttachment.file_type === "application/pdf" && (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[70vh] rounded-lg border border-border"
                    title={previewAttachment.file_name}
                  />
                )}
                {previewAttachment.file_type.startsWith("text/") && (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[70vh] rounded-lg border border-border bg-background"
                    title={previewAttachment.file_name}
                  />
                )}
              </>
            )}
          </motion.div>
          <div className="flex justify-end mt-4">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button onClick={() => previewAttachment && handleDownload(previewAttachment)}>
                <Download className="w-4 h-4 mr-2" />
                Download to Device
              </Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailAttachments;