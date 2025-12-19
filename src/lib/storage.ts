// Local Storage Keys
export const STORAGE_KEYS = {
  USER: 'nullsto_user',
  USERS_DB: 'nullsto_users',
  DOMAINS: 'nullsto_domains',
  TEMP_EMAILS: 'nullsto_temp_emails',
  RECEIVED_EMAILS: 'nullsto_received_emails',
  SAVED_EMAILS: 'nullsto_saved_emails',
  SETTINGS: 'nullsto_settings',
  BLOGS: 'nullsto_blogs',
  PAGES: 'nullsto_pages',
  THEME: 'nullsto_theme',
  LANGUAGE: 'nullsto_language',
} as const;

// Generic storage functions
export const storage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  
  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage error:', error);
    }
  },
  
  remove: (key: string): void => {
    localStorage.removeItem(key);
  },
};

// Initialize default data
export const initializeDefaultData = () => {
  // Default domains - always reset to nullsto.edu.pl
  storage.set(STORAGE_KEYS.DOMAINS, [
    { id: '1', name: '@nullsto.edu.pl', is_active: true, is_premium: false, created_at: new Date().toISOString() },
  ]);

  // Default settings
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    storage.set(STORAGE_KEYS.SETTINGS, {
      emailExpiration: 60,
      maxEmailsPerUser: 10,
      allowAnonymous: true,
      requireCaptcha: false,
      enableNotifications: true,
      maintenanceMode: false,
      welcomeMessage: 'Welcome to Nullsto! Generate instant, anonymous email addresses.',
      footerText: '© 2024 Nullsto. All rights reserved.',
      customDomainEnabled: true,
    });
  }

  // Default blogs
  if (!localStorage.getItem(STORAGE_KEYS.BLOGS)) {
    storage.set(STORAGE_KEYS.BLOGS, [
      {
        id: '1',
        title: 'Why Temporary Emails Are Essential for Online Privacy',
        slug: 'temp-emails-privacy',
        excerpt: 'In an age of data breaches and spam, temporary emails provide a crucial layer of privacy protection...',
        content: 'Full article content here...',
        author: 'Alex Chen',
        category: 'Privacy',
        published: true,
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        title: '10 Ways to Use Disposable Emails Effectively',
        slug: 'disposable-emails-tips',
        excerpt: 'From testing to signing up for newsletters, discover the best use cases for temporary email addresses...',
        content: 'Full article content here...',
        author: 'Sarah Johnson',
        category: 'Tips',
        published: true,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  // Default pages
  if (!localStorage.getItem(STORAGE_KEYS.PAGES)) {
    storage.set(STORAGE_KEYS.PAGES, [
      { id: '1', title: 'About Us', slug: 'about', content: 'About Nullsto...', published: true },
      { id: '2', title: 'Privacy Policy', slug: 'privacy', content: 'Privacy policy content...', published: true },
      { id: '3', title: 'Terms of Service', slug: 'terms', content: 'Terms of service...', published: true },
    ]);
  }

  // Initialize empty arrays if not exist
  if (!localStorage.getItem(STORAGE_KEYS.USERS_DB)) {
    storage.set(STORAGE_KEYS.USERS_DB, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.TEMP_EMAILS)) {
    storage.set(STORAGE_KEYS.TEMP_EMAILS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.RECEIVED_EMAILS)) {
    storage.set(STORAGE_KEYS.RECEIVED_EMAILS, []);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SAVED_EMAILS)) {
    storage.set(STORAGE_KEYS.SAVED_EMAILS, []);
  }
};

// Generate unique ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Generate random string for email
export const generateRandomString = (length: number): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};