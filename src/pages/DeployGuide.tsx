import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Server, FileCode, Terminal, CheckCircle, Copy, Upload, 
  FolderOpen, Settings, Database, Shield, Image, Layout
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
</IfModule>

# Enable GZIP compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
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

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}`;

  return (
    <div className={`min-h-screen bg-background ${isRTL ? "rtl" : "ltr"}`}>
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Hero */}
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              <Server className="w-3 h-3 mr-1" />
              Complete Deployment Guide
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Deploy to <span className="gradient-text">Shared Hosting</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Step-by-step guide for deploying Nullsto to any shared hosting without Node.js
            </p>
          </div>

          <Tabs defaultValue="deploy" className="space-y-8">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="deploy">Deployment</TabsTrigger>
              <TabsTrigger value="upload">File Upload</TabsTrigger>
              <TabsTrigger value="admin">Admin Setup</TabsTrigger>
              <TabsTrigger value="customize">Customization</TabsTrigger>
            </TabsList>

            {/* Deployment Tab */}
            <TabsContent value="deploy" className="space-y-6">
              {/* Build Steps */}
              <Card className="glass border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-primary" />
                    Build Steps (Local Development)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { step: 1, title: "Install Dependencies", command: "npm install", desc: "Run once to install required packages" },
                    { step: 2, title: "Build for Production", command: "npm run build", desc: "Creates optimized files in 'dist' folder" },
                    { step: 3, title: "Upload Files", desc: "Upload the contents of 'dist' folder to your hosting" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-4 p-4 bg-secondary/30 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                        {item.step}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{item.title}</h3>
                        {item.command ? (
                          <div className="flex items-center gap-2 mb-1">
                            <code className="bg-background px-3 py-1 rounded text-sm font-mono text-primary">
                              {item.command}
                            </code>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(item.command!)}>
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : null}
                        <p className="text-muted-foreground text-sm">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Server Configuration */}
              <Card className="glass border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-primary" />
                    Server Configuration
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
                        Create a <code className="bg-secondary px-1 rounded">.htaccess</code> file in your web root:
                      </p>
                      <div className="relative">
                        <pre className="bg-background p-4 rounded-lg overflow-x-auto text-sm font-mono border border-border max-h-64">
                          {htaccessContent}
                        </pre>
                        <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={() => copyToClipboard(htaccessContent)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="nginx" className="space-y-4">
                      <p className="text-muted-foreground text-sm">
                        Add this configuration to your Nginx server block:
                      </p>
                      <div className="relative">
                        <pre className="bg-background p-4 rounded-lg overflow-x-auto text-sm font-mono border border-border max-h-64">
                          {nginxConfig}
                        </pre>
                        <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={() => copyToClipboard(nginxConfig)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>

            {/* File Upload Tab */}
            <TabsContent value="upload" className="space-y-6">
              <Card className="glass border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-primary" />
                    Manual File Upload Guide
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="space-y-2">
                    <AccordionItem value="cpanel" className="bg-secondary/30 rounded-lg border-none">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <FolderOpen className="w-5 h-5 text-primary" />
                          <span>cPanel File Manager</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
                          <li><strong>Login to cPanel</strong> - Go to yourdomain.com/cpanel</li>
                          <li><strong>Open File Manager</strong> - Under "Files" section</li>
                          <li><strong>Navigate to public_html</strong> - This is your web root</li>
                          <li><strong>Delete existing files</strong> (if any) - Keep .htaccess if present</li>
                          <li><strong>Click "Upload"</strong> - In the top toolbar</li>
                          <li><strong>Upload dist folder contents</strong>:
                            <ul className="list-disc list-inside ml-4 mt-2">
                              <li>index.html (main file)</li>
                              <li>assets/ folder (JS, CSS, images)</li>
                              <li>favicon.ico</li>
                              <li>Any other files in dist/</li>
                            </ul>
                          </li>
                          <li><strong>Create .htaccess</strong> - If not exists, create new file and paste the Apache config</li>
                          <li><strong>Set permissions</strong> - Files: 644, Folders: 755</li>
                        </ol>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="ftp" className="bg-secondary/30 rounded-lg border-none">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <Server className="w-5 h-5 text-primary" />
                          <span>FTP Upload (FileZilla)</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
                          <li><strong>Get FTP credentials</strong> from your hosting control panel</li>
                          <li><strong>Open FileZilla</strong> and enter:
                            <ul className="list-disc list-inside ml-4 mt-2">
                              <li>Host: ftp.yourdomain.com (or IP address)</li>
                              <li>Username: Your FTP username</li>
                              <li>Password: Your FTP password</li>
                              <li>Port: 21 (or as specified)</li>
                            </ul>
                          </li>
                          <li><strong>Navigate to /public_html</strong> on the server (right panel)</li>
                          <li><strong>Navigate to dist/</strong> folder locally (left panel)</li>
                          <li><strong>Select all files</strong> in dist/ and drag to server</li>
                          <li><strong>Wait for upload</strong> to complete</li>
                          <li><strong>Upload .htaccess</strong> separately (enable "Show hidden files")</li>
                        </ol>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="structure" className="bg-secondary/30 rounded-lg border-none">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <FolderOpen className="w-5 h-5 text-primary" />
                          <span>Expected File Structure</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <pre className="bg-background p-4 rounded-lg text-sm font-mono">
{`public_html/
├── index.html          (main entry point)
├── .htaccess           (server config)
├── favicon.ico
├── robots.txt
├── sitemap.xml
├── sw.js               (service worker)
├── og-image.png
└── assets/
    ├── index-[hash].js
    ├── index-[hash].css
    └── [other assets...]`}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Admin Setup Tab */}
            <TabsContent value="admin" className="space-y-6">
              <Card className="glass border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Admin Panel Setup
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="space-y-2">
                    <AccordionItem value="access" className="bg-secondary/30 rounded-lg border-none">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        How to Access Admin Panel
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                          <li>Go to <code className="bg-secondary px-2 py-1 rounded">/auth</code> to sign up/login</li>
                          <li>After login, click your profile avatar in the header</li>
                          <li>Select "Admin Panel" from the dropdown</li>
                          <li>Or go directly to <code className="bg-secondary px-2 py-1 rounded">/admin</code></li>
                        </ol>
                        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                          <p className="text-sm text-yellow-500">
                            <strong>Note:</strong> On shared hosting with localStorage, the first user who signs up 
                            is automatically set as admin. For production with Supabase, use the database role system.
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="features" className="bg-secondary/30 rounded-lg border-none">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        Admin Features Overview
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { icon: Layout, title: "Dashboard", desc: "Overview of stats" },
                            { icon: Settings, title: "General Settings", desc: "Site configuration" },
                            { icon: Image, title: "Banner Management", desc: "Ad placements" },
                            { icon: Database, title: "Domain Management", desc: "Email domains" },
                            { icon: Shield, title: "User Management", desc: "Manage users" },
                            { icon: FileCode, title: "SEO Settings", desc: "Meta tags & SEO" },
                          ].map((item, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                              <item.icon className="w-5 h-5 text-primary mt-0.5" />
                              <div>
                                <p className="font-medium text-foreground text-sm">{item.title}</p>
                                <p className="text-xs text-muted-foreground">{item.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="banners" className="bg-secondary/30 rounded-lg border-none">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        Managing Banners & Ads
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <p className="text-muted-foreground mb-4">
                          Banners can be placed in 4 locations:
                        </p>
                        <ul className="space-y-2 text-muted-foreground mb-4">
                          <li>• <strong>Header</strong> - Top of page, below navigation</li>
                          <li>• <strong>Sidebar</strong> - Right side of inbox</li>
                          <li>• <strong>Content</strong> - Between page sections</li>
                          <li>• <strong>Footer</strong> - Bottom of page, above footer</li>
                        </ul>
                        <p className="text-muted-foreground mb-2">Banner types supported:</p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• <strong>Image</strong> - Upload or URL</li>
                          <li>• <strong>HTML</strong> - Custom HTML code</li>
                          <li>• <strong>Script</strong> - AdSense, affiliate codes</li>
                          <li>• <strong>Text</strong> - Simple text promotions</li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Customization Tab */}
            <TabsContent value="customize" className="space-y-6">
              <Card className="glass border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Customization Guide
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="space-y-2">
                    <AccordionItem value="branding" className="bg-secondary/30 rounded-lg border-none">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        Change Logo & Branding
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <p className="text-muted-foreground mb-3">
                          Edit these files to change branding:
                        </p>
                        <ul className="space-y-2 text-muted-foreground">
                          <li>• <code className="bg-secondary px-2 py-1 rounded">src/components/Header.tsx</code> - Logo in header</li>
                          <li>• <code className="bg-secondary px-2 py-1 rounded">src/components/Footer.tsx</code> - Logo in footer</li>
                          <li>• <code className="bg-secondary px-2 py-1 rounded">index.html</code> - Page title & meta tags</li>
                          <li>• <code className="bg-secondary px-2 py-1 rounded">public/favicon.ico</code> - Browser icon</li>
                        </ul>
                        <p className="text-sm text-primary mt-4">
                          Search for "Nullsto" in code and replace with your brand name.
                        </p>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="colors" className="bg-secondary/30 rounded-lg border-none">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        Change Colors & Theme
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <p className="text-muted-foreground mb-3">
                          Edit <code className="bg-secondary px-2 py-1 rounded">src/index.css</code>:
                        </p>
                        <pre className="bg-background p-4 rounded-lg text-sm font-mono overflow-x-auto">
{`:root {
  --primary: 160 84% 39%;    /* Main brand color */
  --accent: 280 84% 60%;     /* Accent color */
  --background: 220 20% 4%;  /* Background */
  --foreground: 0 0% 98%;    /* Text color */
}`}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="domains" className="bg-secondary/30 rounded-lg border-none">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        Configure Email Domains
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <p className="text-muted-foreground mb-3">
                          Edit <code className="bg-secondary px-2 py-1 rounded">src/lib/storage.ts</code> to change default domains:
                        </p>
                        <pre className="bg-background p-4 rounded-lg text-sm font-mono overflow-x-auto">
{`const defaultDomains = [
  { name: "@yourmail.com", is_premium: false },
  { name: "@premium.com", is_premium: true },
];`}
                        </pre>
                        <p className="text-sm text-muted-foreground mt-3">
                          Or manage domains via Admin Panel → Domains
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Checklist */}
          <Card className="glass border-primary/20 mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                Final Checklist
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  "Build completed (npm run build)",
                  "All dist/ files uploaded to web root",
                  ".htaccess created with SPA routing config",
                  "All pages load without 404 errors",
                  "Admin panel accessible at /admin",
                  "Banner management working",
                  "Custom email creation tested",
                  "localStorage working (check browser console)",
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
