import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { Shield, Check, X, Clock, RefreshCw, UserPlus } from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

interface RoleRequest {
  id: string;
  user_id: string;
  requested_role: string;
  existing_role: string | null;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

const AdminRoleApprovals = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<RoleRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from("admin_role_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load requests: " + error.message);
    } else {
      // Fetch user profiles for each request
      const requestsWithProfiles = await Promise.all(
        (data || []).map(async (request) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, display_name")
            .eq("user_id", request.user_id)
            .single();
          
          return {
            ...request,
            user_email: profile?.email || "Unknown",
            user_name: profile?.display_name || "Unknown User",
          };
        })
      );
      setRequests(requestsWithProfiles);
    }
    setIsLoading(false);
  };

  const handleApprove = async () => {
    if (!selectedRequest || !user) return;
    
    setIsProcessing(true);

    // Update the request status
    const { error: updateError } = await supabase
      .from("admin_role_requests")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes,
      })
      .eq("id", selectedRequest.id);

    if (updateError) {
      toast.error("Failed to approve request: " + updateError.message);
      setIsProcessing(false);
      return;
    }

    // Grant the role
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({
        user_id: selectedRequest.user_id,
        role: selectedRequest.requested_role as "admin" | "moderator" | "user",
      }, { onConflict: "user_id" });

    if (roleError) {
      toast.error("Failed to grant role: " + roleError.message);
    } else {
      toast.success(`Role ${selectedRequest.requested_role} granted successfully!`);
      
      // Log the action
      await supabase.rpc("log_admin_access", {
        p_action: "APPROVE_ROLE_REQUEST",
        p_table_name: "admin_role_requests",
        p_record_id: selectedRequest.id,
        p_details: {
          approved_role: selectedRequest.requested_role,
          user_id: selectedRequest.user_id,
          notes: reviewNotes,
        },
      });
    }

    setSelectedRequest(null);
    setReviewNotes("");
    setIsProcessing(false);
    loadRequests();
  };

  const handleReject = async () => {
    if (!selectedRequest || !user) return;
    
    setIsProcessing(true);

    const { error } = await supabase
      .from("admin_role_requests")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes,
      })
      .eq("id", selectedRequest.id);

    if (error) {
      toast.error("Failed to reject request: " + error.message);
    } else {
      toast.success("Request rejected");
      
      // Log the action
      await supabase.rpc("log_admin_access", {
        p_action: "REJECT_ROLE_REQUEST",
        p_table_name: "admin_role_requests",
        p_record_id: selectedRequest.id,
        p_details: {
          rejected_role: selectedRequest.requested_role,
          user_id: selectedRequest.user_id,
          notes: reviewNotes,
        },
      });
    }

    setSelectedRequest(null);
    setReviewNotes("");
    setIsProcessing(false);
    loadRequests();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30"><Check className="w-3 h-3 mr-1" /> Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30"><X className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-blue-500/20 text-blue-500">Admin</Badge>;
      case "moderator":
        return <Badge className="bg-purple-500/20 text-purple-500">Moderator</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            Role Approval Queue
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingCount} pending</Badge>
            )}
          </h1>
          <p className="text-muted-foreground">Review and approve admin role requests</p>
        </div>
        <Button variant="outline" onClick={loadRequests}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl">{requests.filter(r => r.status === "pending").length}</CardTitle>
            <CardDescription>Pending Requests</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-green-500">{requests.filter(r => r.status === "approved").length}</CardTitle>
            <CardDescription>Approved</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-red-500">{requests.filter(r => r.status === "rejected").length}</CardTitle>
            <CardDescription>Rejected</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Role Requests</CardTitle>
          <CardDescription>All admin and moderator role requests</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-12">
              <UserPlus className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No role requests yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Requested Role</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{request.user_name}</p>
                        <p className="text-xs text-muted-foreground">{request.user_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(request.requested_role)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {request.reason || <span className="text-muted-foreground">No reason provided</span>}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" && (
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-green-500 hover:text-green-600"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => {
                              setSelectedRequest(request);
                              // Auto-open for rejection
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                      {request.status !== "pending" && request.review_notes && (
                        <span className="text-xs text-muted-foreground">{request.review_notes}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Role Request</DialogTitle>
            <DialogDescription>
              {selectedRequest?.user_name} is requesting {selectedRequest?.requested_role} access
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-secondary/30 rounded-lg">
              <p className="text-sm font-medium mb-1">Reason for request:</p>
              <p className="text-sm text-muted-foreground">
                {selectedRequest?.reason || "No reason provided"}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Review Notes (optional)</label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add notes about your decision..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={isProcessing}
            >
              <X className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button 
              onClick={handleApprove}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRoleApprovals;