import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { storage, generateId } from "@/lib/storage";
import { Languages, Plus, Trash2, Save, Check } from "lucide-react";
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

interface Language {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
  enabled: boolean;
  isDefault: boolean;
}

const LANGUAGES_KEY = 'trashmails_languages';

const defaultLanguages: Language[] = [
  { id: '1', code: 'en', name: 'English', nativeName: 'English', rtl: false, enabled: true, isDefault: true },
  { id: '2', code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true, enabled: true, isDefault: false },
  { id: '3', code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false, enabled: true, isDefault: false },
  { id: '4', code: 'fr', name: 'French', nativeName: 'Français', rtl: false, enabled: true, isDefault: false },
];

const AdminLanguages = () => {
  const [languages, setLanguages] = useState<Language[]>(() =>
    storage.get(LANGUAGES_KEY, defaultLanguages)
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLang, setNewLang] = useState({ code: '', name: '', nativeName: '', rtl: false });

  const saveLanguages = (updated: Language[]) => {
    storage.set(LANGUAGES_KEY, updated);
    setLanguages(updated);
  };

  const addLanguage = () => {
    if (!newLang.code || !newLang.name) {
      toast.error("Please fill required fields");
      return;
    }
    if (languages.find(l => l.code === newLang.code)) {
      toast.error("Language code already exists");
      return;
    }
    saveLanguages([...languages, { 
      id: generateId(), 
      ...newLang, 
      enabled: true, 
      isDefault: false 
    }]);
    setNewLang({ code: '', name: '', nativeName: '', rtl: false });
    setIsDialogOpen(false);
    toast.success("Language added!");
  };

  const toggleLanguage = (id: string) => {
    saveLanguages(languages.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l));
  };

  const setDefault = (id: string) => {
    saveLanguages(languages.map(l => ({ ...l, isDefault: l.id === id })));
    toast.success("Default language updated");
  };

  const deleteLanguage = (id: string) => {
    const lang = languages.find(l => l.id === id);
    if (lang?.isDefault) {
      toast.error("Cannot delete default language");
      return;
    }
    saveLanguages(languages.filter(l => l.id !== id));
    toast.success("Language deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Languages className="w-8 h-8 text-primary" />
            Languages
          </h1>
          <p className="text-muted-foreground">Manage site languages and translations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Language</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Language</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Language Code</Label>
                  <Input
                    placeholder="en, ar, es..."
                    value={newLang.code}
                    onChange={(e) => setNewLang({ ...newLang, code: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder="English"
                    value={newLang.name}
                    onChange={(e) => setNewLang({ ...newLang, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Native Name</Label>
                <Input
                  placeholder="English, العربية..."
                  value={newLang.nativeName}
                  onChange={(e) => setNewLang({ ...newLang, nativeName: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newLang.rtl}
                  onCheckedChange={(checked) => setNewLang({ ...newLang, rtl: checked })}
                />
                <Label>Right-to-Left (RTL)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={addLanguage}>Add Language</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Languages</CardTitle>
          <CardDescription>{languages.filter(l => l.enabled).length} of {languages.length} enabled</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Native Name</TableHead>
                <TableHead>RTL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {languages.map((lang) => (
                <TableRow key={lang.id}>
                  <TableCell className="font-mono">{lang.code}</TableCell>
                  <TableCell className="font-medium">{lang.name}</TableCell>
                  <TableCell>{lang.nativeName}</TableCell>
                  <TableCell>{lang.rtl ? <Check className="w-4 h-4 text-green-500" /> : '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {lang.isDefault && <Badge className="bg-primary/20 text-primary">Default</Badge>}
                      <Badge className={lang.enabled ? "bg-green-500/20 text-green-500" : "bg-gray-500/20 text-gray-500"}>
                        {lang.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Switch checked={lang.enabled} onCheckedChange={() => toggleLanguage(lang.id)} />
                      {!lang.isDefault && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setDefault(lang.id)}>Set Default</Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteLanguage(lang.id)} className="text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLanguages;
