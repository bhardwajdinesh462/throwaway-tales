import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { storage, generateId } from "@/lib/storage";
import { Mail, Plus, Trash2, Edit, Save } from "lucide-react";
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
} from "@/components/ui/dialog";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'welcome' | 'password_reset' | 'verification' | 'notification' | 'custom';
}

const EMAIL_TEMPLATES_KEY = 'trashmails_email_templates';

const defaultTemplates: EmailTemplate[] = [
  { id: '1', name: 'Welcome Email', subject: 'Welcome to TrashMails!', body: 'Hello {{name}},\n\nWelcome to TrashMails! Your account has been created successfully.\n\nBest regards,\nTrashMails Team', type: 'welcome' },
  { id: '2', name: 'Password Reset', subject: 'Reset Your Password', body: 'Hello {{name}},\n\nClick the link below to reset your password:\n{{reset_link}}\n\nThis link expires in 24 hours.', type: 'password_reset' },
  { id: '3', name: 'Email Verification', subject: 'Verify Your Email', body: 'Hello {{name}},\n\nPlease verify your email by clicking:\n{{verify_link}}', type: 'verification' },
];

const AdminEmailTemplates = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>(() =>
    storage.get(EMAIL_TEMPLATES_KEY, defaultTemplates)
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({ name: '', subject: '', body: '', type: 'custom' as EmailTemplate['type'] });

  const saveTemplates = (updated: EmailTemplate[]) => {
    storage.set(EMAIL_TEMPLATES_KEY, updated);
    setTemplates(updated);
  };

  const handleSave = () => {
    if (!formData.name || !formData.subject || !formData.body) {
      toast.error("Please fill all fields");
      return;
    }

    if (editingTemplate) {
      saveTemplates(templates.map(t => t.id === editingTemplate.id ? { ...editingTemplate, ...formData } : t));
      toast.success("Template updated!");
    } else {
      saveTemplates([...templates, { id: generateId(), ...formData }]);
      toast.success("Template created!");
    }
    
    setFormData({ name: '', subject: '', body: '', type: 'custom' });
    setEditingTemplate(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({ name: template.name, subject: template.subject, body: template.body, type: template.type });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    saveTemplates(templates.filter(t => t.id !== id));
    toast.success("Template deleted");
  };

  const getTypeBadge = (type: EmailTemplate['type']) => {
    const colors: Record<string, string> = {
      welcome: 'bg-green-500/20 text-green-500',
      password_reset: 'bg-yellow-500/20 text-yellow-500',
      verification: 'bg-blue-500/20 text-blue-500',
      notification: 'bg-purple-500/20 text-purple-500',
      custom: 'bg-gray-500/20 text-gray-500',
    };
    return <Badge className={colors[type]}>{type.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="w-8 h-8 text-primary" />
            Email Templates
          </h1>
          <p className="text-muted-foreground">Manage email templates</p>
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Body</Label>
                <Textarea value={formData.body} onChange={(e) => setFormData({ ...formData, body: e.target.value })} rows={8} className="font-mono text-sm" />
                <p className="text-xs text-muted-foreground">Variables: {"{{name}}"}, {"{{email}}"}, {"{{link}}"}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" /> Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>{templates.length} template(s)</CardDescription>
        </CardHeader>
        <CardContent>
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
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="text-muted-foreground">{template.subject}</TableCell>
                  <TableCell>{getTypeBadge(template.type)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(template)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)} className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminEmailTemplates;
