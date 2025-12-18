import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { storage, generateId } from "@/lib/storage";
import { Megaphone, Plus, Trash2, Save } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdSlot {
  id: string;
  name: string;
  position: 'header' | 'sidebar' | 'footer' | 'inline' | 'popup';
  code: string;
  enabled: boolean;
}

const ADS_KEY = 'trashmails_ads';

const AdminAds = () => {
  const [slots, setSlots] = useState<AdSlot[]>(() =>
    storage.get<AdSlot[]>(ADS_KEY, [])
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', position: 'sidebar' as AdSlot['position'], code: '' });
  const [adsEnabled, setAdsEnabled] = useState(() => storage.get('trashmails_ads_enabled', false));

  const saveSlots = (updated: AdSlot[]) => {
    storage.set(ADS_KEY, updated);
    setSlots(updated);
  };

  const addSlot = () => {
    if (!formData.name || !formData.code) {
      toast.error("Please fill all fields");
      return;
    }
    saveSlots([...slots, { id: generateId(), ...formData, enabled: true }]);
    setFormData({ name: '', position: 'sidebar', code: '' });
    setIsDialogOpen(false);
    toast.success("Ad slot created!");
  };

  const toggleSlot = (id: string) => {
    saveSlots(slots.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const deleteSlot = (id: string) => {
    saveSlots(slots.filter(s => s.id !== id));
    toast.success("Ad slot deleted");
  };

  const toggleAdsGlobal = (enabled: boolean) => {
    storage.set('trashmails_ads_enabled', enabled);
    setAdsEnabled(enabled);
    toast.success(enabled ? "Ads enabled" : "Ads disabled");
  };

  const getPositionBadge = (position: AdSlot['position']) => {
    const colors: Record<string, string> = {
      header: 'bg-blue-500/20 text-blue-500',
      sidebar: 'bg-green-500/20 text-green-500',
      footer: 'bg-purple-500/20 text-purple-500',
      inline: 'bg-yellow-500/20 text-yellow-500',
      popup: 'bg-red-500/20 text-red-500',
    };
    return <Badge className={colors[position]}>{position}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-primary" />
            Ads Management
          </h1>
          <p className="text-muted-foreground">Manage advertisement placements</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={adsEnabled} onCheckedChange={toggleAdsGlobal} />
            <Label>Enable Ads</Label>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Add Ad Slot</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Ad Slot</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Slot Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Header Banner"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select value={formData.position} onValueChange={(v) => setFormData({ ...formData, position: v as AdSlot['position'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="header">Header</SelectItem>
                      <SelectItem value="sidebar">Sidebar</SelectItem>
                      <SelectItem value="footer">Footer</SelectItem>
                      <SelectItem value="inline">Inline</SelectItem>
                      <SelectItem value="popup">Popup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ad Code</Label>
                  <Textarea
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="<script>...</script> or HTML"
                    rows={5}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={addSlot}>Add Slot</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ad Slots</CardTitle>
          <CardDescription>{slots.length} ad slot(s) configured</CardDescription>
        </CardHeader>
        <CardContent>
          {slots.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.map((slot) => (
                  <TableRow key={slot.id}>
                    <TableCell className="font-medium">{slot.name}</TableCell>
                    <TableCell>{getPositionBadge(slot.position)}</TableCell>
                    <TableCell>
                      <Badge className={slot.enabled ? "bg-green-500/20 text-green-500" : "bg-gray-500/20 text-gray-500"}>
                        {slot.enabled ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch checked={slot.enabled} onCheckedChange={() => toggleSlot(slot.id)} />
                      <Button variant="ghost" size="sm" onClick={() => deleteSlot(slot.id)} className="text-destructive ml-2">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No ad slots configured</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAds;
