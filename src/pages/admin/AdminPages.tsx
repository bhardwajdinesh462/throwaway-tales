import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Plus, Trash2, Edit, Eye, EyeOff, Search, Settings, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { storage, STORAGE_KEYS, generateId } from "@/lib/storage";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  published: boolean;
  pageType: 'standard' | 'pricing' | 'contact' | 'about' | 'faq' | 'legal';
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  showInNav?: boolean;
  showInFooter?: boolean;
}

const PAGE_TYPES = [
  { value: 'standard', label: 'Standard Page' },
  { value: 'pricing', label: 'Pricing Page' },
  { value: 'contact', label: 'Contact Page' },
  { value: 'about', label: 'About Page' },
  { value: 'faq', label: 'FAQ Page' },
  { value: 'legal', label: 'Legal Page' },
];

const AdminPages = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [activeTab, setActiveTab] = useState("content");
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    content: "",
    published: true,
    pageType: "standard" as Page['pageType'],
    metaTitle: "",
    metaDescription: "",
    ogImage: "",
    showInNav: false,
    showInFooter: false,
  });

  useEffect(() => {
    const loadedPages = storage.get<Page[]>(STORAGE_KEYS.PAGES, []);
    // Migrate old pages to include new fields
    const migratedPages = loadedPages.map(page => ({
      ...page,
      pageType: page.pageType || 'standard',
      metaTitle: page.metaTitle || '',
      metaDescription: page.metaDescription || '',
      ogImage: page.ogImage || '',
      showInNav: page.showInNav ?? false,
      showInFooter: page.showInFooter ?? false,
    }));
    setPages(migratedPages);
    setIsLoading(false);
  }, []);

  const resetForm = () => {
    setFormData({
      title: "",
      slug: "",
      content: "",
      published: true,
      pageType: "standard",
      metaTitle: "",
      metaDescription: "",
      ogImage: "",
      showInNav: false,
      showInFooter: false,
    });
    setEditingPage(null);
    setActiveTab("content");
  };

  const openEditDialog = (page: Page) => {
    setEditingPage(page);
    setFormData({
      title: page.title,
      slug: page.slug,
      content: page.content,
      published: page.published,
      pageType: page.pageType || 'standard',
      metaTitle: page.metaTitle || '',
      metaDescription: page.metaDescription || '',
      ogImage: page.ogImage || '',
      showInNav: page.showInNav ?? false,
      showInFooter: page.showInFooter ?? false,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.title || !formData.content) {
      toast.error("Title and content are required");
      return;
    }

    const slug = formData.slug || formData.title.toLowerCase().replace(/\s+/g, "-");
    
    if (editingPage) {
      const updated = pages.map(p => 
        p.id === editingPage.id ? { ...p, ...formData, slug } : p
      );
      setPages(updated);
      storage.set(STORAGE_KEYS.PAGES, updated);
      toast.success("Page updated");
    } else {
      const newPage: Page = {
        id: generateId(),
        ...formData,
        slug,
      };
      const updated = [newPage, ...pages];
      setPages(updated);
      storage.set(STORAGE_KEYS.PAGES, updated);
      toast.success("Page created");
    }

    setDialogOpen(false);
    resetForm();
  };

  const deletePage = (id: string) => {
    const updated = pages.filter(p => p.id !== id);
    setPages(updated);
    storage.set(STORAGE_KEYS.PAGES, updated);
    toast.success("Page deleted");
  };

  const togglePublished = (id: string) => {
    const updated = pages.map(p => 
      p.id === id ? { ...p, published: !p.published } : p
    );
    setPages(updated);
    storage.set(STORAGE_KEYS.PAGES, updated);
  };

  const getPageTypeLabel = (type: string) => {
    return PAGE_TYPES.find(t => t.value === type)?.label || 'Standard';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Page Management</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage static pages with SEO settings
          </p>
        </div>
        <Button variant="neon" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Page
        </Button>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="glass-card p-8 text-center text-muted-foreground">Loading...</div>
        ) : pages.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground">
            No pages yet
          </div>
        ) : (
          pages.map((page, index) => (
            <motion.div
              key={page.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{page.title}</h3>
                      <Badge variant={page.published ? "default" : "secondary"}>
                        {page.published ? "Published" : "Draft"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {getPageTypeLabel(page.pageType)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>/{page.slug}</span>
                      {page.showInNav && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Nav
                        </span>
                      )}
                      {page.showInFooter && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Footer
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => togglePublished(page.id)}
                  >
                    {page.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(page)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => deletePage(page.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPage ? "Edit Page" : "New Page"}</DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Content
              </TabsTrigger>
              <TabsTrigger value="seo" className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                SEO
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="content" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="bg-secondary/50"
                    placeholder="Page title"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Slug</Label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="auto-generated"
                    className="bg-secondary/50"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Content</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="bg-secondary/50 min-h-[250px]"
                  placeholder="Page content (supports HTML)"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="seo" className="space-y-4 mt-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Meta Title</Label>
                <Input
                  value={formData.metaTitle}
                  onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                  className="bg-secondary/50"
                  placeholder="SEO title (defaults to page title)"
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.metaTitle.length}/60 characters
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Meta Description</Label>
                <Textarea
                  value={formData.metaDescription}
                  onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                  className="bg-secondary/50 min-h-[100px]"
                  placeholder="Brief description for search engines"
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.metaDescription.length}/160 characters
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">OG Image URL</Label>
                <Input
                  value={formData.ogImage}
                  onChange={(e) => setFormData({ ...formData, ogImage: e.target.value })}
                  className="bg-secondary/50"
                  placeholder="https://example.com/image.jpg"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Image shown when page is shared on social media
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="settings" className="space-y-4 mt-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Page Type</Label>
                <Select 
                  value={formData.pageType} 
                  onValueChange={(value: Page['pageType']) => setFormData({ ...formData, pageType: value })}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Published</Label>
                    <p className="text-xs text-muted-foreground">Make this page visible to visitors</p>
                  </div>
                  <Switch
                    checked={formData.published}
                    onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Show in Navigation</Label>
                    <p className="text-xs text-muted-foreground">Add link to main navigation</p>
                  </div>
                  <Switch
                    checked={formData.showInNav}
                    onCheckedChange={(checked) => setFormData({ ...formData, showInNav: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Show in Footer</Label>
                    <p className="text-xs text-muted-foreground">Add link to footer</p>
                  </div>
                  <Switch
                    checked={formData.showInFooter}
                    onCheckedChange={(checked) => setFormData({ ...formData, showInFooter: checked })}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="neon" onClick={handleSave}>
              {editingPage ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPages;