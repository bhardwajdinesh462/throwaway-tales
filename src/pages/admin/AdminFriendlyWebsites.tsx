import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Trash2, 
  Save, 
  ExternalLink, 
  GripVertical,
  Settings,
  Eye,
  EyeOff,
  Globe,
  Palette,
  Maximize2,
  ArrowLeftRight,
  Smartphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FriendlyWebsite {
  id: string;
  name: string;
  url: string;
  icon_url: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  open_in_new_tab: boolean;
  created_at: string;
  updated_at: string;
}

interface WidgetSettings {
  enabled: boolean;
  visibleToPublic: boolean;
  visibleToLoggedIn: boolean;
  colorScheme: 'primary' | 'accent' | 'gradient' | 'glass';
  size: 'small' | 'medium' | 'large';
  position: 'left' | 'right';
  showOnMobile: boolean;
  animationType: 'slide' | 'fade' | 'bounce';
}

const defaultSettings: WidgetSettings = {
  enabled: true,
  visibleToPublic: true,
  visibleToLoggedIn: true,
  colorScheme: 'primary',
  size: 'medium',
  position: 'right',
  showOnMobile: true,
  animationType: 'slide',
};

// Sortable Website Card Component
const SortableWebsiteCard = ({ 
  website, 
  onToggleActive, 
  onEdit, 
  onDelete 
}: { 
  website: FriendlyWebsite;
  onToggleActive: (id: string, isActive: boolean) => void;
  onEdit: (website: FriendlyWebsite) => void;
  onDelete: (id: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: website.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className={`${!website.is_active ? 'opacity-60' : ''} ${isDragging ? 'z-50 shadow-lg' : ''}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                {...attributes} 
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
              >
                <GripVertical className="w-5 h-5" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Drag to reorder</p>
            </TooltipContent>
          </Tooltip>

          {website.icon_url ? (
            <img 
              src={website.icon_url} 
              alt={website.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-semibold">
                {website.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate">{website.name}</h3>
            <a 
              href={website.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
            >
              {website.url}
              <ExternalLink className="w-3 h-3" />
            </a>
            {website.description && (
              <p className="text-xs text-muted-foreground truncate mt-1">{website.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Switch
                    checked={website.is_active}
                    onCheckedChange={(checked) => onToggleActive(website.id, checked)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{website.is_active ? 'Disable' : 'Enable'} this website</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onEdit(website)}
                >
                  Edit
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit website details</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(website.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete website</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminFriendlyWebsites = () => {
  const queryClient = useQueryClient();
  const [websites, setWebsites] = useState<FriendlyWebsite[]>([]);
  const [settings, setSettings] = useState<WidgetSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<FriendlyWebsite | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    icon_url: '',
    description: '',
    open_in_new_tab: true,
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch websites
      const { data: websitesData, error: websitesError } = await supabase
        .from('friendly_websites')
        .select('*')
        .order('display_order', { ascending: true });

      if (websitesError) throw websitesError;
      setWebsites(websitesData || []);

      // Fetch settings
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'friendly_sites_widget')
        .maybeSingle();

      if (settingsData?.value) {
        setSettings({ ...defaultSettings, ...(settingsData.value as Partial<WidgetSettings>) });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Check if settings exist first
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'friendly_sites_widget')
        .maybeSingle();

      // Convert settings to JSON-compatible format
      const settingsJson = JSON.parse(JSON.stringify(settings));

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('app_settings')
          .update({
            value: settingsJson,
            updated_at: new Date().toISOString(),
          })
          .eq('key', 'friendly_sites_widget');

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('app_settings')
          .insert([{
            key: 'friendly_sites_widget',
            value: settingsJson,
            updated_at: new Date().toISOString(),
          }]);

        if (error) throw error;
      }

      toast.success('Settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['app_settings'] });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddWebsite = async () => {
    if (!formData.name || !formData.url) {
      toast.error('Name and URL are required');
      return;
    }

    try {
      const maxOrder = Math.max(...websites.map(w => w.display_order), -1);
      
      const { error } = await supabase
        .from('friendly_websites')
        .insert({
          name: formData.name,
          url: formData.url,
          icon_url: formData.icon_url || null,
          description: formData.description || null,
          open_in_new_tab: formData.open_in_new_tab,
          display_order: maxOrder + 1,
        });

      if (error) throw error;

      toast.success('Website added successfully');
      setAddDialogOpen(false);
      setFormData({ name: '', url: '', icon_url: '', description: '', open_in_new_tab: true });
      fetchData();
    } catch (error) {
      console.error('Error adding website:', error);
      toast.error('Failed to add website');
    }
  };

  const handleUpdateWebsite = async () => {
    if (!editingWebsite) return;

    try {
      const { error } = await supabase
        .from('friendly_websites')
        .update({
          name: formData.name,
          url: formData.url,
          icon_url: formData.icon_url || null,
          description: formData.description || null,
          open_in_new_tab: formData.open_in_new_tab,
        })
        .eq('id', editingWebsite.id);

      if (error) throw error;

      toast.success('Website updated successfully');
      setEditingWebsite(null);
      setFormData({ name: '', url: '', icon_url: '', description: '', open_in_new_tab: true });
      fetchData();
    } catch (error) {
      console.error('Error updating website:', error);
      toast.error('Failed to update website');
    }
  };

  const handleDeleteWebsite = async (id: string) => {
    if (!confirm('Are you sure you want to delete this website?')) return;

    try {
      const { error } = await supabase
        .from('friendly_websites')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Website deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting website:', error);
      toast.error('Failed to delete website');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('friendly_websites')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      toast.success(isActive ? 'Website enabled' : 'Website disabled');
      fetchData();
    } catch (error) {
      console.error('Error toggling website:', error);
      toast.error('Failed to update website');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = websites.findIndex((w) => w.id === active.id);
      const newIndex = websites.findIndex((w) => w.id === over.id);

      const newWebsites = arrayMove(websites, oldIndex, newIndex);
      setWebsites(newWebsites);

      // Update display_order in database
      try {
        const updates = newWebsites.map((website, index) => ({
          id: website.id,
          display_order: index,
        }));

        for (const update of updates) {
          await supabase
            .from('friendly_websites')
            .update({ display_order: update.display_order })
            .eq('id', update.id);
        }

        toast.success('Order updated successfully');
      } catch (error) {
        console.error('Error updating order:', error);
        toast.error('Failed to update order');
        fetchData(); // Revert on error
      }
    }
  };

  const openEditDialog = (website: FriendlyWebsite) => {
    setEditingWebsite(website);
    setFormData({
      name: website.name,
      url: website.url,
      icon_url: website.icon_url || '',
      description: website.description || '',
      open_in_new_tab: website.open_in_new_tab,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Friendly Websites</h1>
          <p className="text-muted-foreground">Manage partner sites shown in the sidebar widget</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Website
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add a new friendly website link</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <Tabs defaultValue="websites">
        <TabsList>
          <TabsTrigger value="websites">
            <Globe className="w-4 h-4 mr-2" />
            Websites
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Widget Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="websites" className="space-y-4 mt-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </CardContent>
            </Card>
          ) : websites.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Globe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-foreground mb-2">No websites yet</h3>
                <p className="text-muted-foreground mb-4">Add your first friendly website to show in the sidebar</p>
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Website
                </Button>
              </CardContent>
            </Card>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={websites.map(w => w.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {websites.map((website) => (
                    <SortableWebsiteCard
                      key={website.id}
                      website={website}
                      onToggleActive={handleToggleActive}
                      onEdit={openEditDialog}
                      onDelete={handleDeleteWebsite}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Widget Settings</CardTitle>
              <CardDescription>Configure how the friendly websites sidebar appears</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Widget</Label>
                  <p className="text-sm text-muted-foreground">Show the sidebar widget on the homepage</p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
                />
              </div>

              {/* Visibility */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label>Visible to Public</Label>
                      <p className="text-xs text-muted-foreground">Show to non-logged-in users</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.visibleToPublic}
                    onCheckedChange={(checked) => setSettings({ ...settings, visibleToPublic: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label>Visible to Logged-in</Label>
                      <p className="text-xs text-muted-foreground">Show to authenticated users</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.visibleToLoggedIn}
                    onCheckedChange={(checked) => setSettings({ ...settings, visibleToLoggedIn: checked })}
                  />
                </div>
              </div>

              {/* Appearance */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Color Scheme
                  </Label>
                  <Select
                    value={settings.colorScheme}
                    onValueChange={(value: WidgetSettings['colorScheme']) => 
                      setSettings({ ...settings, colorScheme: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="accent">Accent</SelectItem>
                      <SelectItem value="gradient">Gradient</SelectItem>
                      <SelectItem value="glass">Glass</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Maximize2 className="w-4 h-4" />
                    Size
                  </Label>
                  <Select
                    value={settings.size}
                    onValueChange={(value: WidgetSettings['size']) => 
                      setSettings({ ...settings, size: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4" />
                    Position
                  </Label>
                  <Select
                    value={settings.position}
                    onValueChange={(value: WidgetSettings['position']) => 
                      setSettings({ ...settings, position: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Animation Type</Label>
                  <Select
                    value={settings.animationType}
                    onValueChange={(value: WidgetSettings['animationType']) => 
                      setSettings({ ...settings, animationType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slide">Slide</SelectItem>
                      <SelectItem value="fade">Fade</SelectItem>
                      <SelectItem value="bounce">Bounce</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Mobile */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <Label>Show on Mobile</Label>
                    <p className="text-xs text-muted-foreground">Display widget on mobile devices</p>
                  </div>
                </div>
                <Switch
                  checked={settings.showOnMobile}
                  onCheckedChange={(checked) => setSettings({ ...settings, showOnMobile: checked })}
                />
              </div>

              {/* Save Button */}
              <Button onClick={saveSettings} disabled={isSaving} className="w-full">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Website Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Friendly Website</DialogTitle>
            <DialogDescription>
              Add a partner or related website to show in the sidebar widget
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="Website name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>URL *</Label>
              <Input
                placeholder="https://example.com"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon URL (optional)</Label>
              <Input
                placeholder="https://example.com/icon.png"
                value={formData.icon_url}
                onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Brief description of the website"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Open in new tab</Label>
              <Switch
                checked={formData.open_in_new_tab}
                onCheckedChange={(checked) => setFormData({ ...formData, open_in_new_tab: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddWebsite}>Add Website</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Website Dialog */}
      <Dialog open={!!editingWebsite} onOpenChange={(open) => !open && setEditingWebsite(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Website</DialogTitle>
            <DialogDescription>
              Update the website details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="Website name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>URL *</Label>
              <Input
                placeholder="https://example.com"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon URL (optional)</Label>
              <Input
                placeholder="https://example.com/icon.png"
                value={formData.icon_url}
                onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Brief description of the website"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Open in new tab</Label>
              <Switch
                checked={formData.open_in_new_tab}
                onCheckedChange={(checked) => setFormData({ ...formData, open_in_new_tab: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingWebsite(null)}>Cancel</Button>
            <Button onClick={handleUpdateWebsite}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFriendlyWebsites;
