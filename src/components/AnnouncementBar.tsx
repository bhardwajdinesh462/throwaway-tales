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

      <div className="relative container mx-auto px-4">
        <div className="flex items-center justify-center gap-2 py-2.5 text-primary-foreground">
          {/* Left sparkle */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
          </motion.div>

          {/* Announcement text with marquee on mobile */}
          <div className="flex items-center gap-3 text-sm font-medium overflow-hidden">
            <motion.div
              className="flex items-center gap-3 whitespace-nowrap md:whitespace-normal"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              {/* Main message */}
              <span className="flex items-center gap-1.5">
                {settings.badgeText && (
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider">
                    {settings.badgeText}
                  </span>
                )}
                <span>{settings.mainMessage}</span>
              </span>

              {/* CTA section */}
              {settings.ctaText && (
                <>
                  {/* Separator */}
                  <span className="hidden sm:inline-block w-px h-4 bg-white/30" />

                  {/* CTA */}
                  <span className="flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-yellow-300" />
                    {settings.ctaLink ? (
                      <a href={settings.ctaLink} className="hover:underline">
                        {settings.ctaText}
                      </a>
                    ) : (
                      <span>{settings.ctaText}</span>
                    )}
                    {settings.showTelegramButton && (
                      <a
                        href={settings.telegramLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span className="font-semibold">{settings.telegramText}</span>
                      </a>
                    )}
                  </span>
                </>
              )}
            </motion.div>
          </div>

          {/* Right sparkle */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="w-4 h-4 text-yellow-300" />
          </motion.div>
        </div>
      </div>

      {/* Bottom glow line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
    </motion.div>
  );
};

export default AnnouncementBar;
