import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Edit, Save, X, Image, Code, Type, FileCode,
  Eye, EyeOff, Calendar, Link as LinkIcon, Upload, Loader2,
  BarChart3, MousePointer, Layout
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Banner {
  id: string;
  name: string;
  position: "header" | "sidebar" | "content" | "footer";
  type: "image" | "html" | "script" | "text";
  content: string;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  priority: number;
  click_count: number;
  view_count: number;
  created_at: string;
}

const positionLabels = {
  header: "Header (Top of page)",
  sidebar: "Sidebar (Right side)",
  content: "Content (Between sections)",
  footer: "Footer (Bottom of page)",
};

const typeIcons = {
  image: Image,
  html: Code,
  script: FileCode,
  text: Type,
};

const AdminBanners = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<string>("all");
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    position: "header" as Banner["position"],
    type: "image" as Banner["type"],
    content: "",
    image_url: "",
    link_url: "",
    is_active: true,
    start_date: "",
    end_date: "",
    priority: 0,
  });

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = () => {
    const stored = localStorage.getItem("nullsto_banners");
    if (stored) {
      setBanners(JSON.parse(stored));
    }
    setIsLoading(false);
  };

  const saveBanners = (updatedBanners: Banner[]) => {
    localStorage.setItem("nullsto_banners", JSON.stringify(updatedBanners));
    setBanners(updatedBanners);
    window.dispatchEvent(new Event("bannersUpdated"));
  };

  const handleCreateBanner = () => {
    setEditingBanner(null);
    setFormData({
      name: "",
      position: "header",
      type: "image",
      content: "",
      image_url: "",
      link_url: "",
      is_active: true,
      start_date: "",
      end_date: "",
      priority: 0,
    });
    setIsDialogOpen(true);
  };

  const handleEditBanner = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      name: banner.name,
      position: banner.position,
      type: banner.type,
      content: banner.content,
      image_url: banner.image_url || "",
      link_url: banner.link_url || "",
      is_active: banner.is_active,
      start_date: banner.start_date || "",
      end_date: banner.end_date || "",
      priority: banner.priority,
    });
    setIsDialogOpen(true);
  };

  const handleSaveBanner = () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a banner name");
      return;
    }

    if (formData.type === "image" && !formData.image_url) {
      toast.error("Please provide an image URL");
      return;
    }

    if (formData.type !== "image" && !formData.content.trim()) {
      toast.error("Please enter banner content");
      return;
    }

    if (editingBanner) {
      const updated = banners.map((b) =>
        b.id === editingBanner.id
          ? {
              ...b,
              ...formData,
              image_url: formData.image_url || null,
              link_url: formData.link_url || null,
              start_date: formData.start_date || null,
              end_date: formData.end_date || null,
            }
          : b
      );
      saveBanners(updated);
      toast.success("Banner updated successfully");
    } else {
      const newBanner: Banner = {
        id: `banner_${Date.now()}`,
        ...formData,
        image_url: formData.image_url || null,
        link_url: formData.link_url || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        click_count: 0,
        view_count: 0,
        created_at: new Date().toISOString(),
      };
      saveBanners([...banners, newBanner]);
      toast.success("Banner created successfully");
    }

    setIsDialogOpen(false);
  };

  const handleDeleteBanner = (id: string) => {
    const updated = banners.filter((b) => b.id !== id);
    saveBanners(updated);
    toast.success("Banner deleted");
  };

  const handleToggleActive = (id: string) => {
    const updated = banners.map((b) =>
      b.id === id ? { ...b, is_active: !b.is_active } : b
    );
    saveBanners(updated);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploadingImage(true);

    // Convert to base64 for localStorage storage (shared hosting compatibility)
    const reader = new FileReader();
    reader.onload = () => {
      setFormData({ ...formData, image_url: reader.result as string });
      setUploadingImage(false);
      toast.success("Image uploaded");
    };
    reader.onerror = () => {
      toast.error("Failed to upload image");
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const filteredBanners = selectedPosition === "all"
    ? banners
    : banners.filter((b) => b.position === selectedPosition);

  const getPositionStats = (position: string) => {
    const positionBanners = banners.filter((b) => b.position === position);
    return {
      total: positionBanners.length,
      active: positionBanners.filter((b) => b.is_active).length,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Banner Management</h2>
          <p className="text-muted-foreground">Manage ads and banners across your site</p>
        </div>
        <Button variant="neon" onClick={handleCreateBanner}>
          <Plus className="w-4 h-4 mr-2" />
          Add Banner
        </Button>
      </div>

      {/* Position Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["header", "sidebar", "content", "footer"] as const).map((pos) => {
          const stats = getPositionStats(pos);
          return (
            <div
              key={pos}
              className={`glass-card p-4 cursor-pointer transition-colors ${
                selectedPosition === pos ? "border-primary/50" : ""
              }`}
              onClick={() => setSelectedPosition(selectedPosition === pos ? "all" : pos)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Layout className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground capitalize">{pos}</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.active}/{stats.total} active
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Banner List */}
      {isLoading ? (
        <div className="text-center p-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        </div>
      ) : filteredBanners.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Image className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Banners Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first banner to display ads on your site
          </p>
          <Button variant="neon" onClick={handleCreateBanner}>
            <Plus className="w-4 h-4 mr-2" />
            Create Banner
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBanners.map((banner, index) => {
            const TypeIcon = typeIcons[banner.type];
            return (
              <motion.div
                key={banner.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-4"
              >
                <div className="flex items-start gap-4">
                  {/* Preview */}
                  <div className="w-24 h-16 rounded-lg bg-secondary/50 overflow-hidden flex-shrink-0">
                    {banner.type === "image" && banner.image_url ? (
                      <img
                        src={banner.image_url}
                        alt={banner.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <TypeIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-foreground truncate">{banner.name}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        banner.is_active
                          ? "bg-green-500/20 text-green-500"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {banner.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="capitalize">{banner.position}</span>
                      <span className="capitalize">{banner.type}</span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {banner.view_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointer className="w-3 h-3" />
                        {banner.click_count}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={banner.is_active}
                      onCheckedChange={() => handleToggleActive(banner.id)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleEditBanner(banner)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteBanner(banner.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBanner ? "Edit Banner" : "Create New Banner"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Banner Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Banner"
                  className="bg-secondary/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Position</label>
                <Select
                  value={formData.position}
                  onValueChange={(v) => setFormData({ ...formData, position: v as Banner["position"] })}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(positionLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Type Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Banner Type</label>
              <Tabs
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as Banner["type"] })}
              >
                <TabsList className="grid grid-cols-4">
                  <TabsTrigger value="image" className="flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    Image
                  </TabsTrigger>
                  <TabsTrigger value="html" className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    HTML
                  </TabsTrigger>
                  <TabsTrigger value="script" className="flex items-center gap-2">
                    <FileCode className="w-4 h-4" />
                    Script
                  </TabsTrigger>
                  <TabsTrigger value="text" className="flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Text
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="image" className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Upload Image</label>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="bg-secondary/50"
                          disabled={uploadingImage}
                        />
                        {uploadingImage && <Loader2 className="w-5 h-5 animate-spin" />}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Or Enter Image URL</label>
                      <Input
                        value={formData.image_url}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                        placeholder="https://example.com/banner.jpg"
                        className="bg-secondary/50"
                      />
                    </div>
                    {formData.image_url && (
                      <div className="rounded-lg overflow-hidden border border-border">
                        <img src={formData.image_url} alt="Preview" className="max-h-48 w-auto mx-auto" />
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="html" className="mt-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">HTML Content</label>
                    <Textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="<div>Your HTML banner code...</div>"
                      className="bg-secondary/50 font-mono min-h-[150px]"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="script" className="mt-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Script/Ad Code</label>
                    <Textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="<script>// Your ad script...</script>"
                      className="bg-secondary/50 font-mono min-h-[150px]"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Paste your Google AdSense, affiliate, or other ad scripts here
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="text" className="mt-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Text Content</label>
                    <Textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Your promotional message..."
                      className="bg-secondary/50 min-h-[100px]"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Link URL */}
            <div>
              <label className="text-sm font-medium mb-2 block">Link URL (optional)</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  placeholder="https://example.com"
                  className="bg-secondary/50 pl-10"
                />
              </div>
            </div>

            {/* Scheduling */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Start Date (optional)</label>
                <Input
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="bg-secondary/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">End Date (optional)</label>
                <Input
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="bg-secondary/50"
                />
              </div>
            </div>

            {/* Priority & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <Input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  className="bg-secondary/50"
                  min={0}
                />
                <p className="text-xs text-muted-foreground mt-1">Higher = shown first</p>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <span className="text-sm">Active</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="neon" onClick={handleSaveBanner}>
                <Save className="w-4 h-4 mr-2" />
                {editingBanner ? "Update" : "Create"} Banner
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBanners;
