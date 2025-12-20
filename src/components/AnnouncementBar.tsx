import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Crown, MessageCircle } from "lucide-react";

const AnnouncementBar = () => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
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
                {/* Guest offer */}
                <span className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider">
                    New
                  </span>
                  <span>Guest can create 5 free Emails in a day</span>
                </span>

                {/* Separator */}
                <span className="hidden sm:inline-block w-px h-4 bg-white/30" />

                {/* Premium offer */}
                <span className="flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-yellow-300" />
                  <span>Premium Plan is live!</span>
                  <a
                    href="https://t.me/nullstoemail"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="font-semibold">Contact on Telegram</span>
                  </a>
                </span>
              </motion.div>
            </div>

            {/* Right sparkle */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
            </motion.div>

            {/* Close button */}
            <motion.button
              onClick={() => setIsVisible(false)}
              className="absolute right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* Bottom glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      </motion.div>
    </AnimatePresence>
  );
};

export default AnnouncementBar;
