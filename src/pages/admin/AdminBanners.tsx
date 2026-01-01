import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus, Trash2, Edit, Image, Code, Type, FileCode,
  Eye, EyeOff, Calendar, Upload, Loader2,
  MousePointer, Layout, Ruler
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { api, storage } from "@/lib/api";
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
import { Badge } from "@/components/ui/badge";

interface Banner {
  id: string;
  name: string;
  position: string;
  type: string;
  content: string;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  priority: number;
  click_count: number;
  view_count: number;
  width: number;
  height: number;
  size_name: string;
  created_at: string;
}

const positionLabels: Record<string, string> = {
  header: "Header (Top of page)",
  sidebar: "Sidebar (Right side)",
  content: "Content (Between sections)",
  footer: "Footer (Bottom of page)",
  popup: "Popup (Overlay)",
};

const sizePresets = [
  { name: "leaderboard", width: 728, height: 90, label: "Leaderboard (728×90)" },
  { name: "medium-rectangle", width: 300, height: 250, label: "Medium Rectangle (300×250)" },
  { name: "wide-skyscraper", width: 160, height: 600, label: "Wide Skyscraper (160×600)" },
  { name: "mobile-banner", width: 320, height: 50, label: "Mobile Banner (320×50)" },
  { name: "large-banner", width: 970, height: 250, label: "Large Banner (970×250)" },
  { name: "half-page", width: 300, height: 600, label: "Half Page (300×600)" },
  { name: "billboard", width: 970, height: 90, label: "Billboard (970×90)" },
  { name: "custom", width: 0, height: 0, label: "Custom Size" },
];

