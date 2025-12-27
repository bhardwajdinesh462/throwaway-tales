import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Search, Check } from "lucide-react";
import * as LucideIcons from "lucide-react";

// Get all icon names from lucide-react
const iconNames = Object.keys(LucideIcons).filter(
  (key) => 
    key !== "createLucideIcon" && 
    key !== "default" &&
    typeof (LucideIcons as any)[key] === "function" &&
    key[0] === key[0].toUpperCase()
);

interface LucideIconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  trigger?: React.ReactNode;
}

export default function LucideIconPicker({ value, onChange, trigger }: LucideIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredIcons = useMemo(() => {
    if (!search) return iconNames.slice(0, 100); // Show first 100 by default
    return iconNames.filter((name) =>
      name.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 100);
  }, [search]);

  const renderIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName];
    if (!Icon) return null;
    return <Icon className="w-5 h-5" />;
  };

  const SelectedIcon = value ? (LucideIcons as any)[value] : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full justify-start gap-2">
            {SelectedIcon ? (
              <>
                <SelectedIcon className="w-4 h-4" />
                <span>{value}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Select icon...</span>
            )}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search icons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <ScrollArea className="h-64">
          <div className="grid grid-cols-6 gap-1 p-2">
            {filteredIcons.map((iconName) => (
              <button
                key={iconName}
                onClick={() => {
                  onChange(iconName);
                  setOpen(false);
                }}
                className={`p-2 rounded-md hover:bg-secondary transition-colors flex items-center justify-center ${
                  value === iconName ? "bg-primary/20 ring-2 ring-primary" : ""
                }`}
                title={iconName}
              >
                {renderIcon(iconName)}
                {value === iconName && (
                  <Check className="w-3 h-3 absolute top-0 right-0 text-primary" />
                )}
              </button>
            ))}
          </div>
          {filteredIcons.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No icons found
            </p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// Helper component to render a Lucide icon by name
export function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as any)[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}
