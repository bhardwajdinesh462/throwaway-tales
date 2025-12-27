import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Server, 
  Cloud, 
  HardDrive, 
  Terminal, 
  Copy, 
  Check, 
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Database,
  Mail,
  Shield,
  Zap,
  Settings,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";

const CodeBlock = ({ code, language = "bash" }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-secondary/50 border border-border rounded-lg p-4 overflow-x-auto text-sm font-mono">
        <code className="text-foreground">{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  );
};

const StepCard = ({ step, title, children }: { step: number; title: string; children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="relative pl-8 pb-8 border-l-2 border-primary/30 last:border-transparent"
  >
    <div className="absolute -left-4 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
      {step}
    </div>
    <div className="ml-4">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <div className="space-y-4 text-muted-foreground">{children}</div>
    </div>
  </motion.div>
);

const HostingGuide = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Self-Hosting Guide | Nullsto" 
        description="Complete guide to self-host Nullsto temporary email service on your own server, VPS, or cloud platform."
      />
      <Header />
      
      <div className="h-[104px]" />

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Self-Hosting <span className="gradient-text">Guide</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Deploy Nullsto on your own infrastructure. Complete control, full privacy.
          </p>
        </motion.div>

        {/* Prerequisites */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Prerequisites
            </CardTitle>
            <CardDescription>What you'll need before starting</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border border-border bg-secondary/20">
                <Database className="w-8 h-8 text-primary mb-2" />
                <h4 className="font-semibold">Supabase Account</h4>
                <p className="text-sm text-muted-foreground">Free tier works for testing</p>
              </div>
              <div className="p-4 rounded-lg border border-border bg-secondary/20">
                <Mail className="w-8 h-8 text-primary mb-2" />
                <h4 className="font-semibold">IMAP/SMTP Server</h4>
                <p className="text-sm text-muted-foreground">Your email server credentials</p>
              </div>
              <div className="p-4 rounded-lg border border-border bg-secondary/20">
                <Globe className="w-8 h-8 text-primary mb-2" />
                <h4 className="font-semibold">Domain Name</h4>
                <p className="text-sm text-muted-foreground">For receiving emails</p>
              </div>
              <div className="p-4 rounded-lg border border-border bg-secondary/20">
                <Shield className="w-8 h-8 text-primary mb-2" />
                <h4 className="font-semibold">SSL Certificate</h4>
                <p className="text-sm text-muted-foreground">Let's Encrypt (free)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hosting Options Tabs */}
        <Tabs defaultValue="vps" className="mb-12">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-8">
            <TabsTrigger value="vps" className="gap-2">
              <Server className="w-4 h-4" />
              VPS / Dedicated
            </TabsTrigger>
            <TabsTrigger value="cpanel" className="gap-2">
              <HardDrive className="w-4 h-4" />
              cPanel
            </TabsTrigger>
            <TabsTrigger value="cloud" className="gap-2">
              <Cloud className="w-4 h-4" />
              Cloud (AWS/GCP)
            </TabsTrigger>
            <TabsTrigger value="docker" className="gap-2">
              <Terminal className="w-4 h-4" />
              Docker
            </TabsTrigger>
          </TabsList>

          {/* VPS / Dedicated Server */}
          <TabsContent value="vps">
            <Card>
              <CardHeader>
                <CardTitle>VPS / Dedicated Server Setup</CardTitle>
                <CardDescription>For Ubuntu 22.04 LTS or similar Linux distributions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <StepCard step={1} title="Update System & Install Dependencies">
                  <p>SSH into your server and run:</p>
                  <CodeBlock code={`sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx`} />
                </StepCard>

                <StepCard step={2} title="Install Node.js 20+">
                  <CodeBlock code={`curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should show v20.x`} />
                </StepCard>

                <StepCard step={3} title="Install Supabase CLI">
                  <CodeBlock code={`npm install -g supabase
supabase --version`} />
                </StepCard>

                <StepCard step={4} title="Clone & Configure the Project">
                  <CodeBlock code={`git clone https://github.com/yourusername/nullsto.git
cd nullsto
npm install

# Create environment file
cp .env.example .env
nano .env`} />
                  <p className="mt-2">Add your Supabase credentials:</p>
                  <CodeBlock code={`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id`} />
                </StepCard>

                <StepCard step={5} title="Setup Supabase Database">
                  <p>Link to your Supabase project and run migrations:</p>
                  <CodeBlock code={`supabase login
supabase link --project-ref your-project-id
supabase db push`} />
                </StepCard>

                <StepCard step={6} title="Configure IMAP/SMTP Secrets">
                  <p>Set these in Supabase Dashboard → Edge Functions → Secrets:</p>
                  <CodeBlock code={`IMAP_HOST=imap.yourdomain.com
IMAP_PORT=993
IMAP_USER=catchall@yourdomain.com
IMAP_PASSWORD=your-password
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=smtp@yourdomain.com
SMTP_PASSWORD=your-smtp-password`} />
                </StepCard>

                <StepCard step={7} title="Build & Deploy">
                  <CodeBlock code={`npm run build

# Deploy edge functions
supabase functions deploy

# Start the app (use PM2 for production)
npm install -g pm2
pm2 start npm --name "nullsto" -- run preview
pm2 save
pm2 startup`} />
                </StepCard>

                <StepCard step={8} title="Configure Nginx Reverse Proxy">
                  <CodeBlock code={`sudo nano /etc/nginx/sites-available/nullsto`} />
                  <p>Add this configuration:</p>
                  <CodeBlock code={`server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:4173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}` } />
                  <CodeBlock code={`sudo ln -s /etc/nginx/sites-available/nullsto /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com`} />
                </StepCard>
              </CardContent>
            </Card>
          </TabsContent>

          {/* cPanel */}
          <TabsContent value="cpanel">
            <Card>
              <CardHeader>
                <CardTitle>cPanel Hosting Setup</CardTitle>
                <CardDescription>For shared hosting with cPanel access</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-6">
                  <p className="text-amber-600 dark:text-amber-400">
                    <strong>Note:</strong> cPanel has limitations. You'll need a Supabase account for the backend, and IMAP access to your mailbox.
                  </p>
                </div>

                <StepCard step={1} title="Build the Frontend Locally">
                  <p>On your local machine:</p>
                  <CodeBlock code={`git clone https://github.com/yourusername/nullsto.git
cd nullsto
npm install
npm run build`} />
                </StepCard>

                <StepCard step={2} title="Upload via cPanel File Manager">
                  <p>1. Login to cPanel</p>
                  <p>2. Open <strong>File Manager</strong></p>
                  <p>3. Navigate to <code>public_html</code> or your domain folder</p>
                  <p>4. Upload the contents of the <code>dist</code> folder</p>
                </StepCard>

                <StepCard step={3} title="Create .htaccess for SPA Routing">
                  <p>Create <code>.htaccess</code> in your web root:</p>
                  <CodeBlock code={`<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>`} />
                </StepCard>

                <StepCard step={4} title="Configure Email Account">
                  <p>1. Go to cPanel → <strong>Email Accounts</strong></p>
                  <p>2. Create a catch-all email: <code>catchall@yourdomain.com</code></p>
                  <p>3. Note the IMAP/SMTP settings from cPanel</p>
                  <p>4. Add these to Supabase Edge Function secrets</p>
                </StepCard>

                <StepCard step={5} title="Add Domain to Supabase">
                  <p>1. Go to Supabase Dashboard → Settings → Domains</p>
                  <p>2. Add your custom domain</p>
                  <p>3. Update DNS records as instructed</p>
                </StepCard>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cloud (AWS/GCP) */}
          <TabsContent value="cloud">
            <Card>
              <CardHeader>
                <CardTitle>Cloud Platform Setup (AWS / GCP / Azure)</CardTitle>
                <CardDescription>Enterprise-grade deployment with auto-scaling</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <StepCard step={1} title="Create Cloud Resources">
                  <p><strong>For AWS:</strong></p>
                  <CodeBlock code={`# Create S3 bucket for static hosting
aws s3 mb s3://nullsto-frontend

# Create CloudFront distribution (optional, for CDN)
aws cloudfront create-distribution --origin-domain-name nullsto-frontend.s3.amazonaws.com`} />
                  
                  <p className="mt-4"><strong>For GCP:</strong></p>
                  <CodeBlock code={`# Create Cloud Storage bucket
gsutil mb gs://nullsto-frontend

# Enable static website hosting
gsutil web set -m index.html -e 404.html gs://nullsto-frontend`} />
                </StepCard>

                <StepCard step={2} title="Build & Upload">
                  <CodeBlock code={`npm run build

# AWS S3
aws s3 sync dist/ s3://nullsto-frontend --delete

# GCP Cloud Storage
gsutil -m rsync -r dist/ gs://nullsto-frontend`} />
                </StepCard>

                <StepCard step={3} title="Configure CDN & SSL">
                  <p><strong>AWS CloudFront:</strong> Use ACM for SSL certificates</p>
                  <p><strong>GCP:</strong> Use Cloud CDN with managed SSL</p>
                  <p><strong>Azure:</strong> Use Azure CDN with Front Door</p>
                </StepCard>

                <StepCard step={4} title="Set Up Email Server (SES/Gmail)">
                  <p>For AWS SES:</p>
                  <CodeBlock code={`# Verify domain
aws ses verify-domain-identity --domain yourdomain.com

# Configure DKIM
aws ses verify-domain-dkim --domain yourdomain.com`} />
                </StepCard>

                <StepCard step={5} title="Deploy Edge Functions">
                  <p>Supabase Edge Functions handle the backend. Deploy them:</p>
                  <CodeBlock code={`supabase functions deploy fetch-imap-emails
supabase functions deploy secure-email-access
supabase functions deploy get-public-stats
supabase functions deploy validate-temp-email`} />
                </StepCard>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Docker */}
          <TabsContent value="docker">
            <Card>
              <CardHeader>
                <CardTitle>Docker Deployment</CardTitle>
                <CardDescription>Containerized deployment for any platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <StepCard step={1} title="Create Dockerfile">
                  <CodeBlock code={`FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`} />
                </StepCard>

                <StepCard step={2} title="Create nginx.conf">
                  <CodeBlock code={`events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /assets {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}`} />
                </StepCard>

                <StepCard step={3} title="Create docker-compose.yml">
                  <CodeBlock code={`version: '3.8'
services:
  nullsto:
    build: .
    ports:
      - "3000:80"
    environment:
      - VITE_SUPABASE_URL=\${SUPABASE_URL}
      - VITE_SUPABASE_PUBLISHABLE_KEY=\${SUPABASE_ANON_KEY}
    restart: unless-stopped`} />
                </StepCard>

                <StepCard step={4} title="Build & Run">
                  <CodeBlock code={`# Build the image
docker-compose build

# Start the container
docker-compose up -d

# View logs
docker-compose logs -f`} />
                </StepCard>

                <StepCard step={5} title="With Traefik (Auto SSL)">
                  <CodeBlock code={`version: '3.8'
services:
  nullsto:
    build: .
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.nullsto.rule=Host(\`yourdomain.com\`)"
      - "traefik.http.routers.nullsto.entrypoints=websecure"
      - "traefik.http.routers.nullsto.tls.certresolver=letsencrypt"
    restart: unless-stopped

  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=you@email.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "./letsencrypt:/letsencrypt"`} />
                </StepCard>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Email Server Setup */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Email Server Configuration
            </CardTitle>
            <CardDescription>Required for receiving temporary emails</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="catch-all">
                <AccordionTrigger>Setting Up Catch-All Email</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <p>A catch-all email receives messages sent to any address at your domain.</p>
                  <p><strong>In cPanel:</strong></p>
                  <ol className="list-decimal pl-6 space-y-2">
                    <li>Go to Email → Default Address</li>
                    <li>Set "Forward to email address" to your catch-all mailbox</li>
                    <li>Or create a script to process incoming emails</li>
                  </ol>
                  <p className="mt-4"><strong>In Postfix (Linux):</strong></p>
                  <CodeBlock code={`# /etc/postfix/main.cf
virtual_alias_domains = yourdomain.com
virtual_alias_maps = hash:/etc/postfix/virtual

# /etc/postfix/virtual
@yourdomain.com catchall@yourdomain.com`} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="dns">
                <AccordionTrigger>DNS Records (MX, SPF, DKIM)</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <p>Add these DNS records for email delivery:</p>
                  <CodeBlock code={`# MX Record
yourdomain.com.    MX    10    mail.yourdomain.com.

# SPF Record
yourdomain.com.    TXT    "v=spf1 mx a ip4:YOUR_SERVER_IP ~all"

# DKIM Record (generate with opendkim-genkey)
default._domainkey.yourdomain.com.    TXT    "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY"

# DMARC Record
_dmarc.yourdomain.com.    TXT    "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com"`} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="imap-access">
                <AccordionTrigger>Configuring IMAP Access</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <p>The Edge Functions need IMAP access to fetch incoming emails:</p>
                  <CodeBlock code={`# Supabase Edge Function Secrets
IMAP_HOST=mail.yourdomain.com
IMAP_PORT=993  # SSL/TLS
IMAP_USER=catchall@yourdomain.com
IMAP_PASSWORD=your-secure-password`} />
                  <p className="mt-4">Test connection with:</p>
                  <CodeBlock code={`openssl s_client -connect mail.yourdomain.com:993`} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Troubleshooting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="emails-not-arriving">
                <AccordionTrigger>Emails not arriving</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p>1. Check IMAP credentials are correct</p>
                  <p>2. Verify catch-all is configured</p>
                  <p>3. Check Edge Function logs in Supabase Dashboard</p>
                  <p>4. Ensure MX records point to your mail server</p>
                  <p>5. Test with: <code>telnet mail.yourdomain.com 993</code></p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="slow-loading">
                <AccordionTrigger>Slow page loads</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p>1. Enable gzip compression in nginx</p>
                  <p>2. Use a CDN (CloudFlare, CloudFront)</p>
                  <p>3. Check Supabase region is close to users</p>
                  <p>4. Optimize images and enable lazy loading</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="cors-errors">
                <AccordionTrigger>CORS errors</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p>Ensure Edge Functions have correct CORS headers:</p>
                  <CodeBlock code={`const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};`} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="database-errors">
                <AccordionTrigger>Database connection errors</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p>1. Check Supabase project is active (not paused)</p>
                  <p>2. Verify anon key and URL are correct</p>
                  <p>3. Check RLS policies allow the operations</p>
                  <p>4. Review Supabase logs for details</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Support Links */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">Need more help?</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button variant="outline" asChild>
              <a href="https://supabase.com/docs" target="_blank" rel="noopener noreferrer">
                Supabase Docs <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://github.com/yourusername/nullsto/issues" target="_blank" rel="noopener noreferrer">
                Report Issue <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default HostingGuide;