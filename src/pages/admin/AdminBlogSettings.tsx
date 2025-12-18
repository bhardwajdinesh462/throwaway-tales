import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { storage } from "@/lib/storage";
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
  const [settings, setSettings] = useState<BlogSettings>(() =>
    storage.get(BLOG_SETTINGS_KEY, defaultSettings)
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    storage.set(BLOG_SETTINGS_KEY, settings);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Blog settings saved!");
    }, 500);
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
