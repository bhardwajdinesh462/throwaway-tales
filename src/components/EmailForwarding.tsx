import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Forward, Mail, Trash2, Plus, Check, X, Loader2, 
  AlertCircle, ToggleLeft, ToggleRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { toast } from "sonner";
import { z } from "zod";

interface ForwardingRule {
  id: string;
  temp_email_id: string;
  temp_email_address: string;
  forward_to_address: string;
  is_active: boolean;
  created_at: string;
}

const emailSchema = z.string().email("Please enter a valid email address");

const EmailForwarding = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<ForwardingRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newForwardTo, setNewForwardTo] = useState("");
  const [selectedTempEmail, setSelectedTempEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Load forwarding rules from localStorage
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const stored = localStorage.getItem("nullsto_forwarding_rules");
    if (stored) {
      const parsed = JSON.parse(stored);
      setRules(parsed.filter((r: ForwardingRule) => r.temp_email_id.startsWith(user.id.slice(0, 8))));
    }
    setIsLoading(false);
  }, [user]);

  // Get user's temp emails from localStorage
  const getUserTempEmails = () => {
    const stored = localStorage.getItem("nullsto_temp_emails");
    if (!stored) return [];
    const emails = JSON.parse(stored);
    return emails.filter((e: any) => e.user_id === user?.id);
  };

  const handleAddRule = async () => {
    if (!user) {
      toast.error("Please sign in to use email forwarding");
      return;
    }

    try {
      emailSchema.parse(newForwardTo);
    } catch {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!selectedTempEmail) {
      toast.error("Please select a temporary email to forward");
      return;
    }

    setIsAdding(true);

    const newRule: ForwardingRule = {
      id: `fwd_${Date.now()}`,
      temp_email_id: selectedTempEmail,
      temp_email_address: getUserTempEmails().find((e: any) => e.id === selectedTempEmail)?.address || "",
      forward_to_address: newForwardTo,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const updatedRules = [...rules, newRule];
    setRules(updatedRules);
    localStorage.setItem("nullsto_forwarding_rules", JSON.stringify(updatedRules));

    setNewForwardTo("");
    setSelectedTempEmail("");
    setShowAddForm(false);
    setIsAdding(false);
    toast.success("Forwarding rule created!");
  };

  const handleToggleRule = (ruleId: string) => {
    const updatedRules = rules.map((r) =>
      r.id === ruleId ? { ...r, is_active: !r.is_active } : r
    );
    setRules(updatedRules);
    localStorage.setItem("nullsto_forwarding_rules", JSON.stringify(updatedRules));
    toast.success("Forwarding rule updated");
  };

  const handleDeleteRule = (ruleId: string) => {
    const updatedRules = rules.filter((r) => r.id !== ruleId);
    setRules(updatedRules);
    localStorage.setItem("nullsto_forwarding_rules", JSON.stringify(updatedRules));
    toast.success("Forwarding rule deleted");
  };

  if (!user) {
    return (
      <div className="glass-card p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Sign In Required</h3>
        <p className="text-muted-foreground">
          Please sign in to use email forwarding features.
        </p>
      </div>
    );
  }

  const tempEmails = getUserTempEmails();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Forward className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Email Forwarding</h3>
            <p className="text-sm text-muted-foreground">
              Forward emails from your temp addresses to your real inbox
            </p>
          </div>
        </div>
        <Button
          variant="neon"
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={tempEmails.length === 0}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Add New Rule Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="glass-card p-6"
        >
          <h4 className="font-medium text-foreground mb-4">Create Forwarding Rule</h4>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Select Temporary Email
              </label>
              <select
                value={selectedTempEmail}
                onChange={(e) => setSelectedTempEmail(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-2 text-foreground"
              >
                <option value="">Choose an email...</option>
                {tempEmails.map((email: any) => (
                  <option key={email.id} value={email.id}>
                    {email.address}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Forward To Address
              </label>
              <Input
                type="email"
                placeholder="your-real-email@example.com"
                value={newForwardTo}
                onChange={(e) => setNewForwardTo(e.target.value)}
                className="bg-secondary/50"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="neon"
                onClick={handleAddRule}
                disabled={isAdding || !selectedTempEmail || !newForwardTo}
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Create Rule
              </Button>
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Rules List */}
      {isLoading ? (
        <div className="text-center p-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        </div>
      ) : rules.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground">
            No forwarding rules yet. Create one to start forwarding emails.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => (
            <motion.div
              key={rule.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-secondary">
                    <Forward className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-primary">{rule.temp_email_address}</span>
                      <Forward className="w-3 h-3 text-muted-foreground" />
                      <span className="text-foreground">{rule.forward_to_address}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {new Date(rule.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {rule.is_active ? "Active" : "Paused"}
                    </span>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggleRule(rule.id)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium text-foreground">How Email Forwarding Works</h4>
            <p className="text-sm text-muted-foreground mt-1">
              When enabled, any emails received at your temporary address will be automatically 
              forwarded to your specified real email address. This happens in real-time when 
              emails arrive at the temporary inbox.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailForwarding;
