import { motion } from "framer-motion";
import { 
  BookOpen, Database, Shield, Users, Settings, Key, 
  Server, Code, Copy, Check, ExternalLink, Terminal,
  UserPlus, LogIn, Lock, Globe, Zap, AlertTriangle
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const AdminGuide = () => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({ code, id, language = "sql" }: { code: string; id: string; language?: string }) => (
    <div className="relative group">
      <pre className="bg-background/80 border border-border rounded-lg p-4 overflow-x-auto text-sm">
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copyToClipboard(code, id)}
      >
        {copiedCode === id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Admin & Database Setup Guide
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Complete guide for setting up admin access, database configuration, and user management
            </p>
          </motion.div>

          <Tabs defaultValue="admin" className="space-y-8">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="admin">Admin Login</TabsTrigger>
              <TabsTrigger value="database">Database Setup</TabsTrigger>
              <TabsTrigger value="users">User Management</TabsTrigger>
            </TabsList>

            {/* Admin Login Tab */}
            <TabsContent value="admin" className="space-y-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Shield className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Admin Login Guide</h2>
                    <p className="text-muted-foreground">How to access the admin panel</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-foreground">Important Security Note</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Admin roles are managed in the database. Never use localStorage or client-side 
                          checks for admin authentication as they can be easily bypassed.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Accordion type="single" collapsible className="space-y-2">
                    <AccordionItem value="step1" className="bg-secondary/30 rounded-lg border-none">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">1</div>
                          <span>Create an Admin User Account</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <p className="text-muted-foreground mb-4">
                          First, register a normal account through the sign-up page at <code className="bg-secondary px-2 py-1 rounded">/auth</code>.
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                          <li>Go to the authentication page</li>
                          <li>Click "Create Account"</li>
                          <li>Enter your email and password</li>
                          <li>Note down your email - you'll need it for the next step</li>
                        </ol>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="step2" className="bg-secondary/30 rounded-lg border-none">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">2</div>
                          <span>Grant Admin Role via Database</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <p className="text-muted-foreground mb-4">
                          Run this SQL query in your Supabase SQL Editor to grant admin privileges:
                        </p>
                        <CodeBlock 
                          id="grant-admin"
                          code={`-- First, find your user ID
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Then grant admin role (replace USER_ID with actual ID)
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER_ID_HERE', 'admin');

-- Verify the role was assigned
SELECT * FROM public.user_roles WHERE user_id = 'USER_ID_HERE';`}
                        />
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="step3" className="bg-secondary/30 rounded-lg border-none">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">3</div>
                          <span>Access Admin Panel</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <p className="text-muted-foreground mb-4">
                          After granting admin role:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                          <li>Log out and log back in to refresh your session</li>
                          <li>Click on your profile avatar in the header</li>
                          <li>Select "Admin Panel" from the dropdown menu</li>
                          <li>Or navigate directly to <code className="bg-secondary px-2 py-1 rounded">/admin</code></li>
                        </ol>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </motion.div>
            </TabsContent>

            {/* Database Setup Tab */}
            <TabsContent value="database" className="space-y-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <Database className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Database Configuration</h2>
                    <p className="text-muted-foreground">Set up and connect your Supabase database</p>
                  </div>
                </div>

                <Accordion type="single" collapsible className="space-y-2">
                  <AccordionItem value="create-project" className="bg-secondary/30 rounded-lg border-none">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Server className="w-5 h-5 text-primary" />
                        <span>Option 1: Lovable Cloud (Recommended)</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <p className="text-muted-foreground mb-4">
                        If you're using Lovable, the database is automatically configured. Your project already 
                        has a Supabase backend through Lovable Cloud.
                      </p>
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">
                          ✓ Database is pre-configured<br />
                          ✓ Tables are automatically created<br />
                          ✓ RLS policies are in place<br />
                          ✓ Authentication is ready to use
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="external-supabase" className="bg-secondary/30 rounded-lg border-none">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-primary" />
                        <span>Option 2: External Supabase Project</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <p className="text-muted-foreground mb-4">
                        To connect your own Supabase project:
                      </p>
                      <ol className="list-decimal list-inside space-y-4 text-muted-foreground">
                        <li>
                          <strong>Create a Supabase Project:</strong>
                          <ul className="list-disc list-inside ml-4 mt-2">
                            <li>Go to <a href="https://supabase.com" target="_blank" rel="noopener" className="text-primary hover:underline">supabase.com</a></li>
                            <li>Create a new project</li>
                            <li>Wait for setup to complete</li>
                          </ul>
                        </li>
                        <li>
                          <strong>Get Connection Details:</strong>
                          <ul className="list-disc list-inside ml-4 mt-2">
                            <li>Go to Project Settings → API</li>
                            <li>Copy the Project URL</li>
                            <li>Copy the anon/public key</li>
                          </ul>
                        </li>
                        <li>
                          <strong>Update Environment Variables:</strong>
                          <CodeBlock 
                            id="env-vars"
                            language="bash"
                            code={`# Create .env file in project root
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here`}
                          />
                        </li>
                        <li>
                          <strong>Run Database Migrations:</strong>
                          <p className="mt-2">Copy and run the SQL from the migrations folder in your Supabase SQL Editor.</p>
                        </li>
                      </ol>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="schema" className="bg-secondary/30 rounded-lg border-none">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Code className="w-5 h-5 text-primary" />
                        <span>Database Schema Overview</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <p className="text-muted-foreground mb-4">
                        The application uses these main tables:
                      </p>
                      <div className="space-y-4">
                        <div className="bg-secondary/50 rounded-lg p-4">
                          <h5 className="font-medium text-foreground mb-2">Core Tables</h5>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li><code>profiles</code> - User profile information</li>
                            <li><code>user_roles</code> - Role assignments (admin, user, moderator)</li>
                            <li><code>domains</code> - Email domains configuration</li>
                            <li><code>temp_emails</code> - Temporary email addresses</li>
                            <li><code>received_emails</code> - Incoming emails</li>
                            <li><code>saved_emails</code> - User's saved/favorited emails</li>
                          </ul>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-4">
                          <h5 className="font-medium text-foreground mb-2">Feature Tables</h5>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li><code>email_attachments</code> - File attachments</li>
                            <li><code>email_forwarding</code> - Forwarding rules</li>
                            <li><code>push_subscriptions</code> - Push notification subscriptions</li>
                            <li><code>app_settings</code> - Application configuration</li>
                          </ul>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </motion.div>
            </TabsContent>

            {/* User Management Tab */}
            <TabsContent value="users" className="space-y-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Users className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">User Management</h2>
                    <p className="text-muted-foreground">Managing users and roles</p>
                  </div>
                </div>

                <Accordion type="single" collapsible className="space-y-2">
                  <AccordionItem value="roles" className="bg-secondary/30 rounded-lg border-none">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-primary" />
                        <span>Available Roles</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                          <div className="p-2 rounded bg-red-500/20">
                            <Shield className="w-4 h-4 text-red-500" />
                          </div>
                          <div>
                            <h5 className="font-medium text-foreground">Admin</h5>
                            <p className="text-sm text-muted-foreground">
                              Full access to admin panel, user management, settings, and all features
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                          <div className="p-2 rounded bg-yellow-500/20">
                            <Users className="w-4 h-4 text-yellow-500" />
                          </div>
                          <div>
                            <h5 className="font-medium text-foreground">Moderator</h5>
                            <p className="text-sm text-muted-foreground">
                              Can moderate content, view reports, but limited admin access
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                          <div className="p-2 rounded bg-blue-500/20">
                            <UserPlus className="w-4 h-4 text-blue-500" />
                          </div>
                          <div>
                            <h5 className="font-medium text-foreground">User</h5>
                            <p className="text-sm text-muted-foreground">
                              Default role - can use all public features, save emails, history
                            </p>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="manage-users" className="bg-secondary/30 rounded-lg border-none">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Settings className="w-5 h-5 text-primary" />
                        <span>Managing Users</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <p className="text-muted-foreground mb-4">
                        User management can be done through:
                      </p>
                      <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
                        <li>
                          <strong>Admin Panel:</strong> Go to Admin → Users to view, search, and manage users
                        </li>
                        <li>
                          <strong>Change Roles:</strong>
                          <CodeBlock 
                            id="change-role"
                            code={`-- Promote user to moderator
UPDATE public.user_roles 
SET role = 'moderator' 
WHERE user_id = 'USER_ID_HERE';

-- Or add multiple roles
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER_ID_HERE', 'moderator');`}
                          />
                        </li>
                        <li>
                          <strong>Remove User:</strong> Delete from auth.users (cascades to profiles and roles)
                        </li>
                      </ol>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="security" className="bg-secondary/30 rounded-lg border-none">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-primary" />
                        <span>Security Best Practices</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                          <h5 className="font-medium text-red-400 mb-2">Never Do</h5>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>❌ Store roles in localStorage or sessionStorage</li>
                            <li>❌ Check admin status on client-side only</li>
                            <li>❌ Use hardcoded passwords or credentials</li>
                            <li>❌ Disable RLS policies in production</li>
                          </ul>
                        </div>
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                          <h5 className="font-medium text-green-400 mb-2">Always Do</h5>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>✓ Use database-stored roles with RLS</li>
                            <li>✓ Validate permissions server-side</li>
                            <li>✓ Use the has_role() and is_admin() functions</li>
                            <li>✓ Keep RLS policies enabled</li>
                            <li>✓ Use strong, unique passwords</li>
                          </ul>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminGuide;
