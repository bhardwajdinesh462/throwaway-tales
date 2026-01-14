import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
import { api } from "@/lib/api";
import { Newspaper, Save } from "lucide-react";

const BLOG_SETTINGS_KEY = 'trashmails_blog_settings';

interface BlogSettings {
  enabled: boolean;
  postsPerPage: number;
  allowComments: boolean;
  moderateComments: boolean;
  showAuthor: boolean;
  showDate: boolean;
  showReadTime: boolean;
  enableRss: boolean;
  defaultCategory: string;
}

const defaultSettings: BlogSettings = {
  enabled: true,
  postsPerPage: 10,
  allowComments: true,
  moderateComments: true,
  showAuthor: true,
  showDate: true,
  showReadTime: true,
  enableRss: true,
  defaultCategory: 'General',
};

const AdminBlogSettings = () => {
  const [settings, setSettings] = useState<BlogSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await api.db.query<{ value: BlogSettings }[]>('app_settings', {
          filter: { key: 'blog' },
          order: { column: 'updated_at', ascending: false },
          limit: 1
        });

        if (!error && data && data.length > 0) {
          const dbSettings = data[0].value as unknown as BlogSettings;
          setSettings({ ...defaultSettings, ...dbSettings });
        } else {
          const localSettings = storage.get<BlogSettings>(BLOG_SETTINGS_KEY, defaultSettings);
          setSettings(localSettings);
        }
      } catch (e) {
        console.error('Error loading settings:', e);
        const localSettings = storage.get<BlogSettings>(BLOG_SETTINGS_KEY, defaultSettings);
        setSettings(localSettings);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      storage.set(BLOG_SETTINGS_KEY, settings);
      
      const { data: existingData } = await api.db.query<{ id: string }[]>('app_settings', {
        filter: { key: 'blog' },
        limit: 1
      });
      const existing = existingData && existingData.length > 0 ? existingData[0] : null;

      const settingsJson = JSON.parse(JSON.stringify(settings));

      let error;
      if (existing) {
        const result = await api.db.update('app_settings', {
          value: settingsJson,
          updated_at: new Date().toISOString(),
        }, { key: 'blog' });
        error = result.error;
      } else {
        const result = await api.db.insert('app_settings', {
          key: 'blog',
          value: settingsJson,
        });
        error = result.error;
      }

      if (error) {
        console.error('Error saving to database:', error);
        toast.error('Settings saved locally but failed to sync to database');
      } else {
        toast.success("Blog settings saved!");
      }
    } catch (e) {
      console.error('Error saving settings:', e);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof BlogSettings>(key: K, value: BlogSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Newspaper className="w-8 h-8 text-primary" />
            Blog Settings
          </h1>
          <p className="text-muted-foreground">Configure your blog features</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Basic blog settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Blog</Label>
                <p className="text-sm text-muted-foreground">Show blog section on site</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) => updateSetting('enabled', checked)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postsPerPage">Posts Per Page</Label>
                <Input
                  id="postsPerPage"
                  type="number"
                  value={settings.postsPerPage}
                  onChange={(e) => updateSetting('postsPerPage', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultCategory">Default Category</Label>
                <Input
                  id="defaultCategory"
                  value={settings.defaultCategory}
                  onChange={(e) => updateSetting('defaultCategory', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comments</CardTitle>
            <CardDescription>Comment settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Comments</Label>
                <p className="text-sm text-muted-foreground">Enable comments on blog posts</p>
              </div>
              <Switch
                checked={settings.allowComments}
                onCheckedChange={(checked) => updateSetting('allowComments', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Moderate Comments</Label>
                <p className="text-sm text-muted-foreground">Require approval before publishing</p>
              </div>
              <Switch
                checked={settings.moderateComments}
                onCheckedChange={(checked) => updateSetting('moderateComments', checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Display Options</CardTitle>
            <CardDescription>What to show on blog posts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div><Label>Show Author</Label></div>
              <Switch
                checked={settings.showAuthor}
                onCheckedChange={(checked) => updateSetting('showAuthor', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div><Label>Show Date</Label></div>
              <Switch
                checked={settings.showDate}
                onCheckedChange={(checked) => updateSetting('showDate', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div><Label>Show Read Time</Label></div>
              <Switch
                checked={settings.showReadTime}
                onCheckedChange={(checked) => updateSetting('showReadTime', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div><Label>Enable RSS Feed</Label></div>
              <Switch
                checked={settings.enableRss}
                onCheckedChange={(checked) => updateSetting('enableRss', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminBlogSettings;
