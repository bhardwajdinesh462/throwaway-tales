import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Forward, Mail, Trash2, Plus, Check, X, Loader2, 
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

interface ForwardingRule {
  id: string;
  temp_email_id: string;
  forward_to_address: string;
  is_active: boolean;
  created_at: string;
  temp_email_address?: string;
}

interface TempEmail {
  id: string;
  address: string;
}

const emailSchema = z.string().email("Please enter a valid email address");

const EmailForwarding = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<ForwardingRule[]>([]);
  const [tempEmails, setTempEmails] = useState<TempEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newForwardTo, setNewForwardTo] = useState("");
  const [selectedTempEmail, setSelectedTempEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Load forwarding rules and temp emails from database
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch user's temp emails
        const { data: tempEmailsData, error: tempError } = await supabase
          .from("temp_emails")
          .select("id, address")
          .eq("user_id", user.id)
          .eq("is_active", true);

        if (tempError) {
          console.error("Error fetching temp emails:", tempError);
        } else {
          setTempEmails(tempEmailsData || []);
        }

        // Fetch forwarding rules
        const { data: rulesData, error: rulesError } = await supabase
          .from("email_forwarding")
          .select(`
            id,
            temp_email_id,
            forward_to_address,
            is_active,
            created_at
          `)
          .eq("user_id", user.id);

        if (rulesError) {
          console.error("Error fetching forwarding rules:", rulesError);
        } else {
          // Map rules with temp email addresses
          const rulesWithAddresses = (rulesData || []).map(rule => {
            const tempEmail = tempEmailsData?.find(te => te.id === rule.temp_email_id);
            return {
              ...rule,
              temp_email_address: tempEmail?.address || "Unknown address"
            };
          });
          setRules(rulesWithAddresses);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast.error("Failed to load forwarding rules");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

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

    try {
      const { data, error } = await supabase
        .from("email_forwarding")
        .insert({
          temp_email_id: selectedTempEmail,
          forward_to_address: newForwardTo,
          user_id: user.id,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("A forwarding rule already exists for this email");
        } else {
          throw error;
        }
        return;
      }

      const tempEmail = tempEmails.find(te => te.id === selectedTempEmail);
      const newRule: ForwardingRule = {
        ...data,
        temp_email_address: tempEmail?.address || "Unknown address"
      };

      setRules(prev => [...prev, newRule]);
      setNewForwardTo("");
      setSelectedTempEmail("");
      setShowAddForm(false);
      toast.success("Forwarding rule created!");
    } catch (error) {
      console.error("Error creating rule:", error);
      toast.error("Failed to create forwarding rule");
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleRule = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    try {
      const { error } = await supabase
        .from("email_forwarding")
        .update({ is_active: !rule.is_active })
        .eq("id", ruleId);

      if (error) throw error;

      setRules(prev => prev.map(r =>
        r.id === ruleId ? { ...r, is_active: !r.is_active } : r
      ));
      toast.success("Forwarding rule updated");
    } catch (error) {
      console.error("Error toggling rule:", error);
      toast.error("Failed to update rule");
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from("email_forwarding")
        .delete()
        .eq("id", ruleId);

      if (error) throw error;

      setRules(prev => prev.filter(r => r.id !== ruleId));
      toast.success("Forwarding rule deleted");
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error("Failed to delete rule");
    }
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

      {tempEmails.length === 0 && !isLoading && (
        <div className="bg-secondary/50 border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground text-center">
            You need to create a temporary email first before setting up forwarding.
          </p>
        </div>
      )}

      {/* Add New Rule Form */}
      {showAddForm && tempEmails.length > 0 && (
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
                {tempEmails.map((email) => (
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