import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storage, STORAGE_KEYS } from '@/lib/storage';

export interface ThemeColors {
  primary: string;
  accent: string;
  background: string;
  card: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  isDark: boolean;
  category?: 'default' | 'gradient' | 'glass' | 'minimal' | 'vibrant' | 'elegant';
}

const defaultThemes: Theme[] = [
  // Default Themes
  {
    id: 'cyber-dark',
    name: 'Cyber Dark',
    colors: {
      primary: '175 80% 50%',
      accent: '280 70% 55%',
      background: '222 47% 5%',
      card: '222 47% 8%',
    },
    isDark: true,
    category: 'default',
  },
  {
    id: 'ocean-dark',
    name: 'Ocean Dark',
    colors: {
      primary: '200 80% 50%',
      accent: '230 70% 55%',
      background: '220 47% 5%',
      card: '220 47% 8%',
    },
    isDark: true,
    category: 'default',
  },
  {
    id: 'emerald-dark',
    name: 'Emerald Dark',
    colors: {
      primary: '150 80% 45%',
      accent: '170 70% 55%',
      background: '160 40% 5%',
      card: '160 40% 8%',
    },
    isDark: true,
    category: 'default',
  },
  {
    id: 'sunset-dark',
    name: 'Sunset Dark',
    colors: {
      primary: '25 90% 55%',
      accent: '350 80% 55%',
      background: '20 30% 5%',
      card: '20 30% 8%',
    },
    isDark: true,
    category: 'default',
  },
  {
    id: 'light-minimal',
    name: 'Light Minimal',
    colors: {
      primary: '220 70% 50%',
      accent: '280 70% 55%',
      background: '0 0% 100%',
      card: '0 0% 98%',
    },
    isDark: false,
    category: 'minimal',
  },
  // Gradient Themes
  {
    id: 'gradient-sunset',
    name: 'Gradient Sunset',
    colors: {
      primary: '25 95% 53%',
      accent: '330 80% 55%',
      background: '15 25% 6%',
      card: '15 25% 10%',
    },
    isDark: true,
    category: 'gradient',
  },
  {
    id: 'gradient-ocean',
    name: 'Gradient Ocean',
    colors: {
      primary: '190 90% 50%',
      accent: '210 85% 60%',
      background: '200 50% 5%',
      card: '200 50% 9%',
    },
    isDark: true,
    category: 'gradient',
  },
  {
    id: 'gradient-aurora',
    name: 'Gradient Aurora',
    colors: {
      primary: '160 80% 50%',
      accent: '280 70% 60%',
      background: '180 40% 5%',
      card: '180 40% 8%',
    },
    isDark: true,
    category: 'gradient',
  },
  // Glass Themes
  {
    id: 'glass-dark',
    name: 'Glass Morphism Dark',
    colors: {
      primary: '210 100% 60%',
      accent: '280 85% 65%',
      background: '230 25% 8%',
      card: '230 30% 15%',
    },
    isDark: true,
    category: 'glass',
  },
  {
    id: 'glass-light',
    name: 'Glass Morphism Light',
    colors: {
      primary: '220 90% 55%',
      accent: '260 80% 60%',
      background: '220 20% 97%',
      card: '220 30% 92%',
    },
    isDark: false,
    category: 'glass',
  },
  // Minimal Themes
  {
    id: 'minimal-dark',
    name: 'Minimal Dark',
    colors: {
      primary: '220 15% 50%',
      accent: '220 20% 60%',
      background: '220 20% 7%',
      card: '220 20% 11%',
    },
    isDark: true,
    category: 'minimal',
  },
  {
    id: 'minimal-pure',
    name: 'Minimal Pure',
    colors: {
      primary: '0 0% 20%',
      accent: '0 0% 40%',
      background: '0 0% 100%',
      card: '0 0% 97%',
    },
    isDark: false,
    category: 'minimal',
  },
  // Vibrant Themes
  {
    id: 'neon-glow',
    name: 'Neon Glow',
    colors: {
      primary: '320 100% 60%',
      accent: '180 100% 50%',
      background: '270 30% 5%',
      card: '270 30% 10%',
    },
    isDark: true,
    category: 'vibrant',
  },
  {
    id: 'electric-blue',
    name: 'Electric Blue',
    colors: {
      primary: '200 100% 55%',
      accent: '340 90% 60%',
      background: '220 40% 6%',
      card: '220 40% 10%',
    },
    isDark: true,
    category: 'vibrant',
  },
  // Elegant Themes
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      primary: '140 50% 40%',
      accent: '35 60% 50%',
      background: '150 30% 6%',
      card: '150 30% 10%',
    },
    isDark: true,
    category: 'elegant',
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    colors: {
      primary: '350 60% 65%',
      accent: '40 50% 60%',
      background: '340 20% 8%',
      card: '340 20% 12%',
    },
    isDark: true,
    category: 'elegant',
  },
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    colors: {
      primary: '210 70% 55%',
      accent: '200 60% 60%',
      background: '220 50% 5%',
      card: '220 50% 9%',
    },
    isDark: true,
    category: 'elegant',
  },
  {
    id: 'lavender-dreams',
    name: 'Lavender Dreams',
    colors: {
      primary: '270 60% 60%',
      accent: '300 50% 65%',
      background: '260 30% 95%',
      card: '260 35% 90%',
    },
    isDark: false,
    category: 'elegant',
  },
];

interface ThemeContextType {
  theme: Theme;
  themes: Theme[];
  setTheme: (themeId: string) => void;
  addCustomTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themes, setThemes] = useState<Theme[]>(defaultThemes);
  const [currentThemeId, setCurrentThemeId] = useState<string>(() => {
    return storage.get(STORAGE_KEYS.THEME, 'cyber-dark');
  });

  const theme = themes.find(t => t.id === currentThemeId) || themes[0];

  useEffect(() => {
    // Apply theme colors to CSS variables
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.colors.primary);
    root.style.setProperty('--accent', theme.colors.accent);
    root.style.setProperty('--background', theme.colors.background);
    root.style.setProperty('--card', theme.colors.card);
    
    // Set dark/light mode
    if (theme.isDark) {
      root.classList.add('dark');
      root.style.setProperty('--foreground', '210 40% 98%');
      root.style.setProperty('--muted-foreground', '215 20% 55%');
      root.style.setProperty('--border', '222 30% 18%');
    } else {
      root.classList.remove('dark');
      root.style.setProperty('--foreground', '222 47% 11%');
      root.style.setProperty('--muted-foreground', '215 16% 47%');
      root.style.setProperty('--border', '214 32% 91%');
    }

    // Add glass morphism class for glass themes
    if (theme.category === 'glass') {
      root.classList.add('theme-glass');
    } else {
      root.classList.remove('theme-glass');
    }

    // Add gradient class for gradient themes
    if (theme.category === 'gradient') {
      root.classList.add('theme-gradient');
    } else {
      root.classList.remove('theme-gradient');
    }
  }, [theme]);

  const setTheme = (themeId: string) => {
    setCurrentThemeId(themeId);
    storage.set(STORAGE_KEYS.THEME, themeId);
  };

  const addCustomTheme = (newTheme: Theme) => {
    setThemes([...themes, newTheme]);
  };

  return (
    <ThemeContext.Provider value={{ theme, themes, setTheme, addCustomTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
