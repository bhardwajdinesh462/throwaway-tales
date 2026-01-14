import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FriendlyWebsite {
  id: string;
  name: string;
  url: string;
  icon_url: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  open_in_new_tab: boolean;
}

interface WidgetSettings {
  enabled: boolean;
  visibleToPublic: boolean;
  visibleToLoggedIn: boolean;
  colorScheme: 'primary' | 'accent' | 'gradient' | 'glass';
  size: 'small' | 'medium' | 'large';
  position: 'left' | 'right';
  showOnMobile: boolean;
  animationType: 'slide' | 'fade' | 'bounce';
}

const defaultSettings: WidgetSettings = {
  enabled: true,
  visibleToPublic: true,
  visibleToLoggedIn: true,
  colorScheme: 'primary',
  size: 'medium',
  position: 'right',
  showOnMobile: true,
  animationType: 'slide',
};

const FriendlyWebsitesWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch settings with React Query for caching and real-time updates
  const { data: settings = defaultSettings } = useQuery({
    queryKey: ['app_settings', 'friendly_sites_widget'],
    queryFn: async () => {
      const { data } = await api.db.query<{ value: Partial<WidgetSettings> }>('app_settings', {
        select: 'value',
        filter: { key: 'friendly_sites_widget' },
        single: true
      });

      if (data?.value) {
        return { ...defaultSettings, ...data.value };
      }
      return defaultSettings;
    },
    staleTime: 1000 * 30, // 30 seconds - will refetch when invalidated
    refetchOnWindowFocus: true,
  });

  // Fetch websites with React Query
  const { data: websites = [], isLoading } = useQuery({
    queryKey: ['friendly_websites', 'active'],
    queryFn: async () => {
      const { data } = await api.db.query<FriendlyWebsite[]>('friendly_websites', {
        select: '*',
        filter: { is_active: true },
        order: { column: 'display_order', ascending: true }
      });

      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Check visibility permissions
  const isVisible = () => {
    if (!settings.enabled) return false;
    if (websites.length === 0) return false;
    
    if (user && !settings.visibleToLoggedIn) return false;
    if (!user && !settings.visibleToPublic) return false;
    
    return true;
  };

  if (isLoading || !isVisible()) return null;

  const sizeClasses = {
    small: 'w-48',
    medium: 'w-64',
    large: 'w-80',
  };

  const colorClasses = {
    primary: 'bg-primary/10 border-primary/30 hover:bg-primary/20',
    accent: 'bg-accent/10 border-accent/30 hover:bg-accent/20',
    gradient: 'bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30',
    glass: 'bg-card/80 backdrop-blur-xl border-border/50',
  };

  const buttonColorClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    accent: 'bg-accent text-accent-foreground hover:bg-accent/90',
    gradient: 'bg-gradient-to-r from-primary to-accent text-primary-foreground',
    glass: 'bg-card/90 backdrop-blur-xl text-foreground border border-border/50 hover:bg-card',
  };

  const animationVariants = {
    slide: {
      hidden: { x: settings.position === 'right' ? 300 : -300, opacity: 0 },
      visible: { x: 0, opacity: 1 },
    },
    fade: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: { opacity: 1, scale: 1 },
    },
    bounce: {
      hidden: { x: settings.position === 'right' ? 300 : -300, opacity: 0 },
      visible: { x: 0, opacity: 1 },
    },
  } as const;

  const positionClasses = settings.position === 'right' 
    ? 'right-0 rounded-l-xl' 
    : 'left-0 rounded-r-xl';

  const toggleButtonPosition = settings.position === 'right'
    ? 'right-0 rounded-l-lg'
    : 'left-0 rounded-r-lg';

  return (
    <>
      {/* Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-1/2 -translate-y-1/2 z-40 p-2 shadow-lg transition-all duration-300 ${toggleButtonPosition} ${buttonColorClasses[settings.colorScheme]} ${settings.showOnMobile ? '' : 'hidden md:block'}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isOpen ? 'Close friendly sites' : 'Open friendly sites'}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              {settings.position === 'right' ? (
                isOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />
              ) : (
                isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side={settings.position === 'right' ? 'left' : 'right'}>
            <p>{isOpen ? 'Close' : 'Partner Sites'}</p>
          </TooltipContent>
        </Tooltip>
      </motion.button>

      {/* Sidebar Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={animationVariants[settings.animationType]}
            transition={{ duration: 0.3 }}
            className={`fixed top-1/2 -translate-y-1/2 z-50 ${positionClasses} ${sizeClasses[settings.size]} ${colorClasses[settings.colorScheme]} border p-4 shadow-xl ${settings.showOnMobile ? '' : 'hidden md:block'}`}
          >
            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/50 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Header */}
            <h3 className="font-semibold text-foreground mb-4 pr-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Partner Sites
            </h3>

            {/* Website list */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {websites.map((website, index) => (
                <motion.a
                  key={website.id}
                  href={website.url}
                  target={website.open_in_new_tab ? '_blank' : '_self'}
                  rel={website.open_in_new_tab ? 'noopener noreferrer' : undefined}
                  className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50 hover:border-primary/30 hover:bg-background/80 transition-all duration-200 group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ x: 4 }}
                >
                  {website.icon_url ? (
                    <img 
                      src={website.icon_url} 
                      alt={website.name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-semibold text-sm">
                        {website.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {website.name}
                    </p>
                    {website.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {website.description}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.a>
              ))}
            </div>

            {/* Decorative elements */}
            <div className="absolute -bottom-2 -right-2 w-16 h-16 bg-primary/10 rounded-full blur-xl" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FriendlyWebsitesWidget;
