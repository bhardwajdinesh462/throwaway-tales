import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, Plus, Trash2, GripVertical, Eye, EyeOff } from "lucide-react";
import LucideIconPicker, { DynamicIcon } from "@/components/admin/LucideIconPicker";
import type { 
  HeroContent, 
  FeaturesContent, 
  HowItWorksContent, 
  FAQContent, 
  CTAContent, 
  QuickTipsContent,
  HomepageSection 
} from "@/hooks/useHomepageContent";

export default function AdminHomepage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("hero");

  const { data: sections, isLoading } = useQuery({
    queryKey: ["homepage-sections-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homepage_sections")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as HomepageSection[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ sectionKey, content, isEnabled }: { sectionKey: string; content: any; isEnabled?: boolean }) => {
      const updates: any = { content, updated_at: new Date().toISOString() };
      if (isEnabled !== undefined) updates.is_enabled = isEnabled;
      
      const { error } = await supabase
        .from("homepage_sections")
        .update(updates)
        .eq("section_key", sectionKey);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homepage-sections-admin"] });
      queryClient.invalidateQueries({ queryKey: ["homepage-sections"] });
      toast.success("Section updated! Changes are live.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update section");
    },
  });

  const getSection = (key: string) => sections?.find((s) => s.section_key === key);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Homepage Content</h1>
        <p className="text-muted-foreground">
          Customize all homepage sections. Changes reflect in real-time.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="how_it_works">How It Works</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="cta">CTA</TabsTrigger>
          <TabsTrigger value="quick_tips">Quick Tips</TabsTrigger>
        </TabsList>

        <TabsContent value="hero">
          <HeroEditor 
            section={getSection("hero")} 
            onSave={(content, isEnabled) => updateMutation.mutate({ sectionKey: "hero", content, isEnabled })}
            isSaving={updateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="features">
          <FeaturesEditor 
            section={getSection("features")} 
            onSave={(content, isEnabled) => updateMutation.mutate({ sectionKey: "features", content, isEnabled })}
            isSaving={updateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="how_it_works">
          <HowItWorksEditor 
            section={getSection("how_it_works")} 
            onSave={(content, isEnabled) => updateMutation.mutate({ sectionKey: "how_it_works", content, isEnabled })}
            isSaving={updateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="faq">
          <FAQEditor 
            section={getSection("faq")} 
            onSave={(content, isEnabled) => updateMutation.mutate({ sectionKey: "faq", content, isEnabled })}
            isSaving={updateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="cta">
          <CTAEditor 
            section={getSection("cta")} 
            onSave={(content, isEnabled) => updateMutation.mutate({ sectionKey: "cta", content, isEnabled })}
            isSaving={updateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="quick_tips">
          <QuickTipsEditor 
            section={getSection("quick_tips")} 
            onSave={(content, isEnabled) => updateMutation.mutate({ sectionKey: "quick_tips", content, isEnabled })}
            isSaving={updateMutation.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Hero Editor Component
function HeroEditor({ section, onSave, isSaving }: { section?: HomepageSection; onSave: (content: HeroContent, isEnabled?: boolean) => void; isSaving: boolean }) {
  const [content, setContent] = useState<HeroContent>(section?.content || {
    badge: "",
    headline: "",
    subtitle: "",
    features: []
  });
  const [isEnabled, setIsEnabled] = useState(section?.is_enabled ?? true);

  const updateFeature = (index: number, field: keyof typeof content.features[0], value: string) => {
    const newFeatures = [...content.features];
    newFeatures[index] = { ...newFeatures[index], [field]: value };
    setContent({ ...content, features: newFeatures });
  };

  const addFeature = () => {
    setContent({
      ...content,
      features: [...content.features, { icon: "Star", label: "New Feature" }]
    });
  };

  const removeFeature = (index: number) => {
    setContent({
      ...content,
      features: content.features.filter((_, i) => i !== index)
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Hero Section</CardTitle>
          <CardDescription>Main landing section with headline and features</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="hero-enabled" className="text-sm">Enabled</Label>
          <Switch id="hero-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Badge Text</Label>
          <Input 
            value={content.badge} 
            onChange={(e) => setContent({ ...content, badge: e.target.value })}
            placeholder="e.g., Trusted by 1M+ users"
          />
        </div>

        <div className="space-y-2">
          <Label>Headline</Label>
          <Input 
            value={content.headline} 
            onChange={(e) => setContent({ ...content, headline: e.target.value })}
            placeholder="Main headline"
          />
        </div>

        <div className="space-y-2">
          <Label>Subtitle</Label>
          <Textarea 
            value={content.subtitle} 
            onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
            placeholder="Supporting text"
            rows={3}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Feature Badges</Label>
            <Button variant="outline" size="sm" onClick={addFeature}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          
          {content.features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <LucideIconPicker
                value={feature.icon}
                onChange={(icon) => updateFeature(index, "icon", icon)}
                trigger={
                  <Button variant="outline" size="icon" className="shrink-0">
                    <DynamicIcon name={feature.icon} className="w-4 h-4" />
                  </Button>
                }
              />
              <Input
                value={feature.label}
                onChange={(e) => updateFeature(index, "label", e.target.value)}
                placeholder="Feature label"
                className="flex-1"
              />
              <Button variant="ghost" size="icon" onClick={() => removeFeature(index)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={() => onSave(content, isEnabled)} disabled={isSaving} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}

// Features Editor Component
function FeaturesEditor({ section, onSave, isSaving }: { section?: HomepageSection; onSave: (content: FeaturesContent, isEnabled?: boolean) => void; isSaving: boolean }) {
  const [content, setContent] = useState<FeaturesContent>(section?.content || {
    title: "",
    subtitle: "",
    items: []
  });
  const [isEnabled, setIsEnabled] = useState(section?.is_enabled ?? true);

  const updateItem = (index: number, field: keyof typeof content.items[0], value: string) => {
    const newItems = [...content.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setContent({ ...content, items: newItems });
  };

  const addItem = () => {
    setContent({
      ...content,
      items: [...content.items, { icon: "Star", title: "New Feature", description: "Description" }]
    });
  };

  const removeItem = (index: number) => {
    setContent({
      ...content,
      items: content.items.filter((_, i) => i !== index)
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Features Section</CardTitle>
          <CardDescription>Showcase your product features</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="features-enabled" className="text-sm">Enabled</Label>
          <Switch id="features-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Section Title</Label>
            <Input 
              value={content.title} 
              onChange={(e) => setContent({ ...content, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Section Subtitle</Label>
            <Input 
              value={content.subtitle} 
              onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Feature Cards</Label>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-1" /> Add Feature
            </Button>
          </div>
          
          {content.items.map((item, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <LucideIconPicker
                  value={item.icon}
                  onChange={(icon) => updateItem(index, "icon", icon)}
                  trigger={
                    <Button variant="outline" size="icon">
                      <DynamicIcon name={item.icon} className="w-4 h-4" />
                    </Button>
                  }
                />
                <Input
                  value={item.title}
                  onChange={(e) => updateItem(index, "title", e.target.value)}
                  placeholder="Feature title"
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              <Textarea
                value={item.description}
                onChange={(e) => updateItem(index, "description", e.target.value)}
                placeholder="Feature description"
                rows={2}
              />
            </div>
          ))}
        </div>

        <Button onClick={() => onSave(content, isEnabled)} disabled={isSaving} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}

// How It Works Editor Component
function HowItWorksEditor({ section, onSave, isSaving }: { section?: HomepageSection; onSave: (content: HowItWorksContent, isEnabled?: boolean) => void; isSaving: boolean }) {
  const [content, setContent] = useState<HowItWorksContent>(section?.content || {
    title: "",
    subtitle: "",
    steps: []
  });
  const [isEnabled, setIsEnabled] = useState(section?.is_enabled ?? true);

  const updateStep = (index: number, field: keyof typeof content.steps[0], value: any) => {
    const newSteps = [...content.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setContent({ ...content, steps: newSteps });
  };

  const addStep = () => {
    setContent({
      ...content,
      steps: [...content.steps, { icon: "Star", step: content.steps.length + 1, title: "New Step", description: "Description" }]
    });
  };

  const removeStep = (index: number) => {
    const newSteps = content.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step: i + 1 }));
    setContent({ ...content, steps: newSteps });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>How It Works Section</CardTitle>
          <CardDescription>Step-by-step guide for users</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="hiw-enabled" className="text-sm">Enabled</Label>
          <Switch id="hiw-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Section Title</Label>
            <Input 
              value={content.title} 
              onChange={(e) => setContent({ ...content, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Section Subtitle</Label>
            <Input 
              value={content.subtitle} 
              onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Steps</Label>
            <Button variant="outline" size="sm" onClick={addStep}>
              <Plus className="w-4 h-4 mr-1" /> Add Step
            </Button>
          </div>
          
          {content.steps.map((step, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                  {step.step}
                </span>
                <LucideIconPicker
                  value={step.icon}
                  onChange={(icon) => updateStep(index, "icon", icon)}
                  trigger={
                    <Button variant="outline" size="icon">
                      <DynamicIcon name={step.icon} className="w-4 h-4" />
                    </Button>
                  }
                />
                <Input
                  value={step.title}
                  onChange={(e) => updateStep(index, "title", e.target.value)}
                  placeholder="Step title"
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" onClick={() => removeStep(index)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              <Textarea
                value={step.description}
                onChange={(e) => updateStep(index, "description", e.target.value)}
                placeholder="Step description"
                rows={2}
              />
            </div>
          ))}
        </div>

        <Button onClick={() => onSave(content, isEnabled)} disabled={isSaving} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}

// FAQ Editor Component
function FAQEditor({ section, onSave, isSaving }: { section?: HomepageSection; onSave: (content: FAQContent, isEnabled?: boolean) => void; isSaving: boolean }) {
  const [content, setContent] = useState<FAQContent>(section?.content || {
    title: "",
    subtitle: "",
    items: []
  });
  const [isEnabled, setIsEnabled] = useState(section?.is_enabled ?? true);

  const updateItem = (index: number, field: keyof typeof content.items[0], value: string) => {
    const newItems = [...content.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setContent({ ...content, items: newItems });
  };

  const addItem = () => {
    setContent({
      ...content,
      items: [...content.items, { question: "New Question?", answer: "Answer here..." }]
    });
  };

  const removeItem = (index: number) => {
    setContent({
      ...content,
      items: content.items.filter((_, i) => i !== index)
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>FAQ Section</CardTitle>
          <CardDescription>Frequently asked questions</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="faq-enabled" className="text-sm">Enabled</Label>
          <Switch id="faq-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Section Title</Label>
            <Input 
              value={content.title} 
              onChange={(e) => setContent({ ...content, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Section Subtitle</Label>
            <Input 
              value={content.subtitle} 
              onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>FAQ Items</Label>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-1" /> Add FAQ
            </Button>
          </div>
          
          {content.items.map((item, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={item.question}
                  onChange={(e) => updateItem(index, "question", e.target.value)}
                  placeholder="Question"
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              <Textarea
                value={item.answer}
                onChange={(e) => updateItem(index, "answer", e.target.value)}
                placeholder="Answer"
                rows={3}
              />
            </div>
          ))}
        </div>

        <Button onClick={() => onSave(content, isEnabled)} disabled={isSaving} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}

// CTA Editor Component
function CTAEditor({ section, onSave, isSaving }: { section?: HomepageSection; onSave: (content: CTAContent, isEnabled?: boolean) => void; isSaving: boolean }) {
  const [content, setContent] = useState<CTAContent>(section?.content || {
    headline: "",
    subtitle: "",
    primaryButton: { text: "", link: "" },
    secondaryButton: { text: "", link: "" },
    footerText: ""
  });
  const [isEnabled, setIsEnabled] = useState(section?.is_enabled ?? true);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Call-to-Action Section</CardTitle>
          <CardDescription>Final conversion section</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="cta-enabled" className="text-sm">Enabled</Label>
          <Switch id="cta-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Headline</Label>
          <Input 
            value={content.headline} 
            onChange={(e) => setContent({ ...content, headline: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Subtitle</Label>
          <Textarea 
            value={content.subtitle} 
            onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3 p-4 border rounded-lg">
            <Label className="font-semibold">Primary Button</Label>
            <div className="space-y-2">
              <Label className="text-sm">Text</Label>
              <Input 
                value={content.primaryButton.text} 
                onChange={(e) => setContent({ ...content, primaryButton: { ...content.primaryButton, text: e.target.value }})}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Link</Label>
              <Input 
                value={content.primaryButton.link} 
                onChange={(e) => setContent({ ...content, primaryButton: { ...content.primaryButton, link: e.target.value }})}
              />
            </div>
          </div>

          <div className="space-y-3 p-4 border rounded-lg">
            <Label className="font-semibold">Secondary Button</Label>
            <div className="space-y-2">
              <Label className="text-sm">Text</Label>
              <Input 
                value={content.secondaryButton.text} 
                onChange={(e) => setContent({ ...content, secondaryButton: { ...content.secondaryButton, text: e.target.value }})}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Link</Label>
              <Input 
                value={content.secondaryButton.link} 
                onChange={(e) => setContent({ ...content, secondaryButton: { ...content.secondaryButton, link: e.target.value }})}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Footer Text</Label>
          <Input 
            value={content.footerText} 
            onChange={(e) => setContent({ ...content, footerText: e.target.value })}
          />
        </div>

        <Button onClick={() => onSave(content, isEnabled)} disabled={isSaving} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}

// Quick Tips Editor Component
function QuickTipsEditor({ section, onSave, isSaving }: { section?: HomepageSection; onSave: (content: QuickTipsContent, isEnabled?: boolean) => void; isSaving: boolean }) {
  const [content, setContent] = useState<QuickTipsContent>(section?.content || {
    title: "",
    tips: []
  });
  const [isEnabled, setIsEnabled] = useState(section?.is_enabled ?? true);

  const updateTip = (index: number, value: string) => {
    const newTips = [...content.tips];
    newTips[index] = value;
    setContent({ ...content, tips: newTips });
  };

  const addTip = () => {
    setContent({ ...content, tips: [...content.tips, "New tip..."] });
  };

  const removeTip = (index: number) => {
    setContent({ ...content, tips: content.tips.filter((_, i) => i !== index) });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Quick Tips Widget</CardTitle>
          <CardDescription>Helpful tips shown on homepage</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="tips-enabled" className="text-sm">Enabled</Label>
          <Switch id="tips-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Widget Title</Label>
          <Input 
            value={content.title} 
            onChange={(e) => setContent({ ...content, title: e.target.value })}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Tips</Label>
            <Button variant="outline" size="sm" onClick={addTip}>
              <Plus className="w-4 h-4 mr-1" /> Add Tip
            </Button>
          </div>
          
          {content.tips.map((tip, index) => (
            <div key={index} className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <Input
                value={tip}
                onChange={(e) => updateTip(index, e.target.value)}
                className="flex-1"
              />
              <Button variant="ghost" size="icon" onClick={() => removeTip(index)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={() => onSave(content, isEnabled)} disabled={isSaving} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
