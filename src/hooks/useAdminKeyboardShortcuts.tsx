import { useEffect, useCallback } from "react";

interface AdminKeyboardShortcutsOptions {
  onRefresh?: () => void;
  onNew?: () => void;
  onSearch?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

export const useAdminKeyboardShortcuts = ({
  onRefresh,
  onNew,
  onSearch,
  onEscape,
  enabled = true,
}: AdminKeyboardShortcutsOptions) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Only allow Escape in inputs
        if (event.key === "Escape" && onEscape) {
          onEscape();
        }
        return;
      }

      // Prevent shortcuts when modifiers are pressed (except for specific combos)
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "r":
          event.preventDefault();
          onRefresh?.();
          break;
        case "n":
          event.preventDefault();
          onNew?.();
          break;
        case "/":
        case "s":
          if (onSearch) {
            event.preventDefault();
            onSearch();
          }
          break;
        case "escape":
          onEscape?.();
          break;
      }
    },
    [enabled, onRefresh, onNew, onSearch, onEscape]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
};

export default useAdminKeyboardShortcuts;
