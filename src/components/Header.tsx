import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, User, LogOut, Settings, History, Globe, Sun, Moon, LayoutDashboard, Crown, Send } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAppearanceSettings } from "@/hooks/useAppearanceSettings";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import nullstoLogo from "@/assets/nullsto-logo.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAdmin, signOut } = useAuth();
  const { t, language, setLanguage, languages, isRTL } = useLanguage();
  const { theme, themes, setTheme } = useTheme();
  const { settings: appearanceSettings } = useAppearanceSettings();
  const { settings: generalSettings } = useGeneralSettings();
  const navigate = useNavigate();

  const toggleTheme = () => {
    const darkThemes = themes.filter(t => t.isDark);
    const lightThemes = themes.filter(t => !t.isDark);
    
    if (theme.isDark) {
      setTheme(lightThemes[0]?.id || 'light-minimal');
    } else {
      setTheme(darkThemes[0]?.id || 'cyber-dark');
    }
  };

  const navItems = [
    { label: t('features'), href: "/#features" },
    { label: t('howItWorks'), href: "/#how-it-works" },
    { label: t('faq'), href: "/#faq" },
    { label: t('blog'), href: "/blog" },
    { label: t('contact'), href: "/contact" },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getInitials = (email: string) => {
    return email?.slice(0, 2).toUpperCase() || "U";
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-primary/10">
      <div className="container mx-auto px-4">
        <div className={`flex items-center justify-between h-16 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <img 
              src={appearanceSettings.logoUrl && appearanceSettings.logoUrl.length > 0 ? appearanceSettings.logoUrl : nullstoLogo} 
              alt={generalSettings.siteName || 'Nullsto'} 
              className="h-8 w-auto object-contain transition-transform group-hover:scale-110"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = nullstoLogo;
              }}
            />
            <span className="text-xl font-bold gradient-text">{generalSettings.siteName || 'Nullsto'}</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className={`hidden md:flex items-center gap-8 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right Side */}
          <div className={`hidden md:flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {/* Language Selector */}
            <Select value={language} onValueChange={(value: any) => setLanguage(value)}>
              <SelectTrigger className="w-[100px] bg-transparent border-border">
                <Globe className="w-4 h-4 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Telegram Join Button */}
            <a
              href="https://t.me/nullstoemail"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border border-[#0088cc]/30 text-[#0088cc] transition-all hover:scale-105 text-sm font-medium"
            >
              <Send className="w-4 h-4" />
              <span className="hidden lg:inline">Join Updates</span>
            </a>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="relative overflow-hidden"
            >
              <AnimatePresence mode="wait">
                {theme.isDark ? (
                  <motion.div
                    key="moon"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Moon className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="sun"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Sun className="w-5 h-5 text-yellow-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {getInitials(user.email || "")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm max-w-[120px] truncate">{user.email?.split('@')[0]}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/dashboard")} className="text-primary">
                    <Crown className="w-4 h-4 mr-2" />
                    Subscription
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <User className="w-4 h-4 mr-2" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/history")}>
                    <History className="w-4 h-4 mr-2" />
                    Email History
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    {t('signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                  {t('signIn')}
                </Button>
                <Button variant="neon" size="sm" onClick={() => navigate("/auth")}>
                  {t('getStarted')}
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-foreground p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-primary/10"
          >
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-4">
              {/* Theme Toggle and Language - Mobile */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={toggleTheme}
                  className="flex-1"
                >
                  {theme.isDark ? (
                    <>
                      <Moon className="w-4 h-4 mr-2" />
                      Dark Mode
                    </>
                  ) : (
                    <>
                      <Sun className="w-4 h-4 mr-2 text-yellow-500" />
                      Light Mode
                    </>
                  )}
                </Button>
                <Select value={language} onValueChange={(value: any) => setLanguage(value)}>
                  <SelectTrigger className="flex-1 bg-secondary/50">
                    <Globe className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Telegram - Mobile */}
              <a
                href="https://t.me/nullstoemail"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border border-[#0088cc]/30 text-[#0088cc] transition-all text-sm font-medium"
              >
                <Send className="w-4 h-4" />
                Join Telegram for Updates
              </a>

              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              {user ? (
                <>
                  <div className="border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
                  </div>
                  <Button variant="glass" onClick={() => { navigate("/history"); setMobileMenuOpen(false); }}>
                    Email History
                  </Button>
                  <Button variant="destructive" onClick={handleSignOut}>
                    {t('signOut')}
                  </Button>
                </>
              ) : (
                <div className="flex gap-3 pt-4 border-t border-border">
                  <Button variant="ghost" className="flex-1" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>
                    {t('signIn')}
                  </Button>
                  <Button variant="neon" className="flex-1" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>
                    {t('getStarted')}
                  </Button>
                </div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
