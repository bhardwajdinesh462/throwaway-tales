import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { storage } from "@/lib/storage";

export type SoundTone = 'default' | 'chime' | 'bell' | 'pop' | 'digital' | 'gentle' | 'none';

interface SoundSettings {
  enabled: boolean;
  tone: SoundTone;
  volume: number;
}

const SOUND_FREQUENCIES: Record<SoundTone, number[]> = {
  default: [523.25, 659.25, 783.99], // C5-E5-G5 major chord
  chime: [880, 1108.73, 1318.51], // A5-C#6-E6 bright
  bell: [440, 554.37, 659.25], // A4-C#5-E5 warm
  pop: [600, 800, 1000], // Quick ascending
  digital: [440, 880, 440], // Octave bounce
  gentle: [392, 493.88, 587.33], // G4-B4-D5 soft
  none: [],
};

const STORAGE_KEY = 'notification_sound_settings';

export const useNotificationSounds = () => {
  const { user } = useAuth();
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const [settings, setSettings] = useState<SoundSettings>({
    enabled: true,
    tone: 'default',
    volume: 0.5,
  });

  // Load settings
  useEffect(() => {
    const key = user ? `${STORAGE_KEY}_${user.id}` : STORAGE_KEY;
    const saved = storage.get<SoundSettings>(key, {
      enabled: true,
      tone: 'default',
      volume: 0.5,
    });
    setSettings(saved);
  }, [user]);

  // Save settings
  const updateSettings = useCallback((newSettings: Partial<SoundSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      const key = user ? `${STORAGE_KEY}_${user.id}` : STORAGE_KEY;
      storage.set(key, updated);
      return updated;
    });
  }, [user]);

  // Initialize audio context lazily
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Play notification sound
  const playSound = useCallback((overrideTone?: SoundTone) => {
    if (!settings.enabled && !overrideTone) return;
    
    const tone = overrideTone || settings.tone;
    if (tone === 'none') return;

    const frequencies = SOUND_FREQUENCIES[tone];
    if (!frequencies.length) return;

    try {
      const audioContext = getAudioContext();
      
      // Resume context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const masterGain = audioContext.createGain();
      masterGain.connect(audioContext.destination);
      masterGain.gain.setValueAtTime(settings.volume * 0.3, audioContext.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(masterGain);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
        oscillator.type = tone === 'digital' ? 'square' : 'sine';
        
        const startTime = audioContext.currentTime + (index * 0.08);
        const duration = 0.15;
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.8, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration + 0.1);
      });
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, [settings.enabled, settings.tone, settings.volume, getAudioContext]);

  // Preview sound (always plays regardless of enabled setting)
  const previewSound = useCallback((tone: SoundTone) => {
    if (tone === 'none') return;
    playSound(tone);
  }, [playSound]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    settings,
    updateSettings,
    playSound,
    previewSound,
    availableTones: Object.keys(SOUND_FREQUENCIES) as SoundTone[],
  };
};

export default useNotificationSounds;
