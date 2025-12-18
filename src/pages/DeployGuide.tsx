import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { Server, FileCode, Terminal, CheckCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const DeployGuide = () => {
  const { isRTL } = useLanguage();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME} !-l
  RewriteRule . /index.html [L]
</IfModule>`;

  const nginxConfig = `server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}`;

  const buildSteps = [
    { step: 1, title: "Install Dependencies", command: "npm install" },
    { step: 2, title: "Build for Production", command: "npm run build" },
    { step: 3, title: "Upload Files", description: "Upload the contents of the 'dist' folder to your hosting" },
  ];

  return (
    <div className={`min-h-screen bg-background ${isRTL ? "rtl" : "ltr"}`}>
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Hero */}
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              <Server className="w-3 h-3 mr-1" />
              Deployment Guide
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Deploy to <span className="gradient-text">Shared Hosting</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Complete guide for deploying Nullsto to Apache or Nginx shared hosting without Node.js
            </p>
          </div>

          {/* Build Steps */}
          <Card className="glass border-primary/20 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-primary" />
                Build Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {buildSteps.map((item) => (
                <div key={item.step} className="flex items-start gap-4 p-4 bg-secondary/30 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    {item.command ? (
                      <div className="flex items-center gap-2">
                        <code className="bg-background px-3 py-1 rounded text-sm font-mono text-primary">
                          {item.command}
                        </code>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => copyToClipboard(item.command!)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Server Configuration */}
          <Card className="glass border-primary/20 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-primary" />
                Server Configuration (SPA Routing)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="apache" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="apache">Apache (.htaccess)</TabsTrigger>
                  <TabsTrigger value="nginx">Nginx</TabsTrigger>
                </TabsList>
                
                <TabsContent value="apache" className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Create a <code className="bg-secondary px-1 rounded">.htaccess</code> file in your web root (dist folder):
                  </p>
                  <div className="relative">
                    <pre className="bg-background p-4 rounded-lg overflow-x-auto text-sm font-mono border border-border">
                      {htaccessContent}
                    </pre>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(htaccessContent)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                    <p className="text-sm">
                      Make sure <code className="bg-secondary px-1 rounded">mod_rewrite</code> is enabled on your Apache server.
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="nginx" className="space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Add this configuration to your Nginx server block:
                  </p>
                  <div className="relative">
                    <pre className="bg-background p-4 rounded-lg overflow-x-auto text-sm font-mono border border-border">
                      {nginxConfig}
                    </pre>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(nginxConfig)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                    <p className="text-sm">
                      Remember to run <code className="bg-secondary px-1 rounded">nginx -t</code> to test and <code className="bg-secondary px-1 rounded">systemctl reload nginx</code> to apply changes.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Checklist */}
          <Card className="glass border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                Deployment Checklist
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  "Run npm run build to create production files",
                  "Upload all files from the 'dist' folder to your web root",
                  "Create .htaccess (Apache) or configure nginx.conf (Nginx)",
                  "Ensure all routes redirect to index.html for SPA routing",
                  "Test all pages and navigation links",
                  "Verify localStorage works (check browser console)",
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-primary/50 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary/50" />
                    </div>
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default DeployGuide;
