import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { storage, generateId } from "@/lib/storage";
import { Key, Plus, Trash2, Copy, RefreshCw, Eye, EyeOff } from "lucide-react";
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

interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  createdAt: string;
  lastUsed?: string;
  enabled: boolean;
}

const API_KEYS_KEY = 'trashmails_api_keys';

const AdminAPI = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(() =>
    storage.get<ApiKey[]>(API_KEYS_KEY, [])
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const saveKeys = (updated: ApiKey[]) => {
    storage.set(API_KEYS_KEY, updated);
    setApiKeys(updated);
  };

  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'tm_';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const createKey = () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a key name");
      return;
    }
    const newKey: ApiKey = {
      id: generateId(),
      name: newKeyName.trim(),
      key: generateApiKey(),
      permissions: ['read', 'write'],
      createdAt: new Date().toISOString(),
      enabled: true,
    };
    saveKeys([...apiKeys, newKey]);
    setNewKeyName('');
    setIsDialogOpen(false);
    toast.success("API key created!");
  };

  const deleteKey = (id: string) => {
    saveKeys(apiKeys.filter(k => k.id !== id));
    toast.success("API key deleted");
  };

  const regenerateKey = (id: string) => {
    saveKeys(apiKeys.map(k => k.id === id ? { ...k, key: generateApiKey() } : k));
    toast.success("API key regenerated");
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("API key copied!");
  };

  const maskKey = (key: string) => {
    return key.substring(0, 6) + '••••••••••••••••••••••••••' + key.substring(key.length - 4);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Key className="w-8 h-8 text-primary" />
            API Integration
          </h1>
          <p className="text-muted-foreground">Manage API keys and integrations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Create API Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Key Name</Label>
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="My Application"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={createKey}>Create Key</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>{apiKeys.length} key(s) created</CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeys.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell className="font-medium">{apiKey.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-secondary px-2 py-1 rounded text-xs font-mono">
                          {visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                        </code>
                        <Button variant="ghost" size="sm" onClick={() => toggleKeyVisibility(apiKey.id)}>
                          {visibleKeys.has(apiKey.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => copyKey(apiKey.key)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(apiKey.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={apiKey.enabled ? "bg-green-500/20 text-green-500" : "bg-gray-500/20 text-gray-500"}>
                        {apiKey.enabled ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => regenerateKey(apiKey.id)}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteKey(apiKey.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No API keys created</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Documentation</CardTitle>
          <CardDescription>Quick reference for API endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 font-mono text-sm">
            <div className="p-3 bg-secondary/30 rounded-lg">
              <p className="text-muted-foreground mb-1"># Generate temporary email</p>
              <p>POST /api/v1/email/generate</p>
            </div>
            <div className="p-3 bg-secondary/30 rounded-lg">
              <p className="text-muted-foreground mb-1"># Get inbox messages</p>
              <p>GET /api/v1/email/:address/inbox</p>
            </div>
            <div className="p-3 bg-secondary/30 rounded-lg">
              <p className="text-muted-foreground mb-1"># Delete email</p>
              <p>DELETE /api/v1/email/:address</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAPI;
