import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { 
  Wrench, 
  Plus, 
  Calendar, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Trash2,
  Edit
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow, format } from "date-fns";

interface MaintenanceWindow {
  id: string;
  title: string;
  description: string;
  scheduled_start: string;
  scheduled_end: string;
  affected_services: string[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

const AdminMaintenance = () => {
  const [maintenanceWindows, setMaintenanceWindows] = useState<MaintenanceWindow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    scheduled_start: "",
    scheduled_end: "",
    affected_services: [] as string[],
  });

  const services = ["IMAP", "SMTP", "Database", "Website", "API"];

  useEffect(() => {
    loadMaintenanceWindows();
  }, []);

  const loadMaintenanceWindows = async () => {
    setIsLoading(true);
    try {
      const response = await api.admin.getMaintenance();
      if (response.data?.maintenance) {
        setMaintenanceWindows(response.data.maintenance);
      }
    } catch (error) {
      console.log("Using empty maintenance list");
      setMaintenanceWindows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.scheduled_start) {
      toast.error("Title and start time are required");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await api.admin.updateMaintenance(editingId, formData);
        toast.success("Maintenance window updated");
      } else {
        await api.admin.createMaintenance(formData);
        toast.success("Maintenance window scheduled");
      }
      setIsDialogOpen(false);
      resetForm();
      loadMaintenanceWindows();
    } catch (error) {
      toast.error("Failed to save maintenance window");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await api.admin.startMaintenance(id);
      toast.success("Maintenance started");
      loadMaintenanceWindows();
    } catch (error) {
      toast.error("Failed to start maintenance");
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await api.admin.completeMaintenance(id);
      toast.success("Maintenance completed");
      loadMaintenanceWindows();
    } catch (error) {
      toast.error("Failed to complete maintenance");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await api.admin.cancelMaintenance(id);
      toast.success("Maintenance cancelled");
      loadMaintenanceWindows();
    } catch (error) {
      toast.error("Failed to cancel maintenance");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.admin.deleteMaintenance(id);
      toast.success("Maintenance window deleted");
      loadMaintenanceWindows();
    } catch (error) {
      toast.error("Failed to delete maintenance window");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      scheduled_start: "",
      scheduled_end: "",
      affected_services: [],
    });
    setEditingId(null);
  };

  const handleEdit = (maintenance: MaintenanceWindow) => {
    setEditingId(maintenance.id);
    setFormData({
      title: maintenance.title,
      description: maintenance.description || "",
      scheduled_start: maintenance.scheduled_start?.slice(0, 16) || "",
      scheduled_end: maintenance.scheduled_end?.slice(0, 16) || "",
      affected_services: maintenance.affected_services || [],
    });
    setIsDialogOpen(true);
  };

  const toggleService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      affected_services: prev.affected_services.includes(service)
        ? prev.affected_services.filter(s => s !== service)
        : [...prev.affected_services, service]
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Scheduled</Badge>;
      case 'in_progress':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Wrench className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            Scheduled Maintenance
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Schedule and manage maintenance windows
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Schedule Maintenance
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Maintenance Window" : "Schedule Maintenance"}
              </DialogTitle>
              <DialogDescription>
                Create a scheduled maintenance window to notify users
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Database Upgrade"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the maintenance work..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start">Start Time</Label>
                  <Input
                    id="start"
                    type="datetime-local"
                    value={formData.scheduled_start}
                    onChange={(e) => setFormData({ ...formData, scheduled_start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end">End Time</Label>
                  <Input
                    id="end"
                    type="datetime-local"
                    value={formData.scheduled_end}
                    onChange={(e) => setFormData({ ...formData, scheduled_end: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Affected Services</Label>
                <div className="flex flex-wrap gap-2">
                  {services.map((service) => (
                    <label key={service} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={formData.affected_services.includes(service)}
                        onCheckedChange={() => toggleService(service)}
                      />
                      <span className="text-sm">{service}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? "Saving..." : editingId ? "Update" : "Schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active/Upcoming Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Maintenance Windows
          </CardTitle>
          <CardDescription>
            View and manage all scheduled maintenance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {maintenanceWindows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No maintenance windows scheduled</p>
              <p className="text-sm">Click "Schedule Maintenance" to create one</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>Services</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenanceWindows.map((maintenance) => (
                    <TableRow key={maintenance.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{maintenance.title}</p>
                          {maintenance.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {maintenance.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(maintenance.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {maintenance.scheduled_start && (
                            <>
                              <p>{format(new Date(maintenance.scheduled_start), 'MMM d, yyyy')}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(maintenance.scheduled_start), 'h:mm a')}
                              </p>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {maintenance.affected_services?.map((service) => (
                            <Badge key={service} variant="outline" className="text-xs">
                              {service}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {maintenance.status === 'scheduled' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStart(maintenance.id)}
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Start
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(maintenance)}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCancel(maintenance.id)}
                              >
                                <XCircle className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                          {maintenance.status === 'in_progress' && (
                            <Button
                              size="sm"
                              onClick={() => handleComplete(maintenance.id)}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Complete
                            </Button>
                          )}
                          {(maintenance.status === 'completed' || maintenance.status === 'cancelled') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(maintenance.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMaintenance;
