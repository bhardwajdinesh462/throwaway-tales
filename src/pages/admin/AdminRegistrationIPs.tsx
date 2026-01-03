import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { Globe, Download, RefreshCw, Search, Ban, Filter } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow, format } from "date-fns";

interface ProfileWithIP {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  registration_ip: string | null;
  created_at: string;
}

const AdminRegistrationIPs = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileWithIP[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadProfiles();
  }, [page]);

  useEffect(() => {
    // Setup realtime subscription
    const channel = supabase
      .channel('profiles-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          loadProfiles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadProfiles = async () => {
    setIsLoading(true);
    
    let query = supabase
      .from("profiles")
      .select("id, user_id, email, display_name, registration_ip, created_at", { count: 'exact' })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (searchQuery) {
      query = query.or(`email.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`);
    }

    if (ipFilter) {
      query = query.ilike('registration_ip', `%${ipFilter}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error loading profiles:", error);
      toast.error("Failed to load profiles");
    } else {
      setProfiles(data || []);
      setTotalCount(count || 0);
    }
    setIsLoading(false);
  };

  const handleSearch = () => {
    setPage(1);
    loadProfiles();
  };

  const handleBlockIP = async (ip: string) => {
    if (!ip || !user) return;

    const { error } = await supabase
      .from("blocked_ips")
      .insert([{
        ip_address: ip,
        reason: "Blocked from registration IPs page",
        blocked_by: user.id,
      }]);

    if (error) {
      if (error.code === "23505") {
        toast.error("This IP is already blocked");
      } else {
        toast.error("Failed to block IP");
      }
    } else {
      toast.success(`IP ${ip} has been blocked`);
    }
  };

  const exportToCSV = () => {
    const headers = ["Email", "Display Name", "Registration IP", "Registered At"];
    const rows = profiles.map(p => [
      p.email || "",
      p.display_name || "",
      p.registration_ip || "",
      p.created_at ? format(new Date(p.created_at), 'yyyy-MM-dd HH:mm:ss') : ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registration-ips-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Get unique IPs for stats
  const uniqueIPs = new Set(profiles.filter(p => p.registration_ip).map(p => p.registration_ip));

  if (isLoading && profiles.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            Registration IPs
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">View and manage user registration IP addresses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadProfiles} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToCSV} size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique IPs (Page)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{uniqueIPs.size}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Missing IPs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">
              {profiles.filter(p => !p.registration_ip).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by email or display name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="w-full sm:w-48">
              <Input
                placeholder="Filter by IP..."
                value={ipFilter}
                onChange={(e) => setIpFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Registration Data</CardTitle>
          <CardDescription>
            Showing {profiles.length} of {totalCount} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Registration IP</TableHead>
                      <TableHead className="hidden sm:table-cell">Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium truncate max-w-[200px]">
                              {profile.display_name || "—"}
                            </p>
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {profile.email || "—"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {profile.registration_ip ? (
                            <code className="text-xs sm:text-sm bg-muted px-2 py-1 rounded">
                              {profile.registration_ip}
                            </code>
                          ) : (
                            <Badge variant="secondary">Not captured</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          {profile.registration_ip && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleBlockIP(profile.registration_ip!)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRegistrationIPs;
