import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Plus, Trash2, Edit, Eye, EyeOff, Upload, Image, Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  useEffect(() => {
    fetchBlogs();
  }, []);

  const fetchBlogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("blogs")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setBlogs(data || []);
    } catch (error: any) {
      console.error("Error fetching blogs:", error);
      toast.error("Failed to load blogs");
    } finally {
      setIsLoading(false);
    }
  };

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

      const { error: uploadError } = await supabase.storage
        .from("banners")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("banners")
        .getPublicUrl(filePath);

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
        const { error } = await supabase
          .from("blogs")
          .update({
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
          })
          .eq("id", editingBlog.id);

        if (error) throw error;
        toast.success("Blog post updated");
      } else {
        const { error } = await supabase
          .from("blogs")
          .insert({
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
      fetchBlogs();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save blog post");
    }
  };

  const deleteBlog = async (id: string) => {
    try {
      const { error } = await supabase.from("blogs").delete().eq("id", id);
      if (error) throw error;
      setBlogs(blogs.filter(b => b.id !== id));
      toast.success("Blog post deleted");
    } catch (error) {
      toast.error("Failed to delete blog post");
    }
  };

  const togglePublished = async (blog: BlogPost) => {
    try {
      const newPublished = !blog.published;
      const { error } = await supabase
        .from("blogs")
        .update({ 
          published: newPublished,
          published_at: newPublished ? new Date().toISOString() : null
        })
        .eq("id", blog.id);
      
      if (error) throw error;
      setBlogs(blogs.map(b => 
        b.id === blog.id ? { ...b, published: newPublished } : b
      ));
      toast.success(newPublished ? "Blog published" : "Blog unpublished");
    } catch (error) {
      toast.error("Failed to update blog status");
    }
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
        <Button variant="neon" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Post
        </Button>
      </div>

      <div className="grid gap-4">
        {blogs.length === 0 ? (
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
              transition={{ delay: index * 0.05 }}
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
                    onClick={() => togglePublished(blog)}
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
                    onClick={() => deleteBlog(blog.id)}
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
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.meta_title?.length || 0}/60 characters
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Meta Description</label>
                <Textarea
                  value={formData.meta_description}
                  onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                  placeholder="SEO description for search engines"
                  className="bg-secondary/50"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.meta_description?.length || 0}/160 characters
                </p>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium text-foreground">Publish Status</p>
                  <p className="text-sm text-muted-foreground">
                    {formData.published ? "Post is visible to public" : "Post is saved as draft"}
                  </p>
                </div>
                <Button
                  variant={formData.published ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, published: !formData.published })}
                >
                  {formData.published ? "Published" : "Draft"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="neon" onClick={handleSave}>
              {editingBlog ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBlogs;
