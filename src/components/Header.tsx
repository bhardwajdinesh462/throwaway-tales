import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, User, LogOut, History, Globe, Sun, Moon, LayoutDashboard, Crown, Send, Sparkles, BookOpen, DollarSign, Info, Mail, Palette, Check } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAppearanceSettings } from "@/hooks/useAppearanceSettings";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import AnnouncementBar from "./AnnouncementBar";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
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
  const [scrolled, setScrolled] = useState(false);
  const { user, isAdmin, signOut } = useAuth();
  const { t, language, setLanguage, languages, isRTL } = useLanguage();
  const { theme, themes, setTheme } = useTheme();
  const { settings: appearanceSettings } = useAppearanceSettings();
  const { settings: generalSettings } = useGeneralSettings();
  const navigate = useNavigate();

  // Scroll detection for header effects
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleTheme = () => {
    const darkThemes = themes.filter(t => t.isDark);
    const lightThemes = themes.filter(t => !t.isDark);
    
    if (theme.isDark) {
      setTheme(lightThemes[0]?.id || 'light-minimal');
    } else {
      setTheme(darkThemes[0]?.id || 'cyber-dark');
    }
  };

  // Group themes by category
  const groupedThemes = useMemo(() => {
    const groups: Record<string, typeof themes> = {};
    themes.forEach(t => {
      const category = t.category || 'default';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(t);
    });
    return groups;
  }, [themes]);

  const categoryOrder = ['gradient', 'glass', 'vibrant', 'elegant', 'minimal', 'default'];
  const categoryLabels: Record<string, string> = {
    gradient: 'Gradient',
    glass: 'Glass',
    vibrant: 'Vibrant',
    elegant: 'Elegant',
    minimal: 'Minimal',
    default: 'Classic'
  };

  const navItems = [
    { label: t('features'), href: "/features", icon: Sparkles },
    { label: t('pricing'), href: "/pricing", icon: DollarSign },
    { label: t('blog'), href: "/blog", icon: BookOpen },
    { label: t('about'), href: "/about", icon: Info },
    { label: t('contact'), href: "/contact", icon: Mail },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getInitials = (email: string) => {
    return email?.slice(0, 2).toUpperCase() || "U";
  };

  return (
    <>
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[55] md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Fixed Header Container - includes announcement bar and navigation */}
      <div className="fixed top-0 left-0 right-0 z-50">
        {/* Announcement Bar - positioned at the very top */}
        <AnnouncementBar />

        {/* Main Header */}
        <header 
          className={`relative transition-all duration-300 ${
            scrolled 
              ? 'bg-background/95 backdrop-blur-xl shadow-lg border-b border-border' 
              : 'bg-background/70 backdrop-blur-md border-b border-transparent'
          }`}
        >
          {/* Animated gradient border */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] overflow-hidden">
            <motion.div 
              className="h-full w-[200%] bg-gradient-to-r from-transparent via-primary to-transparent"
              animate={{ x: ["-50%", "0%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
          </div>

          <div className="container mx-auto px-4">
            <div className={`flex items-center justify-between h-16 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {/* Logo */}
              <Link to="/" className="flex items-center gap-2.5 group relative z-10">
                <motion.div
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  {appearanceSettings.logoUrl ? (
                    <img 
                      src={appearanceSettings.logoUrl} 
                      alt={generalSettings.siteName || 'Nullsto'} 
                      className="h-9 w-auto object-contain"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-lg">
                      {(generalSettings.siteName || 'N')[0]}
                    </div>
                  )}
                </motion.div>
                <span className="text-xl font-bold gradient-text">{generalSettings.siteName || 'Nullsto'}</span>
              </Link>

              {/* Desktop Navigation */}
              <nav className={`hidden md:flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {navItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="relative px-4 py-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium group"
                  >
                    {item.label}
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-primary to-accent group-hover:w-3/4 transition-all duration-300 rounded-full" />
                  </a>
                ))}
              </nav>

              {/* Right Side */}
              <div className={`hidden md:flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                {/* Language Selector - Enhanced */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-3 gap-2 bg-secondary/50 hover:bg-secondary border border-border/50"
                    >
                      <Globe className="w-4 h-4 text-primary" />
                      <span className="font-medium">{languages.find(l => l.code === language)?.name || 'EN'}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {languages.map((lang) => (
                      <DropdownMenuItem
                        key={lang.code}
                        onClick={() => setLanguage(lang.code as any)}
                        className={`cursor-pointer ${language === lang.code ? 'bg-primary/10 text-primary' : ''}`}
                      >
                        <span className="mr-2">{lang.code === 'en' ? '🇺🇸' : lang.code === 'ar' ? '🇸🇦' : lang.code === 'es' ? '🇪🇸' : lang.code === 'fr' ? '🇫🇷' : lang.code === 'de' ? '🇩🇪' : lang.code === 'zh' ? '🇨🇳' : lang.code === 'ja' ? '🇯🇵' : lang.code === 'ko' ? '🇰🇷' : lang.code === 'pt' ? '🇧🇷' : lang.code === 'ru' ? '🇷🇺' : lang.code === 'hi' ? '🇮🇳' : '🌐'}</span>
                        {lang.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Telegram Join Button */}
                <motion.a
                  href="https://t.me/nullstoemail"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border border-[#0088cc]/30 text-[#0088cc] transition-all text-sm font-medium"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Join</span>
                </motion.a>

                {/* Theme Picker Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="relative overflow-hidden h-9 w-9 rounded-lg bg-secondary/50 hover:bg-secondary"
                      >
                        <div 
                          className="absolute inset-1 rounded-md opacity-30"
                          style={{ backgroundColor: theme.colors.primary }}
                        />
                        <Palette className="w-4 h-4 relative z-10" />
                      </Button>
                    </motion.div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 max-h-[400px] overflow-hidden">
                    <ScrollArea className="h-[380px]">
                      {/* Quick Dark/Light Toggle */}
                      <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                        {theme.isDark ? (
                          <>
                            <Sun className="w-4 h-4 mr-2 text-yellow-500" />
                            Switch to Light Mode
                          </>
                        ) : (
                          <>
                            <Moon className="w-4 h-4 mr-2" />
                            Switch to Dark Mode
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      
                      {/* Grouped Themes */}
                      {categoryOrder.map(category => {
                        const categoryThemes = groupedThemes[category];
                        if (!categoryThemes || categoryThemes.length === 0) return null;
                        
                        return (
                          <div key={category}>
                            <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                              {categoryLabels[category]}
                            </DropdownMenuLabel>
                            {categoryThemes.map(t => (
                              <DropdownMenuItem
                                key={t.id}
                                onClick={() => setTheme(t.id)}
                                className={`cursor-pointer flex items-center gap-2 ${theme.id === t.id ? 'bg-primary/10' : ''}`}
                              >
                                <div 
                                  className="w-4 h-4 rounded-full border border-border flex-shrink-0"
                                  style={{ 
                                    background: `linear-gradient(135deg, ${t.colors.primary} 0%, ${t.colors.accent} 100%)`
                                  }}
                                />
                                <span className="flex-1 truncate">{t.name}</span>
                                {theme.id === t.id && <Check className="w-4 h-4 text-primary" />}
                                {t.isDark && <Moon className="w-3 h-3 text-muted-foreground" />}
                              </DropdownMenuItem>
                            ))}
                          </div>
                        );
                      })}
                    </ScrollArea>
                  </DropdownMenuContent>
                </DropdownMenu>

                {user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="flex items-center gap-2 h-9 px-2 hover:bg-secondary/80">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs">
                            {getInitials(user.email || "")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm max-w-[100px] truncate hidden lg:block">{user.email?.split('@')[0]}</span>
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
                      <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                        <LogOut className="w-4 h-4 mr-2" />
                        {t('signOut')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="h-9 px-3 text-sm">
                      {t('signIn')}
                    </Button>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button 
                        size="sm" 
                        onClick={() => navigate("/auth")}
                        className="h-9 px-4 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-medium shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
                      >
                        {t('getStarted')}
                      </Button>
                    </motion.div>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <motion.button
                className="md:hidden text-foreground p-2 rounded-lg hover:bg-secondary/80 transition-colors relative z-10"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                whileTap={{ scale: 0.9 }}
              >
                <AnimatePresence mode="wait">
                  {mobileMenuOpen ? (
                    <motion.div
                      key="close"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <X className="w-6 h-6" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="menu"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Menu className="w-6 h-6" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        </header>
      </div>

      {/* Mobile Menu - Slide from Right */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-[85%] max-w-sm bg-background border-l border-border shadow-2xl z-[60] md:hidden overflow-y-auto pt-20"
          >
            <nav className="p-6 flex flex-col gap-2">
              {/* Theme Picker and Language - Mobile */}
              <div className="flex gap-2 mb-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex-1 h-11">
                      <Palette className="w-4 h-4 mr-2" />
                      Theme
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 max-h-[300px] overflow-hidden">
                    <ScrollArea className="h-[280px]">
                      {/* Quick Dark/Light Toggle */}
                      <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                        {theme.isDark ? (
                          <>
                            <Sun className="w-4 h-4 mr-2 text-yellow-500" />
                            Switch to Light Mode
                          </>
                        ) : (
                          <>
                            <Moon className="w-4 h-4 mr-2" />
                            Switch to Dark Mode
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      
                      {/* Grouped Themes */}
                      {categoryOrder.map(category => {
                        const categoryThemes = groupedThemes[category];
                        if (!categoryThemes || categoryThemes.length === 0) return null;
                        
                        return (
                          <div key={category}>
                            <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                              {categoryLabels[category]}
                            </DropdownMenuLabel>
                            {categoryThemes.map(t => (
                              <DropdownMenuItem
                                key={t.id}
                                onClick={() => setTheme(t.id)}
                                className={`cursor-pointer flex items-center gap-2 ${theme.id === t.id ? 'bg-primary/10' : ''}`}
                              >
                                <div 
                                  className="w-4 h-4 rounded-full border border-border flex-shrink-0"
                                  style={{ 
                                    background: `linear-gradient(135deg, ${t.colors.primary} 0%, ${t.colors.accent} 100%)`
                                  }}
                                />
                                <span className="flex-1 truncate">{t.name}</span>
                                {theme.id === t.id && <Check className="w-4 h-4 text-primary" />}
                              </DropdownMenuItem>
                            ))}
                          </div>
                        );
                      })}
                    </ScrollArea>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex-1 h-11">
                      <Globe className="w-4 h-4 mr-2 text-primary" />
                      {languages.find(l => l.code === language)?.name || 'EN'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-40">
                    {languages.map((lang) => (
                      <DropdownMenuItem
                        key={lang.code}
                        onClick={() => setLanguage(lang.code as any)}
                        className={`cursor-pointer ${language === lang.code ? 'bg-primary/10 text-primary' : ''}`}
                      >
                        <span className="mr-2">{lang.code === 'en' ? '🇺🇸' : lang.code === 'ar' ? '🇸🇦' : lang.code === 'es' ? '🇪🇸' : lang.code === 'fr' ? '🇫🇷' : lang.code === 'de' ? '🇩🇪' : lang.code === 'zh' ? '🇨🇳' : lang.code === 'ja' ? '🇯🇵' : lang.code === 'ko' ? '🇰🇷' : lang.code === 'pt' ? '🇧🇷' : lang.code === 'ru' ? '🇷🇺' : lang.code === 'hi' ? '🇮🇳' : '🌐'}</span>
                        {lang.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Telegram - Mobile */}
              <a
                href="https://t.me/nullstoemail"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0088cc]/10 hover:bg-[#0088cc]/20 border border-[#0088cc]/30 text-[#0088cc] transition-all text-sm font-medium mb-4"
              >
                <Send className="w-5 h-5" />
                Join Telegram for Updates
              </a>

              {/* Nav Items with Icons */}
              <div className="space-y-1">
                {navItems.map((item, index) => (
                  <motion.a
                    key={item.label}
                    href={item.href}
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </motion.a>
                ))}
              </div>

              {/* User Section */}
              <div className="mt-6 pt-6 border-t border-border">
                {user ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 px-4 py-2 mb-2">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {getInitials(user.email || "")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium truncate">{user.email?.split('@')[0]}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full justify-start h-11" onClick={() => { navigate("/dashboard"); setMobileMenuOpen(false); }}>
                      <LayoutDashboard className="w-4 h-4 mr-3" />
                      Dashboard
                    </Button>
                    <Button variant="outline" className="w-full justify-start h-11" onClick={() => { navigate("/history"); setMobileMenuOpen(false); }}>
                      <History className="w-4 h-4 mr-3" />
                      Email History
                    </Button>
                    <Button variant="destructive" className="w-full h-11 mt-2" onClick={handleSignOut}>
                      <LogOut className="w-4 h-4 mr-2" />
                      {t('signOut')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full h-12" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>
                      {t('signIn')}
                    </Button>
                    <Button 
                      className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-medium shadow-lg shadow-primary/25"
                      onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}
                    >
                      {t('getStarted')}
                    </Button>
                  </div>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
