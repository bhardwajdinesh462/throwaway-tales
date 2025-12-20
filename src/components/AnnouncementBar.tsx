import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Crown, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AnnouncementSettings {
  isEnabled: boolean;
  badgeText: string;
  mainMessage: string;
  ctaText: string;
  ctaLink: string;
  showTelegramButton: boolean;
  telegramText: string;
  telegramLink: string;
}

const defaultSettings: AnnouncementSettings = {
  isEnabled: true,
  badgeText: 'New',
  mainMessage: 'Guest can create 5 free Emails in a day',
  ctaText: 'Premium Plan is live!',
  ctaLink: '',
  showTelegramButton: true,
  telegramText: 'Contact on Telegram',
  telegramLink: 'https://t.me/nullstoemail',
};

const AnnouncementBar = () => {
  const [settings, setSettings] = useState<AnnouncementSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'announcement_settings')
          .maybeSingle();

        if (!error && data?.value) {
          const dbSettings = data.value as unknown as AnnouncementSettings;
          setSettings({ ...defaultSettings, ...dbSettings });
        }
      } catch (e) {
        console.error('Error loading announcement settings:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();

    // Real-time subscription for instant updates across all tabs
    const channel = supabase
      .channel('announcement-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.announcement_settings'
        },
        (payload) => {
          console.log('Announcement settings updated:', payload);
          if (payload.new && (payload.new as any).value) {
            const newSettings = (payload.new as any).value as AnnouncementSettings;
            setSettings({ ...defaultSettings, ...newSettings });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (isLoading || !settings.isEnabled) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative overflow-hidden bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-gradient-x"
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            initial={{
              x: Math.random() * 100 + "%",
              y: "100%",
            }}
            animate={{
              y: "-100%",
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Rail shimmer effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{
          x: ["-100%", "200%"],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      <div className="relative container mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 text-primary-foreground">
          {/* Left sparkle - hidden on very small screens */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="hidden xs:block flex-shrink-0"
          >
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-300" />
          </motion.div>

          {/* Announcement text - responsive layout */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-xs sm:text-sm font-medium">
              {/* Main message */}
              <div className="flex items-center gap-1 sm:gap-1.5 truncate max-w-full">
                {settings.badgeText && (
                  <span className="flex-shrink-0 px-1.5 sm:px-2 py-0.5 bg-white/20 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                    {settings.badgeText}
                  </span>
                )}
                <span className="truncate">{settings.mainMessage}</span>
              </div>

              {/* CTA section */}
              {settings.ctaText && (
                <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                  {/* Separator - hidden on mobile */}
                  <span className="hidden sm:inline-block w-px h-4 bg-white/30" />

                  <Crown className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-300 flex-shrink-0" />
                  {settings.ctaLink ? (
                    <a href={settings.ctaLink} className="hover:underline whitespace-nowrap text-xs sm:text-sm">
                      {settings.ctaText}
                    </a>
                  ) : (
                    <span className="whitespace-nowrap text-xs sm:text-sm">{settings.ctaText}</span>
                  )}
                  {settings.showTelegramButton && (
                    <a
                      href={settings.telegramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                    >
                      <MessageCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span className="font-semibold text-xs sm:text-sm">{settings.telegramText}</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right sparkle - hidden on very small screens */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="hidden xs:block flex-shrink-0"
          >
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-300" />
          </motion.div>
        </div>
      </div>

      {/* Bottom glow line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
    </motion.div>
  );
};

export default AnnouncementBar;
