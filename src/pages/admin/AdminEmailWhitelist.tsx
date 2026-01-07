import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X, Mail, Shield, Info, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Default trusted domains that come with the app
const DEFAULT_TRUSTED_DOMAINS = [
  // Google
  'gmail.com', 'googlemail.com',
  // Microsoft
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.co.uk', 'outlook.in',
  // Apple
  'icloud.com', 'me.com', 'mac.com',
  // ProtonMail
  'protonmail.com', 'proton.me', 'pm.me',
  // Yahoo
  'yahoo.com', 'yahoo.co.uk', 'yahoo.in', 'ymail.com', 'rocketmail.com',
  // Rediffmail (India)
  'rediffmail.com', 'rediff.com',
  // Zoho
  'zoho.com', 'zohomail.com',
  // AOL
  'aol.com', 'aim.com',
  // GMX
  'gmx.com', 'gmx.net', 'gmx.de',
  // Mail.com
  'mail.com', 'email.com',
  // Fastmail
  'fastmail.com', 'fastmail.fm',
  // Tutanota
  'tutanota.com', 'tutamail.com', 'tuta.io',
  // Yandex
  'yandex.com', 'yandex.ru',
  // Other trusted providers
  'hey.com', 'posteo.de', 'mailbox.org', 'mailfence.com',
];

const AdminEmailWhitelist = () => {
  const [customDomains, setCustomDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [enableWhitelist, setEnableWhitelist] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "trusted_email_domains")
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data?.value) {
        const settings = data.value as { enabled: boolean; customDomains: string[] };
        setEnableWhitelist(settings.enabled ?? true);
        setCustomDomains(settings.customDomains || []);
      }
    } catch (error) {
      console.error("Error fetching email whitelist settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "trusted_email_domains",
          value: {
            enabled: enableWhitelist,
            customDomains: customDomains,
          },
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "key",
        });

      if (error) throw error;
      toast.success("Email whitelist settings saved!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const addDomain = () => {
    const domain = newDomain.toLowerCase().trim();
    
    if (!domain) {
      toast.error("Please enter a domain");
      return;
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      toast.error("Invalid domain format. Example: example.com");
      return;
    }

    if (DEFAULT_TRUSTED_DOMAINS.includes(domain)) {
      toast.error("This domain is already in the default list");
      return;
    }

    if (customDomains.includes(domain)) {
      toast.error("This domain is already added");
      return;
    }

    setCustomDomains([...customDomains, domain]);
    setNewDomain("");
    toast.success(`Added ${domain} to whitelist`);
  };

  const removeDomain = (domain: string) => {
    setCustomDomains(customDomains.filter(d => d !== domain));
    toast.success(`Removed ${domain} from whitelist`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Email Domain Whitelist</h1>
        <p className="text-muted-foreground mt-1">
          Manage trusted email providers for user registration
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Only users with email addresses from whitelisted domains can create accounts. 
          This helps prevent spam registrations from temporary email services.
        </AlertDescription>
      </Alert>

      {/* Enable/Disable Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Whitelist Protection
          </CardTitle>
          <CardDescription>
            Enable or disable email domain validation during signup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Domain Validation</p>
              <p className="text-sm text-muted-foreground">
                {enableWhitelist 
                  ? "Only trusted email domains are allowed for registration" 
                  : "Any email domain can be used for registration"}
              </p>
            </div>
            <Button
              variant={enableWhitelist ? "default" : "outline"}
              onClick={() => setEnableWhitelist(!enableWhitelist)}
            >
              {enableWhitelist ? "Enabled" : "Disabled"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Default Trusted Domains */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Default Trusted Domains
          </CardTitle>
          <CardDescription>
            These email domains are trusted by default and cannot be removed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_TRUSTED_DOMAINS.map(domain => (
              <Badge key={domain} variant="secondary" className="text-xs">
                {domain}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Domains */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Custom Trusted Domains
          </CardTitle>
          <CardDescription>
            Add additional email domains that should be allowed for registration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="new-domain" className="sr-only">New Domain</Label>
              <Input
                id="new-domain"
                placeholder="example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addDomain()}
              />
            </div>
            <Button onClick={addDomain}>
              <Plus className="w-4 h-4 mr-2" />
              Add Domain
            </Button>
          </div>

          {customDomains.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {customDomains.map(domain => (
                <Badge 
                  key={domain} 
                  variant="outline" 
                  className="text-xs pr-1 flex items-center gap-1"
                >
                  {domain}
                  <button
                    onClick={() => removeDomain(domain)}
                    className="ml-1 p-0.5 hover:bg-destructive/20 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No custom domains added yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default AdminEmailWhitelist;

