import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { Mail, Plus, Trash2, Edit, Save, Loader2, Info, Send, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'welcome' | 'password_reset' | 'verification' | 'notification' | 'custom';
  created_at?: string;
  updated_at?: string;
}

const AdminEmailTemplates = () => {
  const { settings: generalSettings } = useGeneralSettings();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    subject: '', 
    body: '', 
    type: 'custom' as EmailTemplate['type'] 
  });

  // Test email state
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testTemplate, setTestTemplate] = useState<EmailTemplate | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Preview dialog state
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplateData] = useState<EmailTemplate | null>(null);

  // Load templates from database
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase
        .from('email_templates' as any)
        .select('*')
        .order('created_at', { ascending: true }) as any);

      if (error) throw error;
      
      setTemplates((data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        body: t.body,
        type: t.type as EmailTemplate['type'],
        created_at: t.created_at,
        updated_at: t.updated_at,
      })));
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load email templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.subject || !formData.body) {
      toast.error("Please fill all fields");
      return;
    }

    setIsSaving(true);
    try {
      if (editingTemplate) {
        const { error } = await (supabase
          .from('email_templates' as any)
          .update({
            name: formData.name,
            subject: formData.subject,
            body: formData.body,
            type: formData.type,
          })
          .eq('id', editingTemplate.id) as any);

        if (error) throw error;
        toast.success("Template updated!");
      } else {
        const { error } = await (supabase
          .from('email_templates' as any)
          .insert({
            name: formData.name,
            subject: formData.subject,
            body: formData.body,
            type: formData.type,
          }) as any);

        if (error) throw error;
        toast.success("Template created!");
      }

      await loadTemplates();
      
      setFormData({ name: '', subject: '', body: '', type: 'custom' });
      setEditingTemplate(null);
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({ 
      name: template.name, 
      subject: template.subject, 
      body: template.body, 
      type: template.type 
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase
        .from('email_templates' as any)
        .delete()
        .eq('id', id) as any);

      if (error) throw error;
      
      toast.success("Template deleted");
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleSendTest = async () => {
    if (!testEmail || !testTemplate) {
      toast.error("Please enter a recipient email");
      return;
    }

    setIsSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-template-email', {
        body: {
          templateId: testTemplate.id,
          recipientEmail: testEmail,
          recipientName: testName || undefined,
        },
      });

      if (error) throw error;
      
      if (data?.success) {
        toast.success(`Test email sent to ${testEmail}!`);
        setIsTestDialogOpen(false);
        setTestEmail('');
        setTestName('');
        setTestTemplate(null);
      } else {
        throw new Error(data?.error || 'Failed to send test email');
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast.error(error.message || 'Failed to send test email');
    } finally {
      setIsSendingTest(false);
    }
  };

  const openTestDialog = (template: EmailTemplate) => {
    setTestTemplate(template);
    setIsTestDialogOpen(true);
  };

  const openPreviewDialog = (template: EmailTemplate) => {
    setPreviewTemplateData(template);
    setIsPreviewDialogOpen(true);
  };

  const getTypeBadge = (type: EmailTemplate['type']) => {
    const colors: Record<string, string> = {
      welcome: 'bg-green-500/20 text-green-500',
      password_reset: 'bg-yellow-500/20 text-yellow-500',
      verification: 'bg-blue-500/20 text-blue-500',
      notification: 'bg-purple-500/20 text-purple-500',
      custom: 'bg-muted text-muted-foreground',
    };
    return <Badge className={colors[type]}>{type.replace('_', ' ')}</Badge>;
  };

  // Preview template with variables replaced
  const previewTemplateText = (text: string) => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    
    return text
      .replace(/\{\{site_name\}\}/g, generalSettings.siteName)
      .replace(/\{\{name\}\}/g, testName || 'User Name')
      .replace(/\{\{email\}\}/g, testEmail || 'user@example.com')
      .replace(/\{\{link\}\}/g, 'https://example.com/action')
      .replace(/\{\{reset_link\}\}/g, 'https://example.com/reset')
      .replace(/\{\{verify_link\}\}/g, 'https://example.com/verify')
      .replace(/\{\{date\}\}/g, formattedDate)
      .replace(/\{\{ip_address\}\}/g, '192.168.1.1')
      .replace(/\{\{browser\}\}/g, 'Chrome');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="w-8 h-8 text-primary" />
            Email Templates
          </h1>
          <p className="text-muted-foreground">Manage email templates for {generalSettings.siteName}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingTemplate(null);
            setFormData({ name: '', subject: '', body: '', type: 'custom' });
          }
        }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  Available variables: <code className="bg-muted px-1 rounded">{"{{site_name}}"}</code>, 
                  <code className="bg-muted px-1 rounded ml-1">{"{{name}}"}</code>, 
                  <code className="bg-muted px-1 rounded ml-1">{"{{email}}"}</code>, 
                  <code className="bg-muted px-1 rounded ml-1">{"{{link}}"}</code>,
                  <code className="bg-muted px-1 rounded ml-1">{"{{reset_link}}"}</code>,
                  <code className="bg-muted px-1 rounded ml-1">{"{{verify_link}}"}</code>,
                  <code className="bg-muted px-1 rounded ml-1">{"{{date}}"}</code>,
                  <code className="bg-muted px-1 rounded ml-1">{"{{ip_address}}"}</code>,
                  <code className="bg-muted px-1 rounded ml-1">{"{{browser}}"}</code>
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                    placeholder="Welcome Email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value) => setFormData({ ...formData, type: value as EmailTemplate['type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="welcome">Welcome</SelectItem>
                      <SelectItem value="password_reset">Password Reset</SelectItem>
                      <SelectItem value="verification">Verification</SelectItem>
                      <SelectItem value="notification">Notification</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input 
                  value={formData.subject} 
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })} 
                  placeholder={`Welcome to {{site_name}}!`}
                />
                {formData.subject && (
                  <p className="text-xs text-muted-foreground">
                    Preview: {previewTemplateText(formData.subject)}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea 
                  value={formData.body} 
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })} 
                  rows={10} 
                  className="font-mono text-sm"
                  placeholder={`Hello {{name}},\n\nWelcome to {{site_name}}!\n\nBest regards,\n{{site_name}} Team`}
                />
              </div>
              
              {formData.body && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Preview</Label>
                  <div className="p-4 bg-muted/30 rounded-lg border border-border">
                    <pre className="whitespace-pre-wrap text-sm font-sans">
                      {previewTemplateText(formData.body)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            {templates.length} template(s) • These templates use your site name: <strong>{generalSettings.siteName}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No templates found. Create your first template to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {templates.map((template) => (
                    <motion.tr
                      key={template.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="border-b transition-colors hover:bg-muted/50"
                    >
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[250px] truncate">
                        {previewTemplateText(template.subject)}
                      </TableCell>
                      <TableCell>{getTypeBadge(template.type)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => openPreviewDialog(template)}
                              title="Preview template"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </motion.div>
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => openTestDialog(template)}
                              className="text-primary"
                              title="Send test email"
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          </motion.div>
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleEdit(template)}
                              title="Edit template"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </motion.div>
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDelete(template.id)} 
                              className="text-destructive"
                              title="Delete template"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </motion.div>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Test Email Dialog */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Send Test Email
            </DialogTitle>
            <DialogDescription>
              Send a test email using the "{testTemplate?.name}" template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Recipient Email *</Label>
              <Input 
                type="email"
                value={testEmail} 
                onChange={(e) => setTestEmail(e.target.value)} 
                placeholder="test@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Recipient Name (optional)</Label>
              <Input 
                value={testName} 
                onChange={(e) => setTestName(e.target.value)} 
                placeholder="John Doe"
              />
              <p className="text-xs text-muted-foreground">
                Used for the {"{{name}}"} variable
              </p>
            </div>
            
            {testTemplate && (
              <div className="p-3 bg-muted/30 rounded-lg border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Subject Preview:</p>
                <p className="text-sm">{previewTemplateText(testTemplate.subject)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendTest} disabled={isSendingTest || !testEmail}>
              {isSendingTest ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Preview: {previewTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Subject</Label>
                <div className="p-3 bg-muted/30 rounded-lg border border-border font-medium">
                  {previewTemplateText(previewTemplate.subject)}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Body</Label>
                <div className="p-4 bg-card rounded-lg border border-border shadow-inner">
                  <div 
                    className="prose prose-sm dark:prose-invert max-w-none"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                  >
                    {previewTemplateText(previewTemplate.body).split('\n').map((line, i) => (
                      <p key={i} className="my-2">{line || <br />}</p>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{previewTemplate.type.replace('_', ' ')}</Badge>
                {previewTemplate.created_at && (
                  <span className="text-xs text-muted-foreground">
                    Created: {new Date(previewTemplate.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              Close
            </Button>
            {previewTemplate && (
              <Button onClick={() => {
                setIsPreviewDialogOpen(false);
                openTestDialog(previewTemplate);
              }}>
                <Send className="w-4 h-4 mr-2" />
                Send Test
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            About Auth Email Templates
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Templates with type <Badge className="bg-blue-500/20 text-blue-500 mx-1">verification</Badge> 
            will be used for email verification when users sign up.
          </p>
          <p>
            Templates with type <Badge className="bg-yellow-500/20 text-yellow-500 mx-1">password reset</Badge> 
            will be used when users request a password reset.
          </p>
          <p>
            Templates with type <Badge className="bg-green-500/20 text-green-500 mx-1">welcome</Badge> 
            will be sent to users after successful signup.
          </p>
          <p className="text-xs mt-4 pt-2 border-t border-border">
            Note: The auth-email-hook edge function uses these templates. Make sure you have at least one template for each type.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminEmailTemplates;
