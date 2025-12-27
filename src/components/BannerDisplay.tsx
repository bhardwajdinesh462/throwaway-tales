import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";

interface Banner {
  id: string;
  name: string;
  position: string;
  type: "image" | "html" | "script" | "text";
  content: string | null;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
  priority: number;
  start_date: string | null;
  end_date: string | null;
}

interface BannerDisplayProps {
  position: "header" | "sidebar" | "content" | "footer";
  className?: string;
}

const BannerDisplay = ({ position, className = "" }: BannerDisplayProps) => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBanners = useCallback(async (attempt = 0) => {
    const maxRetries = 3;
    const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
    
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("banners")
        .select("id, name, position, type, content, image_url, link_url, is_active, priority, start_date, end_date")
        .eq("position", position)
        .eq("is_active", true)
        .order("priority", { ascending: false });

      if (error) {
        const isRetryable = error.message?.includes('Failed to fetch') || 
                            error.message?.includes('fetch') ||
                            error.message?.includes('timeout');
        
        if (isRetryable && attempt < maxRetries) {
          console.log(`[BannerDisplay] Retrying in ${backoffMs}ms (attempt ${attempt + 1})...`);
          setTimeout(() => fetchBanners(attempt + 1), backoffMs);
          return;
        }
        console.error("Error fetching banners:", error);
        setIsLoading(false);
        return;
      }

      // Filter by date range on client side
      const activeBanners = (data || []).filter((banner) => {
        const startOk = !banner.start_date || new Date(banner.start_date) <= new Date(now);
        const endOk = !banner.end_date || new Date(banner.end_date) >= new Date(now);
        return startOk && endOk;
      }) as Banner[];

      setBanners(activeBanners);
      setIsLoading(false);
    } catch (err: any) {
      console.error("Failed to fetch banners:", err);
      if (attempt < maxRetries) {
        setTimeout(() => fetchBanners(attempt + 1), backoffMs);
        return;
      }
      setIsLoading(false);
    }
  }, [position]);

  useEffect(() => {
    let cancelled = false;
    
    const doFetch = async () => {
      if (!cancelled) await fetchBanners();
    };
    
    doFetch();

    // Subscribe to real-time banner changes - use stable channel name
    const channelName = `banners_realtime_${position}`;
    const channel = supabase.channel(channelName);
    
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'banners',
        },
        (payload) => {
          if (!cancelled) {
            console.log('[BannerDisplay] Realtime update received:', payload.eventType);
            fetchBanners();
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      // Use unsubscribe instead of removeChannel to avoid stack overflow
      channel.unsubscribe();
    };
  }, [position, fetchBanners]);

  const handleBannerClick = async (banner: Banner) => {
    // Track click in database - increment via SQL
    try {
      const { data } = await supabase
        .from("banners")
        .select("click_count")
        .eq("id", banner.id)
        .single();
      
      if (data) {
        await supabase
          .from("banners")
          .update({ click_count: (data.click_count || 0) + 1 })
          .eq("id", banner.id);
      }
    } catch (err) {
      // Silently fail click tracking
    }

    if (banner.link_url) {
      window.open(banner.link_url, "_blank", "noopener,noreferrer");
    }
  };

  const trackView = async (bannerId: string) => {
    try {
      const { data } = await supabase
        .from("banners")
        .select("view_count")
        .eq("id", bannerId)
        .single();
      
      if (data) {
        await supabase
          .from("banners")
          .update({ view_count: (data.view_count || 0) + 1 })
          .eq("id", bannerId);
      }
    } catch (err) {
      // Silently fail view tracking
    }
  };

  useEffect(() => {
    banners.forEach((banner) => trackView(banner.id));
  }, [banners]);

  // Don't render anything if no banners (even while loading, to avoid layout shift)
  if (banners.length === 0) return null;

  const positionStyles: Record<string, string> = {
    header: "w-full py-2",
    sidebar: "w-full",
    content: "w-full my-4",
    footer: "w-full py-2",
  };

  return (
    <div className={`${positionStyles[position]} ${className}`}>
      {banners.map((banner, index) => (
        <motion.div
          key={banner.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 }}
          className={`relative ${banner.link_url ? "cursor-pointer" : ""}`}
          onClick={() => banner.link_url && handleBannerClick(banner)}
        >
          {banner.type === "image" && banner.image_url && (
            <div className="relative group overflow-hidden rounded-lg">
              <img
                src={banner.image_url}
                alt={banner.name}
                className="w-full h-auto object-cover transition-transform group-hover:scale-105"
              />
              {banner.link_url && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>
          )}

          {banner.type === "html" && (
            <div
              className="banner-html-content"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(banner.content || '') }}
            />
          )}

          {banner.type === "text" && (
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20 text-center">
              <p className="text-foreground">{banner.content || ''}</p>
              {banner.link_url && (
                <span className="text-primary text-sm hover:underline">
                  Learn more →
                </span>
              )}
            </div>
          )}

          {banner.type === "script" && (
            <div
              className="banner-script-container"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(banner.content, { ADD_TAGS: ['script'], ADD_ATTR: ['src'] }) }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
};

export default BannerDisplay;