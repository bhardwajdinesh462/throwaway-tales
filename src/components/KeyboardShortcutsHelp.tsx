import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShortcutItem {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
}

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutItem[];
}

const KeyboardShortcutsHelp = ({ isOpen, onClose, shortcuts }: KeyboardShortcutsHelpProps) => {
  const formatKey = (shortcut: ShortcutItem) => {
    const keys: string[] = [];
    if (shortcut.ctrl) keys.push('Ctrl');
    if (shortcut.alt) keys.push('Alt');
    if (shortcut.shift) keys.push('Shift');
    keys.push(shortcut.key.toUpperCase());
    return keys;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Keyboard className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h2>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Shortcuts List */}
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  {shortcuts.map((shortcut, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <span className="text-sm text-foreground">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {formatKey(shortcut).map((key, i) => (
                          <span key={i} className="flex items-center">
                            {i > 0 && <span className="text-muted-foreground text-xs mx-1">+</span>}
                            <kbd className="px-2 py-1 text-xs font-mono bg-secondary border border-border rounded shadow-sm">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  ))}

                  {/* Help shortcut */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: shortcuts.length * 0.03 }}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-primary/10 border border-primary/20"
                  >
                    <span className="text-sm text-foreground">Show/Hide this help</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-secondary border border-border rounded shadow-sm">
                      ?
                    </kbd>
                  </motion.div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-border bg-secondary/20">
                <p className="text-xs text-muted-foreground text-center">
                  Press <kbd className="px-1 py-0.5 text-xs font-mono bg-secondary border border-border rounded">?</kbd> anytime to toggle this help
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default KeyboardShortcutsHelp;
