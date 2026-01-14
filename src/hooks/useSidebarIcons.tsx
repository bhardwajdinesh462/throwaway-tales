import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface SidebarIconsMap {
  [key: string]: string; // url path -> icon class
}

const STORAGE_KEY = 'sidebar_icons';

export const useSidebarIcons = () => {
  const [icons, setIcons] = useState<SidebarIconsMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load icons from app_settings
  const loadIcons = useCallback(async () => {
    try {
      const { data, error } = await api.db.query<{ value: SidebarIconsMap }[]>('app_settings', {
        select: 'value',
        filter: { key: STORAGE_KEY },
        limit: 1,
      });

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading sidebar icons:', error);
        return;
      }

      if (data && data.length > 0 && data[0].value && typeof data[0].value === 'object') {
        setIcons(data[0].value);
      }
    } catch (err) {
      console.error('Error loading sidebar icons:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIcons();
  }, [loadIcons]);

  // Save icon for a specific menu item
  const setIcon = useCallback(async (menuUrl: string, iconClass: string) => {
    setIsSaving(true);
    const newIcons = { ...icons, [menuUrl]: iconClass };
    
    try {
      // Check if setting exists
      const { data: existing } = await api.db.query<{ id: string }[]>('app_settings', {
        select: 'id',
        filter: { key: STORAGE_KEY },
        limit: 1,
      });

      if (existing && existing.length > 0) {
        await api.db.update('app_settings', 
          { value: newIcons, updated_at: new Date().toISOString() },
          { key: STORAGE_KEY }
        );
      } else {
        await api.db.insert('app_settings', { key: STORAGE_KEY, value: newIcons });
      }

      setIcons(newIcons);
      return true;
    } catch (err) {
      console.error('Error saving sidebar icon:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [icons]);

  // Get icon class for a menu item
  const getIcon = useCallback((menuUrl: string): string | undefined => {
    return icons[menuUrl];
  }, [icons]);

  // Remove icon for a specific menu item
  const removeIcon = useCallback(async (menuUrl: string) => {
    const newIcons = { ...icons };
    delete newIcons[menuUrl];
    
    try {
      await api.db.update('app_settings', 
        { value: newIcons, updated_at: new Date().toISOString() },
        { key: STORAGE_KEY }
      );
      
      setIcons(newIcons);
      return true;
    } catch (err) {
      console.error('Error removing sidebar icon:', err);
      return false;
    }
  }, [icons]);

  return {
    icons,
    isLoading,
    isSaving,
    setIcon,
    getIcon,
    removeIcon,
    refreshIcons: loadIcons,
  };
};

export default useSidebarIcons;
