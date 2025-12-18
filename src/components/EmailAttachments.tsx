import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Paperclip, Download, Eye, File, FileImage, FileText, 
  FileVideo, FileAudio, Archive, X, Loader2
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
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async (attachment: Attachment) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.storage
        .from("email-attachments")
        .download(attachment.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (error) {
      toast.error("Failed to download file");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async (attachment: Attachment) => {
    try {
      setIsLoading(true);
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
      setIsLoading(false);
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
          {attachments.map((attachment) => {
            const FileIcon = getFileIcon(attachment.file_type);
            return (
              <motion.div
                key={attachment.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg group hover:bg-secondary/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {attachment.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.file_size)}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canPreview(attachment.file_type) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePreview(attachment)}
                      disabled={isLoading}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(attachment)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </motion.div>
            );
          })}
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
          <div className="mt-4">
            {previewUrl && previewAttachment && (
              <>
                {previewAttachment.file_type.startsWith("image/") && (
                  <img
                    src={previewUrl}
                    alt={previewAttachment.file_name}
                    className="max-w-full h-auto rounded-lg"
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
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={() => previewAttachment && handleDownload(previewAttachment)}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailAttachments;
