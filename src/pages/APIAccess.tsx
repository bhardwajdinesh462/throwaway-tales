import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Key,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Plus,
  Clock,
  BarChart3,
  AlertTriangle,
  Check,
  Crown,
  ArrowLeft,
  Code,
  Terminal,
  Zap,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useSubscription } from "@/hooks/useSubscription";
import FeatureGate from "@/components/FeatureGate";
import { useConfetti } from "@/hooks/useConfetti";
import { storage } from "@/lib/storage";

interface APIKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
  requestCount: number;
}

interface UsageStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  limit: number;
}

const APIAccess = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { currentTier, isPremium, isLoading: subLoading } = useSubscription();
  const { fireSuccessConfetti } = useConfetti();
  
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  // Simulated usage stats
  const usageStats: UsageStats = {
    today: 127,
    thisWeek: 892,
    thisMonth: 3456,
    limit: currentTier?.name === "business" ? -1 : 10000,
  };

  const rateLimits = {
    requestsPerMinute: currentTier?.name === "business" ? 100 : 30,
    requestsPerDay: currentTier?.name === "business" ? -1 : 10000,
  };

  useEffect(() => {
    if (user) {
      const saved = storage.get<APIKey[]>(`api_keys_${user.id}`, []);
      setApiKeys(saved);
    }
  }, [user]);

  const saveKeys = (keys: APIKey[]) => {
    setApiKeys(keys);
    if (user) {
      storage.set(`api_keys_${user.id}`, keys);
    }
  };

  const generateKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const prefix = "nst_";
    let key = prefix;
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for your API key");
      return;
    }

    setIsCreating(true);
    
    // Simulate API call
    setTimeout(() => {
      const key = generateKey();
      const newKey: APIKey = {
        id: crypto.randomUUID(),
        name: newKeyName,
        key,
        createdAt: new Date().toISOString(),
        lastUsed: null,
        requestCount: 0,
      };

      saveKeys([...apiKeys, newKey]);
      setNewKeyValue(key);
      setNewKeyName("");
      setIsCreating(false);
      fireSuccessConfetti();
    }, 500);
  };

  const handleDeleteKey = (id: string) => {
    saveKeys(apiKeys.filter((k) => k.id !== id));
    toast.success("API key deleted");
  };

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(key);
    toast.success("API key copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleShowKey = (id: string) => {
    setShowKey((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const maskKey = (key: string) => {
    return key.slice(0, 8) + "•".repeat(24) + key.slice(-4);
  };

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <FeatureGate feature="canUseApi" requiredTier="pro">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <Key className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold">API Access</h1>
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                {currentTier?.name}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Manage your API keys and monitor usage for programmatic email management.
            </p>
          </motion.div>

          {/* Usage Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Today", value: usageStats.today, icon: Clock },
              { label: "This Week", value: usageStats.thisWeek, icon: BarChart3 },
              { label: "This Month", value: usageStats.thisMonth, icon: BarChart3 },
              {
                label: "Monthly Limit",
                value: usageStats.limit === -1 ? "∞" : usageStats.limit.toLocaleString(),
                icon: Zap,
              },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="glass-card">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <stat.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {typeof stat.value === "number"
                            ? stat.value.toLocaleString()
                            : stat.value}
                        </p>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Rate Limits */}
          <Card className="glass-card mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Rate Limits
              </CardTitle>
              <CardDescription>
                Current usage against your plan's rate limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Requests per minute</span>
                  <span>12 / {rateLimits.requestsPerMinute}</span>
                </div>
                <Progress value={(12 / rateLimits.requestsPerMinute) * 100} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Requests per day</span>
                  <span>
                    {usageStats.today.toLocaleString()} /{" "}
                    {rateLimits.requestsPerDay === -1 ? "∞" : rateLimits.requestsPerDay.toLocaleString()}
                  </span>
                </div>
                <Progress
                  value={
                    rateLimits.requestsPerDay === -1
                      ? 0
                      : (usageStats.today / rateLimits.requestsPerDay) * 100
                  }
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <Tabs defaultValue="keys" className="space-y-6">
            <TabsList className="grid grid-cols-2 w-fit">
              <TabsTrigger value="keys" className="gap-2">
                <Key className="w-4 h-4" />
                API Keys
              </TabsTrigger>
              <TabsTrigger value="docs" className="gap-2">
                <Code className="w-4 h-4" />
                Documentation
              </TabsTrigger>
            </TabsList>

            {/* API Keys Tab */}
            <TabsContent value="keys">
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Your API Keys</CardTitle>
                      <CardDescription>
                        Create and manage API keys for authentication
                      </CardDescription>
                    </div>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <Button className="gap-2" onClick={() => setDialogOpen(true)}>
                        <Plus className="w-4 h-4" />
                        Create Key
                      </Button>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create New API Key</DialogTitle>
                          <DialogDescription>
                            Give your API key a descriptive name to remember its purpose.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <Label>Key Name</Label>
                          <Input
                            placeholder="e.g., Production Server"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            className="mt-2"
                          />
                        </div>
                        {newKeyValue && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg"
                          >
                            <p className="text-sm text-green-500 mb-2 flex items-center gap-2">
                              <Check className="w-4 h-4" />
                              API Key Created! Copy it now - you won't see it again.
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 p-2 bg-secondary rounded text-sm font-mono break-all">
                                {newKeyValue}
                              </code>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => handleCopyKey(newKeyValue)}
                              >
                                {copiedKey === newKeyValue ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </motion.div>
                        )}
                        <DialogFooter>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setDialogOpen(false);
                              setNewKeyValue(null);
                              setNewKeyName("");
                            }}
                          >
                            {newKeyValue ? "Done" : "Cancel"}
                          </Button>
                          {!newKeyValue && (
                            <Button onClick={handleCreateKey} disabled={isCreating}>
                              {isCreating ? (
                                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                              ) : null}
                              Create Key
                            </Button>
                          )}
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {apiKeys.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Key className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>No API keys yet</p>
                      <p className="text-sm">Create your first key to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {apiKeys.map((key) => (
                        <motion.div
                          key={key.id}
                          layout
                          className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{key.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-sm font-mono text-muted-foreground">
                                {showKey[key.id] ? key.key : maskKey(key.key)}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => toggleShowKey(key.id)}
                              >
                                {showKey[key.id] ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Created {new Date(key.createdAt).toLocaleDateString()} •{" "}
                              {key.requestCount} requests
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopyKey(key.key)}
                            >
                              {copiedKey === key.key ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the key "{key.name}". Any
                                    applications using this key will stop working.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteKey(key.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documentation Tab */}
            <TabsContent value="docs">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="w-5 h-5" />
                    Quick Start
                  </CardTitle>
                  <CardDescription>
                    Get started with the Nullsto API in minutes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-medium mb-2">Authentication</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Include your API key in the Authorization header:
                    </p>
                    <pre className="p-4 bg-secondary rounded-lg overflow-x-auto">
                      <code className="text-sm">
                        {`curl -H "Authorization: Bearer nst_your_api_key" \\
  https://api.nullsto.email/v1/emails`}
                      </code>
                    </pre>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Create Temp Email</h3>
                    <pre className="p-4 bg-secondary rounded-lg overflow-x-auto">
                      <code className="text-sm">
                        {`POST /v1/emails/create
{
  "domain": "nullsto.email",
  "prefix": "optional-custom-prefix"
}`}
                      </code>
                    </pre>
                  </div>

                  <div>
                    <h3 className="font-medium mb-2">Get Inbox</h3>
                    <pre className="p-4 bg-secondary rounded-lg overflow-x-auto">
                      <code className="text-sm">
                        {`GET /v1/emails/{email_id}/inbox

Response:
{
  "emails": [
    {
      "id": "abc123",
      "from": "sender@example.com",
      "subject": "Hello",
      "received_at": "2024-01-15T10:30:00Z",
      "is_read": false
    }
  ]
}`}
                      </code>
                    </pre>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Button variant="outline" className="gap-2">
                      <Code className="w-4 h-4" />
                      View Full Documentation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          </FeatureGate>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default APIAccess;
