import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Ban, 
  Plus, 
  Trash2, 
  Loader2,
  Hash,
  Type,
  Save,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useAuth } from "@/hooks/useSupabaseAuth";

interface EmailRestriction {
  id: string;
  restriction_type: string;
  value: string;
  is_active: boolean;
  created_at: string;
}

const AdminEmailRestrictions = () => {
  const { user } = useAuth();
  const [restrictions, setRestrictions] = useState<EmailRestriction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newBlockedWord, setNewBlockedWord] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [minCharacters, setMinCharacters] = useState("");
  const [isSavingMinChars, setIsSavingMinChars] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRestrictions();
  }, []);

  const fetchRestrictions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_restrictions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRestrictions(data || []);
      
      // Get min characters setting
      const minCharsSetting = data?.find(r => r.restriction_type === 'min_characters' && r.is_active);
      if (minCharsSetting) {
        setMinCharacters(minCharsSetting.value);
      }
    } catch (error: any) {
      console.error("Error fetching restrictions:", error);
      toast.error(error.message || "Failed to load restrictions");
    } finally {
      setIsLoading(false);
    }
  };

  const addBlockedWord = async () => {
    if (!newBlockedWord.trim()) {
      toast.error("Please enter a word to block");
      return;
    }

    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    // Check if word already exists
    if (restrictions.some(r => r.restriction_type === 'blocked_word' && r.value.toLowerCase() === newBlockedWord.toLowerCase())) {
      toast.error("This word is already blocked");
      return;
    }

    setIsAdding(true);
    try {
      const { error } = await supabase
        .from('email_restrictions')
        .insert({
          restriction_type: 'blocked_word',
          value: newBlockedWord.trim().toLowerCase(),
          created_by: user.id
        });

      if (error) throw error;

      toast.success(`"${newBlockedWord}" added to blocked words`);
      setNewBlockedWord("");
      fetchRestrictions();
    } catch (error: any) {
      console.error("Error adding blocked word:", error);
      toast.error(error.message || "Failed to add blocked word");
    } finally {
      setIsAdding(false);
    }
  };

  const saveMinCharacters = async () => {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    const minCharsValue = parseInt(minCharacters);
    if (minCharacters && (isNaN(minCharsValue) || minCharsValue < 1 || minCharsValue > 50)) {
      toast.error("Minimum characters must be between 1 and 50");
      return;
    }

    setIsSavingMinChars(true);
    try {
      // Delete existing min_characters settings
      await supabase
        .from('email_restrictions')
        .delete()
        .eq('restriction_type', 'min_characters');

      // Insert new setting if value is provided
      if (minCharacters && minCharsValue > 0) {
        const { error } = await supabase
          .from('email_restrictions')
          .insert({
            restriction_type: 'min_characters',
            value: minCharsValue.toString(),
            created_by: user.id
          });

        if (error) throw error;
      }

      toast.success("Minimum character requirement saved");
      fetchRestrictions();
    } catch (error: any) {
      console.error("Error saving min characters:", error);
      toast.error(error.message || "Failed to save setting");
    } finally {
      setIsSavingMinChars(false);
    }
  };

  const toggleRestriction = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('email_restrictions')
        .update({ is_active: !currentState, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setRestrictions(restrictions.map(r => 
        r.id === id ? { ...r, is_active: !currentState } : r
      ));
      toast.success(`Restriction ${!currentState ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      console.error("Error toggling restriction:", error);
      toast.error(error.message || "Failed to update restriction");
    }
  };

  const deleteRestriction = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('email_restrictions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setRestrictions(restrictions.filter(r => r.id !== id));
      toast.success("Restriction deleted");
    } catch (error: any) {
      console.error("Error deleting restriction:", error);
      toast.error(error.message || "Failed to delete restriction");
    } finally {
      setDeletingId(null);
    }
  };

  const blockedWords = restrictions.filter(r => r.restriction_type === 'blocked_word');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Ban className="w-8 h-8 text-primary" />
            Email Restrictions
          </h1>
          <p className="text-muted-foreground">Block specific words and set minimum character requirements for emails</p>
        </div>
      </div>

      {/* Minimum Characters Setting */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-primary" />
            Minimum Characters
          </CardTitle>
          <CardDescription>
            Set the minimum number of characters required for email prefixes (before @)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label htmlFor="minChars">Minimum Characters</Label>
              <Input
                id="minChars"
                type="number"
                min="1"
                max="50"
                placeholder="e.g., 5"
                value={minCharacters}
                onChange={(e) => setMinCharacters(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to disable this restriction
              </p>
            </div>
            <Button onClick={saveMinCharacters} disabled={isSavingMinChars}>
              {isSavingMinChars ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Blocked Words */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="w-5 h-5 text-primary" />
            Blocked Words
          </CardTitle>
          <CardDescription>
            Prevent users from creating emails containing these words
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add New Blocked Word */}
          <div className="flex items-end gap-4">
            <div className="space-y-2 flex-1 max-w-md">
              <Label htmlFor="blockedWord">Add Blocked Word</Label>
              <Input
                id="blockedWord"
                placeholder="Enter word to block..."
                value={newBlockedWord}
                onChange={(e) => setNewBlockedWord(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addBlockedWord()}
              />
            </div>
            <Button onClick={addBlockedWord} disabled={isAdding}>
              {isAdding ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add Word
            </Button>
          </div>

          {/* Blocked Words List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : blockedWords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No blocked words configured</p>
              <p className="text-sm">Add words above to prevent them from being used in email addresses</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead>Word</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedWords.map((restriction) => (
                    <TableRow key={restriction.id} className="hover:bg-secondary/20">
                      <TableCell>
                        <Badge variant="destructive" className="font-mono">
                          {restriction.value}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={restriction.is_active}
                            onCheckedChange={() => toggleRestriction(restriction.id, restriction.is_active)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {restriction.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(restriction.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive"
                              disabled={deletingId === restriction.id}
                            >
                              {deletingId === restriction.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Blocked Word</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove "{restriction.value}" from the blocked words list?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => deleteRestriction(restriction.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {blockedWords.length > 0 && (
            <p className="text-sm text-muted-foreground">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Users cannot create email addresses containing any of these blocked words
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminEmailRestrictions;