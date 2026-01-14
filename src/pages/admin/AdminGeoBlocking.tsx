import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { Globe, Ban, Plus, Trash2, Clock, AlertTriangle, RefreshCw, Search } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";

// Common countries list
const COUNTRIES = [
  { code: "AF", name: "Afghanistan" },
  { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },
  { code: "AR", name: "Argentina" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "BD", name: "Bangladesh" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BR", name: "Brazil" },
  { code: "BG", name: "Bulgaria" },
  { code: "CA", name: "Canada" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "HR", name: "Croatia" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "EG", name: "Egypt" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "GR", name: "Greece" },
  { code: "HK", name: "Hong Kong" },
  { code: "HU", name: "Hungary" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KR", name: "South Korea" },
  { code: "KP", name: "North Korea" },
  { code: "MY", name: "Malaysia" },
  { code: "MX", name: "Mexico" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NG", name: "Nigeria" },
  { code: "NO", name: "Norway" },
  { code: "PK", name: "Pakistan" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SG", name: "Singapore" },
  { code: "ZA", name: "South Africa" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "TW", name: "Taiwan" },
  { code: "TH", name: "Thailand" },
  { code: "TR", name: "Turkey" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "VN", name: "Vietnam" },
];

interface BlockedCountry {
  id: string;
  country_code: string;
  country_name: string;
  reason: string | null;
  blocked_by: string;
  blocked_at: string;
  expires_at: string | null;
  is_active: boolean;
}

const AdminGeoBlocking = () => {
  const { user } = useAuth();
  const [blockedCountries, setBlockedCountries] = useState<BlockedCountry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  
  // Form state
  const [selectedCountry, setSelectedCountry] = useState<{ code: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [expiration, setExpiration] = useState("permanent");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadBlockedCountries();
    
    // Setup realtime subscription
    const setupRealtime = async () => {
      const channel = await api.realtime
        .channel('blocked-countries-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'blocked_countries'
          },
          () => {
            loadBlockedCountries();
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    };

    let cleanup: (() => void) | undefined;
    setupRealtime().then(fn => { cleanup = fn; });

    return () => {
      cleanup?.();
    };
  }, []);

  const loadBlockedCountries = async () => {
    setIsLoading(true);
    const { data, error } = await api.db.query<BlockedCountry[]>("blocked_countries", {
      select: "*",
      order: { column: "blocked_at", ascending: false }
    });

    if (error) {
      console.error("Error loading blocked countries:", error);
      toast.error("Failed to load blocked countries");
    } else {
      setBlockedCountries(data || []);
    }
    setIsLoading(false);
  };

  const handleBlockCountry = async () => {
    if (!selectedCountry) {
      toast.error("Please select a country");
      return;
    }

    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    setIsSubmitting(true);

    // Calculate expiration
    let expiresAt: string | null = null;
    if (expiration !== "permanent") {
      const hours = parseInt(expiration);
      expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }

    const { error } = await api.db.insert("blocked_countries", {
      country_code: selectedCountry.code,
      country_name: selectedCountry.name,
      reason: reason.trim() || null,
      blocked_by: user.id,
      expires_at: expiresAt,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("This country is already blocked");
      } else {
        toast.error("Failed to block country: " + error.message);
      }
    } else {
      toast.success(`${selectedCountry.name} has been blocked`);
      setSelectedCountry(null);
      setReason("");
      setExpiration("permanent");
      setIsDialogOpen(false);
      loadBlockedCountries();
    }
    setIsSubmitting(false);
  };

  const handleUnblockCountry = async (id: string, name: string) => {
    const { error } = await api.db.update("blocked_countries", 
      { is_active: false },
      { id }
    );

    if (error) {
      toast.error("Failed to unblock country");
    } else {
      toast.success(`${name} has been unblocked`);
      loadBlockedCountries();
    }
  };

  const handleDeleteCountry = async (id: string) => {
    const { error } = await api.db.delete("blocked_countries", { id });

    if (error) {
      toast.error("Failed to delete record");
    } else {
      toast.success("Record deleted");
      loadBlockedCountries();
    }
  };

  const getExpirationStatus = (expiresAt: string | null, isActive: boolean) => {
    if (!isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (!expiresAt) {
      return <Badge variant="destructive">Permanent</Badge>;
    }
    const expiry = new Date(expiresAt);
    if (expiry < new Date()) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    return (
      <Badge variant="outline" className="text-amber-500 border-amber-500/30">
        {formatDistanceToNow(expiry, { addSuffix: true })}
      </Badge>
    );
  };

  const filteredCountries = COUNTRIES.filter(country => 
    !blockedCountries.some(bc => bc.country_code === country.code && bc.is_active)
  );

  if (isLoading) {
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
            Geographic Blocking
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">Block entire countries or regions from accessing the site</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadBlockedCountries} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          
          {/* Block Country Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Block Country
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-destructive" />
                  Block Country/Region
                </DialogTitle>
                <DialogDescription>
                  Block all IP addresses from a specific country. Use with caution.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Country *</Label>
                  <Popover open={isCountryOpen} onOpenChange={setIsCountryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isCountryOpen}
                        className="w-full justify-between"
                      >
                        {selectedCountry ? (
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-xs">{selectedCountry.code}</span>
                            {selectedCountry.name}
                          </span>
                        ) : (
                          "Select a country..."
                        )}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search countries..." />
                        <CommandList>
                          <CommandEmpty>No country found.</CommandEmpty>
                          <CommandGroup className="max-h-64 overflow-auto">
                            {filteredCountries.map((country) => (
                              <CommandItem
                                key={country.code}
                                value={`${country.code} ${country.name}`}
                                onSelect={() => {
                                  setSelectedCountry(country);
                                  setIsCountryOpen(false);
                                }}
                              >
                                <span className="font-mono text-xs mr-2">{country.code}</span>
                                {country.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for blocking this country..."
                    rows={2}
                    maxLength={500}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Block Duration</Label>
                  <Select value={expiration} onValueChange={setExpiration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="168">7 days</SelectItem>
                      <SelectItem value="720">30 days</SelectItem>
                      <SelectItem value="2160">90 days</SelectItem>
                      <SelectItem value="permanent">Permanent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleBlockCountry}
                  disabled={!selectedCountry || isSubmitting}
                >
                  {isSubmitting ? "Blocking..." : "Block Country"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Warning */}
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-600 dark:text-amber-400">Geographic Blocking Notice</p>
            <p className="text-sm text-muted-foreground">
              Blocking a country will prevent all IP addresses from that region from accessing the site.
              This requires IP geolocation which is performed during request processing.
              Use with caution - this may block legitimate users.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{blockedCountries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {blockedCountries.filter(c => c.is_active && (!c.expires_at || new Date(c.expires_at) > new Date())).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Permanent Blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {blockedCountries.filter(c => c.is_active && !c.expires_at).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expired/Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">
              {blockedCountries.filter(c => !c.is_active || (c.expires_at && new Date(c.expires_at) <= new Date())).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Blocked Countries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Blocked Countries</CardTitle>
          <CardDescription>Manage geographic blocks by country</CardDescription>
        </CardHeader>
        <CardContent>
          {blockedCountries.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No blocked countries</p>
              <p className="text-sm text-muted-foreground">Click "Block Country" to add a geographic block</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Blocked</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedCountries.map((country) => (
                    <TableRow key={country.id}>
                      <TableCell className="font-medium">{country.country_name}</TableCell>
                      <TableCell className="font-mono text-xs">{country.country_code}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {country.reason || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(country.blocked_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>{getExpirationStatus(country.expires_at, country.is_active)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {country.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnblockCountry(country.id, country.country_name)}
                            >
                              Unblock
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCountry(country.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

export default AdminGeoBlocking;