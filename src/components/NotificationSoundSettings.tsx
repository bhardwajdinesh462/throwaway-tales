import { Volume2, VolumeX, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotificationSounds, SoundTone } from "@/hooks/useNotificationSounds";
import { cn } from "@/lib/utils";

const TONE_LABELS: Record<SoundTone, { name: string; description: string }> = {
  default: { name: 'Default', description: 'Classic notification chime' },
  chime: { name: 'Chime', description: 'Bright and cheerful' },
  bell: { name: 'Bell', description: 'Warm and friendly' },
  pop: { name: 'Pop', description: 'Quick and snappy' },
  digital: { name: 'Digital', description: 'Modern tech sound' },
  gentle: { name: 'Gentle', description: 'Soft and subtle' },
  none: { name: 'None', description: 'Silent notifications' },
};

const NotificationSoundSettings = () => {
  const { settings, updateSettings, previewSound, availableTones } = useNotificationSounds();

  return (
    <Card className="glass-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {settings.enabled ? (
            <Volume2 className="w-5 h-5 text-primary" />
          ) : (
            <VolumeX className="w-5 h-5 text-muted-foreground" />
          )}
          Notification Sounds
        </CardTitle>
        <CardDescription>
          Customize the sound played when you receive new emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">Enable Sound Notifications</p>
            <p className="text-sm text-muted-foreground">Play a sound when new emails arrive</p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) => updateSettings({ enabled })}
          />
        </div>

        {/* Volume Slider */}
        {settings.enabled && settings.tone !== 'none' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-foreground">Volume</p>
              <span className="text-sm text-muted-foreground">{Math.round(settings.volume * 100)}%</span>
            </div>
            <Slider
              value={[settings.volume * 100]}
              onValueChange={([value]) => updateSettings({ volume: value / 100 })}
              max={100}
              step={5}
              className="w-full"
            />
          </div>
        )}

        {/* Tone Selection */}
        {settings.enabled && (
          <div className="space-y-3">
            <p className="font-medium text-foreground">Notification Tone</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {availableTones.map((tone) => (
                <button
                  key={tone}
                  onClick={() => updateSettings({ tone })}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all",
                    settings.tone === tone
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/30 hover:border-primary/50"
                  )}
                >
                  <div className="text-left">
                    <p className={cn(
                      "font-medium text-sm",
                      settings.tone === tone ? "text-primary" : "text-foreground"
                    )}>
                      {TONE_LABELS[tone].name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {TONE_LABELS[tone].description}
                    </p>
                  </div>
                  {tone !== 'none' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        previewSound(tone);
                      }}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationSoundSettings;
