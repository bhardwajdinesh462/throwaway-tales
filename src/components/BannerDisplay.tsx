import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import DOMPurify from "dompurify";

interface Banner {
  id: string;
  name: string;
  position: string;
  type: "image" | "html" | "script" | "text";
  content: string;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
}

interface BannerDisplayProps {
  position: "header" | "sidebar" | "content" | "footer";
  className?: string;
}

const BannerDisplay = ({ position, className = "" }: BannerDisplayProps) => {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    // Load banners from localStorage for shared hosting compatibility
    const loadBanners = () => {
      const stored = localStorage.getItem("nullsto_banners");
      if (stored) {
        const allBanners: Banner[] = JSON.parse(stored);
        const positionBanners = allBanners.filter(
          (b) => b.position === position && b.is_active
        );
        setBanners(positionBanners);
      }
    };

    loadBanners();
    
    // Listen for banner updates
    window.addEventListener("bannersUpdated", loadBanners);
    return () => window.removeEventListener("bannersUpdated", loadBanners);
  }, [position]);

  const handleBannerClick = (banner: Banner) => {
    // Track click
    const stored = localStorage.getItem("nullsto_banners");
    if (stored) {
      const allBanners: Banner[] = JSON.parse(stored);
      const updated = allBanners.map((b) =>
        b.id === banner.id ? { ...b, click_count: (b as any).click_count + 1 } : b
      );
      localStorage.setItem("nullsto_banners", JSON.stringify(updated));
    }

    if (banner.link_url) {
      window.open(banner.link_url, "_blank", "noopener,noreferrer");
    }
  };

  const trackView = (bannerId: string) => {
    const stored = localStorage.getItem("nullsto_banners");
    if (stored) {
      const allBanners: Banner[] = JSON.parse(stored);
      const updated = allBanners.map((b) =>
        b.id === bannerId ? { ...b, view_count: (b as any).view_count + 1 } : b
      );
      localStorage.setItem("nullsto_banners", JSON.stringify(updated));
    }
  };

  useEffect(() => {
    banners.forEach((banner) => trackView(banner.id));
  }, [banners]);

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
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(banner.content) }}
            />
          )}

          {banner.type === "text" && (
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20 text-center">
              <p className="text-foreground">{banner.content}</p>
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
