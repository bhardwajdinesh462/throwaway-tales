import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';

const LANGUAGES_KEY = 'trashmails_languages';

export interface Language {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  rtl: boolean;
  enabled: boolean;
  isDefault: boolean;
}

const defaultLanguages: Language[] = [
  { id: '1', code: 'en', name: 'English', nativeName: 'English', rtl: false, enabled: true, isDefault: true },
  { id: '2', code: 'ar', name: 'Arabic', nativeName: 'العربية', rtl: true, enabled: true, isDefault: false },
  { id: '3', code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false, enabled: true, isDefault: false },
  { id: '4', code: 'fr', name: 'French', nativeName: 'Français', rtl: false, enabled: true, isDefault: false },
];

export const useLanguageSettings = () => {
  const [languages, setLanguages] = useState<Language[]>(defaultLanguages);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const { data, error } = await api.db.query<{ value: Language[] }[]>('app_settings', {
          filter: { key: 'languages' },
          order: { column: 'updated_at', ascending: false },
          limit: 1
        });

        if (!error && data && data.length > 0) {
          const dbLanguages = data[0].value as unknown as Language[];
          setLanguages(dbLanguages);
          storage.set(LANGUAGES_KEY, dbLanguages);
        } else {
          const localLanguages = storage.get<Language[]>(LANGUAGES_KEY, defaultLanguages);
          setLanguages(localLanguages);
        }
      } catch (e) {
        console.error('Error loading languages:', e);
        const localLanguages = storage.get<Language[]>(LANGUAGES_KEY, defaultLanguages);
        setLanguages(localLanguages);
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguages();
  }, []);

  const defaultLanguage = languages.find(l => l.isDefault) || languages[0];
  const enabledLanguages = languages.filter(l => l.enabled);

  return { languages, defaultLanguage, enabledLanguages, isLoading };
};

export default useLanguageSettings;
