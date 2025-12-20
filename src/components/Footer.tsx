import { Link } from "react-router-dom";
import { Github, Twitter, Linkedin, Send, Mail, Shield, Zap, Globe } from "lucide-react";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { useAppearanceSettings } from "@/hooks/useAppearanceSettings";
import { motion } from "framer-motion";

const Footer = () => {
  const { settings: generalSettings } = useGeneralSettings();
  const { settings: appearanceSettings } = useAppearanceSettings();

  const footerLinks = {
    Product: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Changelog", href: "/changelog" },
      { label: "Status", href: "/status" },
    ],
    Company: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
    Legal: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
    Resources: [
      { label: "FAQ", href: "/#faq" },
      { label: "How It Works", href: "/#how-it-works" },
    ],
  };

  const socialLinks = [
    { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
    { icon: Github, href: "https://github.com", label: "GitHub" },
    { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
    { icon: Send, href: "https://t.me/nullstoemail", label: "Telegram" },
  ];

  const features = [
    { icon: Shield, label: "100% Private" },
    { icon: Zap, label: "Instant Delivery" },
    { icon: Globe, label: "Global Access" },
  ];

  return (
    <footer className="relative border-t border-border bg-gradient-to-b from-background to-card/50 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-accent/5 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Top Section - Features Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-6 md:gap-12 mb-10 pb-10 border-b border-border/50"
        >
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-muted-foreground">
              <feature.icon className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{feature.label}</span>
            </div>
          ))}
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-12 mb-10">
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-4 group">
              <motion.div
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                {appearanceSettings.logoUrl ? (
                  <img 
                    src={appearanceSettings.logoUrl} 
                    alt={generalSettings.siteName} 
                    className="h-9 w-auto object-contain" 
                  />
                ) : (
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/25">
                    {(generalSettings.siteName || 'N')[0]}
                  </div>
                )}
              </motion.div>
              <span className="text-xl font-bold gradient-text">{generalSettings.siteName}</span>
            </Link>
            <p className="text-muted-foreground text-sm mb-5 max-w-xs leading-relaxed">
              {generalSettings.siteDescription || "Secure, instant, and anonymous temporary email addresses. Protect your privacy online."}
            </p>
            
            {/* Social Links */}
            <div className="flex gap-2">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-9 h-9 rounded-lg bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 border border-border/50 hover:border-primary/30 transition-all duration-300"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wider">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('#') || link.href.startsWith('http') ? (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
                      >
                        <span className="group-hover:translate-x-0.5 transition-transform">{link.label}</span>
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 group"
                      >
                        <span className="group-hover:translate-x-0.5 transition-transform">{link.label}</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter / CTA Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 px-6 rounded-xl bg-gradient-to-r from-primary/5 via-background to-accent/5 border border-border/50 mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">Join our Telegram</p>
              <p className="text-xs text-muted-foreground">Get updates & announcements</p>
            </div>
          </div>
          <motion.a
            href="https://t.me/nullstoemail"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0088cc] text-white font-medium text-sm hover:bg-[#0088cc]/90 transition-colors shadow-lg shadow-[#0088cc]/25"
          >
            <Send className="w-4 h-4" />
            Join Now
          </motion.a>
        </motion.div>

        {/* Bottom */}
        <div className="pt-6 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {generalSettings.siteName}. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
            <span>
              Made by{' '}
              <a 
                href="https://nullsto.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Nullsto.com
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;