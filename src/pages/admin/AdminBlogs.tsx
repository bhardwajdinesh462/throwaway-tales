import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Plus, Trash2, Edit, Eye, EyeOff, Image, Loader2, Tag, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminBlogs, useBlogMutations, adminQueryKeys } from "@/hooks/useAdminQueries";
import { AdminBlogCardSkeleton } from "@/components/admin/AdminSkeletons";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  tags: string[];
  category: string;
  author: string;
  reading_time: number;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const AdminBlogs = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    featured_image_url: "",
    meta_title: "",
    meta_description: "",
    category: "General",
    author: "",
    published: false,
  });

  // Use React Query for caching
  const { data: blogs = [], isLoading, refetch } = useAdminBlogs();
  const { deleteBlog, togglePublished } = useBlogMutations();

  const calculateReadingTime = (content: string): number => {
    const wordsPerMinute = 200;
    const wordCount = content.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  };

  const resetForm = () => {
    setFormData({
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      featured_image_url: "",
      meta_title: "",
      meta_description: "",
      category: "General",
      author: "",
      published: false,
    });
    setTagsInput("");
    setEditingBlog(null);
  };

  const openEditDialog = (blog: BlogPost) => {
    setEditingBlog(blog);
    setFormData({
      title: blog.title,
      slug: blog.slug,
      excerpt: blog.excerpt || "",
      content: blog.content,
      featured_image_url: blog.featured_image_url || "",
      meta_title: blog.meta_title || "",
      meta_description: blog.meta_description || "",
      category: blog.category,
      author: blog.author,
      published: blog.published,
    });
    setTagsInput(blog.tags?.join(", ") || "");
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `blog-images/${fileName}`;

      const { error: uploadError } = await api.storage.upload("banners", filePath, file);

      if (uploadError) throw uploadError;

      const publicUrl = api.storage.getPublicUrl("banners", filePath);

      setFormData({ ...formData, featured_image_url: publicUrl });
      toast.success("Image uploaded successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.content || !formData.author) {
      toast.error("Title, content, and author are required");
      return;
    }

    const slug = formData.slug || formData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const tags = tagsInput.split(",").map(t => t.trim()).filter(t => t);
    const readingTime = calculateReadingTime(formData.content);

    try {
      if (editingBlog) {
        const { error } = await api.db.update("blogs", {
          title: formData.title,
          slug,
          excerpt: formData.excerpt || null,
          content: formData.content,
          featured_image_url: formData.featured_image_url || null,
          meta_title: formData.meta_title || null,
          meta_description: formData.meta_description || null,
          tags,
          category: formData.category,
          author: formData.author,
          reading_time: readingTime,
          published: formData.published,
          published_at: formData.published ? new Date().toISOString() : null,
        }, { id: editingBlog.id });

        if (error) throw error;
        toast.success("Blog post updated");
      } else {
        const { error } = await api.db.insert("blogs", {
          title: formData.title,
          slug,
          excerpt: formData.excerpt || null,
          content: formData.content,
          featured_image_url: formData.featured_image_url || null,
          meta_title: formData.meta_title || null,
          meta_description: formData.meta_description || null,
          tags,
          category: formData.category,
          author: formData.author,
          reading_time: readingTime,
          published: formData.published,
          published_at: formData.published ? new Date().toISOString() : null,
        });

        if (error) throw error;
        toast.success("Blog post created");
      }

      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.blogs() });
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save blog post");
    }
  };

  const handleDeleteBlog = (id: string) => {
    deleteBlog.mutate(id);
  };

  const handleTogglePublished = (blog: BlogPost) => {
    togglePublished.mutate({ id: blog.id, published: blog.published });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Blog Management</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage blog posts with SEO and images
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="neon" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <AdminBlogCardSkeleton key={i} />)
        ) : blogs.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            No blog posts yet. Create your first post!
          </div>
        ) : (
          blogs.map((blog, index) => (
            <motion.div
              key={blog.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="glass-card p-4"
            >
              <div className="flex items-start gap-4">
                {blog.featured_image_url && (
                  <div className="w-20 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-secondary/50">
                    <img 
                      src={blog.featured_image_url} 
                      alt={blog.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{blog.title}</h3>
                    <Badge variant={blog.published ? "default" : "secondary"}>
                      {blog.published ? "Published" : "Draft"}
                    </Badge>
                    <Badge variant="outline">{blog.category}</Badge>
                    <Badge variant="outline" className="text-xs">{blog.reading_time} min read</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{blog.excerpt}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <p className="text-xs text-muted-foreground">
                      By {blog.author} • {new Date(blog.created_at).toLocaleDateString()}
                    </p>
                    {blog.tags && blog.tags.length > 0 && (
                      <div className="flex gap-1">
                        {blog.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleTogglePublished(blog)}
                  >
                    {blog.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(blog)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => handleDeleteBlog(blog.id)}
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
            <DialogTitle>{editingBlog ? "Edit Post" : "New Post"}</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Title *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="bg-secondary/50"
                    placeholder="Enter blog title"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Slug</label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="auto-generated-from-title"
                    className="bg-secondary/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Author *</label>
                  <Input
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    className="bg-secondary/50"
                    placeholder="Author name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General">General</SelectItem>
                      <SelectItem value="Privacy">Privacy</SelectItem>
                      <SelectItem value="Tips">Tips</SelectItem>
                      <SelectItem value="Technology">Technology</SelectItem>
                      <SelectItem value="Security">Security</SelectItem>
                      <SelectItem value="News">News</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Excerpt</label>
                <Textarea
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  className="bg-secondary/50"
                  rows={2}
                  placeholder="Brief summary of the post"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Content *</label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="bg-secondary/50 min-h-[200px]"
                  placeholder="Write your blog post content here..."
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Tag className="w-4 h-4" /> Tags
                </label>
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="privacy, security, tips (comma separated)"
                  className="bg-secondary/50"
                />
              </div>
            </TabsContent>

            <TabsContent value="media" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Image className="w-4 h-4" /> Featured Image
                </label>
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="bg-secondary/50"
                      disabled={uploadingImage}
                    />
                  </div>
                  {uploadingImage && <Loader2 className="w-5 h-5 animate-spin" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Or enter URL:</p>
                <Input
                  value={formData.featured_image_url}
                  onChange={(e) => setFormData({ ...formData, featured_image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                  className="bg-secondary/50 mt-2"
                />
              </div>
              {formData.featured_image_url && (
                <div className="rounded-lg overflow-hidden border border-border">
                  <img 
                    src={formData.featured_image_url} 
                    alt="Preview" 
                    className="max-h-48 w-auto mx-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="seo" className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Meta Title</label>
                <Input
                  value={formData.meta_title}
                  onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                  placeholder="SEO title (defaults to post title)"
                  className="bg-secondary/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Meta Description</label>
                <Textarea
                  value={formData.meta_description}
                  onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                  placeholder="SEO description (defaults to excerpt)"
                  className="bg-secondary/50"
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <div className="flex items-center gap-4 w-full justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="published"
                  checked={formData.published}
                  onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                  className="rounded border-border"
                />
                <label htmlFor="published" className="text-sm">Publish immediately</label>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="neon" onClick={handleSave}>
                  {editingBlog ? "Update" : "Create"} Post
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBlogs;
