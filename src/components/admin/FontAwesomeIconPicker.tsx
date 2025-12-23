import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Popular Font Awesome icons organized by category
const iconCategories = {
  popular: [
    'fa-home', 'fa-user', 'fa-cog', 'fa-envelope', 'fa-bell', 'fa-heart',
    'fa-star', 'fa-search', 'fa-plus', 'fa-check', 'fa-times', 'fa-edit',
    'fa-trash', 'fa-download', 'fa-upload', 'fa-file', 'fa-folder', 'fa-image',
    'fa-calendar', 'fa-clock', 'fa-chart-bar', 'fa-chart-line', 'fa-chart-pie',
    'fa-dashboard', 'fa-list', 'fa-table', 'fa-database', 'fa-server', 'fa-cloud'
  ],
  communication: [
    'fa-envelope', 'fa-phone', 'fa-comment', 'fa-comments', 'fa-paper-plane',
    'fa-inbox', 'fa-reply', 'fa-share', 'fa-bell', 'fa-megaphone'
  ],
  interface: [
    'fa-bars', 'fa-cog', 'fa-sliders', 'fa-filter', 'fa-sort', 'fa-expand',
    'fa-compress', 'fa-eye', 'fa-eye-slash', 'fa-lock', 'fa-unlock', 'fa-key'
  ],
  media: [
    'fa-image', 'fa-camera', 'fa-video', 'fa-music', 'fa-play', 'fa-pause',
    'fa-stop', 'fa-volume-up', 'fa-volume-down', 'fa-film', 'fa-microphone'
  ],
  files: [
    'fa-file', 'fa-file-alt', 'fa-file-pdf', 'fa-file-word', 'fa-file-excel',
    'fa-file-code', 'fa-file-archive', 'fa-folder', 'fa-folder-open', 'fa-copy'
  ],
  arrows: [
    'fa-arrow-up', 'fa-arrow-down', 'fa-arrow-left', 'fa-arrow-right',
    'fa-chevron-up', 'fa-chevron-down', 'fa-chevron-left', 'fa-chevron-right',
    'fa-angle-up', 'fa-angle-down', 'fa-caret-up', 'fa-caret-down'
  ],
  brands: [
    'fa-facebook', 'fa-twitter', 'fa-instagram', 'fa-linkedin', 'fa-github',
    'fa-youtube', 'fa-discord', 'fa-slack', 'fa-google', 'fa-apple',
    'fa-amazon', 'fa-spotify', 'fa-paypal', 'fa-stripe'
  ],
};

interface FontAwesomeIconPickerProps {
  value?: string;
  onChange: (iconClass: string) => void;
  trigger?: React.ReactNode;
}

const FontAwesomeIconPicker = ({ value, onChange, trigger }: FontAwesomeIconPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('popular');

  const allIcons = useMemo(() => {
    const all = Object.values(iconCategories).flat();
    return [...new Set(all)];
  }, []);

  const filteredIcons = useMemo(() => {
    const icons = selectedCategory === 'all' 
      ? allIcons 
      : iconCategories[selectedCategory as keyof typeof iconCategories] || [];
    
    if (!search) return icons;
    return icons.filter(icon => icon.toLowerCase().includes(search.toLowerCase()));
  }, [search, selectedCategory, allIcons]);

  const handleSelect = (iconClass: string) => {
    const prefix = selectedCategory === 'brands' ? 'fab' : 'fas';
    onChange(`${prefix} ${iconClass}`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            {value ? (
              <>
                <i className={value} />
                <span className="text-xs text-muted-foreground">{value}</span>
              </>
            ) : (
              <>
                <i className="fas fa-icons" />
                Select Icon
              </>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <i className="fas fa-icons text-primary" />
            Font Awesome Icon Picker
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search icons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearch('')}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>

          {/* Category Tabs */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="flex-wrap h-auto gap-1 bg-secondary/50 p-1">
              <TabsTrigger value="popular" className="text-xs">Popular</TabsTrigger>
              <TabsTrigger value="communication" className="text-xs">Communication</TabsTrigger>
              <TabsTrigger value="interface" className="text-xs">Interface</TabsTrigger>
              <TabsTrigger value="media" className="text-xs">Media</TabsTrigger>
              <TabsTrigger value="files" className="text-xs">Files</TabsTrigger>
              <TabsTrigger value="arrows" className="text-xs">Arrows</TabsTrigger>
              <TabsTrigger value="brands" className="text-xs">Brands</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Selected Icon Preview */}
          {value && (
            <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <i className={`${value} text-2xl text-primary`} />
              </div>
              <div>
                <p className="text-sm font-medium">Selected Icon</p>
                <code className="text-xs text-muted-foreground">{value}</code>
              </div>
            </div>
          )}

          {/* Icons Grid */}
          <ScrollArea className="h-64">
            <div className="grid grid-cols-8 sm:grid-cols-10 gap-2">
              <AnimatePresence mode="popLayout">
                {filteredIcons.map((icon) => {
                  const prefix = selectedCategory === 'brands' ? 'fab' : 'fas';
                  const fullClass = `${prefix} ${icon}`;
                  const isSelected = value === fullClass;
                  
                  return (
                    <motion.button
                      key={icon}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSelect(icon)}
                      className={`p-3 rounded-lg border transition-all duration-200 flex items-center justify-center ${
                        isSelected
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-secondary/30 border-border hover:border-primary/50 hover:bg-secondary/50 text-foreground'
                      }`}
                      title={icon}
                    >
                      <i className={`${prefix} ${icon} text-lg`} />
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
            
            {filteredIcons.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <i className="fas fa-search text-2xl mb-2" />
                <p>No icons found for "{search}"</p>
              </div>
            )}
          </ScrollArea>

          {/* Usage Hint */}
          <div className="text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3">
            <p><strong>Tip:</strong> Use <code className="bg-secondary px-1 rounded">fas</code> for solid icons and <code className="bg-secondary px-1 rounded">fab</code> for brand icons.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FontAwesomeIconPicker;