const typeIcons: Record<string, any> = {
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
    position: "header",
    type: "image",
    content: "",
    image_url: "",
    link_url: "",
    is_active: true,
    start_date: "",
    end_date: "",
    priority: 0,
    width: 728,
    height: 90,
    size_name: "leaderboard",
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await api.admin.getBanners();
      
      if (error) throw new Error(error.message);
      setBanners(data || []);
    } catch (error: any) {
      console.error("Error fetching banners:", error);
      toast.error("Failed to load banners");
    } finally {
      setIsLoading(false);
    }
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
      width: 728,
      height: 90,
      size_name: "leaderboard",
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
      width: banner.width || 728,
      height: banner.height || 90,
      size_name: banner.size_name || "leaderboard",
    });
    setIsDialogOpen(true);
  };

  const handleSizePresetChange = (presetName: string) => {
    const preset = sizePresets.find(p => p.name === presetName);
    if (preset) {
      setFormData({
        ...formData,
        size_name: preset.name,
        width: preset.width || formData.width,
        height: preset.height || formData.height,
      });
    }
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
      const filePath = `banners/${fileName}`;

      const { data, error: uploadError } = await storage.upload("banners", filePath, file);

      if (uploadError) throw new Error(uploadError.message);

      setFormData({ ...formData, image_url: data?.url || '' });
      toast.success("Image uploaded successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveBanner = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a banner name");
      return;
    }

    if (formData.type === "image" && !formData.image_url) {
      toast.error("Please provide an image");
      return;
    }

    if (formData.type !== "image" && !formData.content.trim()) {
      toast.error("Please enter banner content");
      return;
    }

    try {
      const bannerData: Record<string, any> = {
        name: formData.name,
        position: formData.position,
        type: formData.type,
        content: formData.content || "",
        image_url: formData.image_url || null,
        link_url: formData.link_url || null,
        is_active: formData.is_active,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        priority: formData.priority,
        width: formData.width,
        height: formData.height,
        size_name: formData.size_name,
      };

      if (editingBanner) {
        bannerData.id = editingBanner.id;
      }

      const { error } = await api.admin.saveBanner(bannerData);
      
      if (error) throw new Error(error.message);
      toast.success(editingBanner ? "Banner updated successfully" : "Banner created successfully");

      setIsDialogOpen(false);
      fetchBanners();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save banner");
    }
  };

  const handleDeleteBanner = async (id: string) => {
    try {
      const { error } = await api.admin.deleteBanner(id);
      if (error) throw new Error(error.message);
      setBanners(banners.filter(b => b.id !== id));
      toast.success("Banner deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete banner");
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      const { error } = await api.admin.saveBanner({
        id: banner.id,
        is_active: !banner.is_active
      });
      
      if (error) throw new Error(error.message);
      setBanners(banners.map(b => 
        b.id === banner.id ? { ...b, is_active: !b.is_active } : b
      ));
    } catch (error: any) {
      toast.error(error.message || "Failed to update banner status");
    }
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
          <p className="text-muted-foreground">Manage ads and banners with size presets</p>
        </div>
        <Button variant="neon" onClick={handleCreateBanner}>
          <Plus className="w-4 h-4 mr-2" />
          Add Banner
        </Button>
      </div>

      {/* Position Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.keys(positionLabels).map((pos) => {
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
            const TypeIcon = typeIcons[banner.type] || Image;
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
                  <div 
                    className="rounded-lg bg-secondary/50 overflow-hidden flex-shrink-0 flex items-center justify-center"
                    style={{ width: Math.min(banner.width || 100, 120), height: Math.min(banner.height || 60, 80) }}
                  >
                    {banner.type === "image" && banner.image_url ? (
                      <img
                        src={banner.image_url}
                        alt={banner.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <TypeIcon className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-medium text-foreground truncate">{banner.name}</h4>
                      <Badge variant={banner.is_active ? "default" : "secondary"}>
                        {banner.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Ruler className="w-3 h-3" />
                        {banner.width}×{banner.height}
                      </Badge>
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
                      onCheckedChange={() => handleToggleActive(banner)}
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
                  onValueChange={(v) => setFormData({ ...formData, position: v })}
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

            {/* Size Preset */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Ruler className="w-4 h-4" /> Size Preset
                </label>
                <Select
                  value={formData.size_name}
                  onValueChange={handleSizePresetChange}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sizePresets.map((preset) => (
                      <SelectItem key={preset.name} value={preset.name}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium mb-2 block">Width (px)</label>
                  <Input
                    type="number"
                    value={formData.width}
                    onChange={(e) => setFormData({ ...formData, width: parseInt(e.target.value) || 0, size_name: "custom" })}
                    className="bg-secondary/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Height (px)</label>
                  <Input
                    type="number"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) || 0, size_name: "custom" })}
                    className="bg-secondary/50"
                  />
                </div>
              </div>
            </div>

            {/* Preview Box */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-dashed border-border">
              <p className="text-sm text-muted-foreground mb-2">Preview Size:</p>
              <div 
                className="bg-muted/30 border border-border flex items-center justify-center text-xs text-muted-foreground mx-auto"
                style={{ 
                  width: Math.min(formData.width, 300), 
                  height: Math.min(formData.height, 150),
                  aspectRatio: `${formData.width}/${formData.height}`
                }}
              >
                {formData.width} × {formData.height}
              </div>
            </div>

            {/* Type Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Banner Type</label>
              <Tabs
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
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

                <TabsContent value="image" className="mt-4 space-y-4">
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
                </TabsContent>

                <TabsContent value="html" className="mt-4">
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="<div>Your HTML banner code...</div>"
                    className="bg-secondary/50 font-mono min-h-[150px]"
                  />
                </TabsContent>

                <TabsContent value="script" className="mt-4">
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="<script>// Your ad script...</script>"
                    className="bg-secondary/50 font-mono min-h-[150px]"
                  />
                </TabsContent>

                <TabsContent value="text" className="mt-4">
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Your text banner message..."
                    className="bg-secondary/50 min-h-[100px]"
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Link URL */}
            <div>
              <label className="text-sm font-medium mb-2 block">Click URL (Optional)</label>
              <Input
                value={formData.link_url}
                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                placeholder="https://example.com"
                className="bg-secondary/50"
              />
            </div>

            {/* Scheduling */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Start Date
                </label>
                <Input
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="bg-secondary/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> End Date
                </label>
                <Input
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="bg-secondary/50"
                />
              </div>
            </div>

            {/* Priority & Active */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Priority (higher = shown first)</label>
                <Input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  className="bg-secondary/50"
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                <div>
                  <p className="font-medium text-foreground">Active</p>
                  <p className="text-sm text-muted-foreground">Display this banner</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button variant="neon" onClick={handleSaveBanner}>
              {editingBanner ? "Update Banner" : "Create Banner"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBanners;
