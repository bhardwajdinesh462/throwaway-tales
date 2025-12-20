import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useSupabaseAuth';
import { toast } from 'sonner';
import { storage } from '@/lib/storage';

export interface Domain {
  id: string;
  name: string;
  is_premium: boolean;
  is_active: boolean;
  is_custom?: boolean;
  created_at: string;
}

export interface TempEmail {
  id: string;
  user_id: string | null;
  address: string;
  domain_id: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
  secret_token?: string;
}

export interface ReceivedEmail {
  id: string;
  temp_email_id: string;
  from_address: string;
  subject: string | null;
  body: string | null;
  html_body: string | null;
  is_read: boolean;
  received_at: string;
}

const TOKEN_STORAGE_KEY = 'nullsto_email_tokens';
const CURRENT_EMAIL_ID_KEY = 'nullsto_current_email_id';
const EMAIL_CREATION_COUNT_KEY = 'nullsto_email_creation_count';

interface EmailCreationCount {
  date: string;
  count: number;
}

const getEmailCreationCount = (): number => {
  const today = new Date().toISOString().split('T')[0];
  const data = storage.get<EmailCreationCount>(EMAIL_CREATION_COUNT_KEY, { date: today, count: 0 });
  if (data.date !== today) {
    return 0;
  }
  return data.count;
};

const incrementEmailCreationCount = () => {
  const today = new Date().toISOString().split('T')[0];
  const data = storage.get<EmailCreationCount>(EMAIL_CREATION_COUNT_KEY, { date: today, count: 0 });
  if (data.date !== today) {
    storage.set(EMAIL_CREATION_COUNT_KEY, { date: today, count: 1 });
  } else {
    storage.set(EMAIL_CREATION_COUNT_KEY, { date: today, count: data.count + 1 });
  }
};

// Helper to store and retrieve tokens locally
const getStoredToken = (tempEmailId: string): string | null => {
  try {
    const tokens = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || '{}');
    return tokens[tempEmailId] || null;
  } catch {
    return null;
  }
};

const storeToken = (tempEmailId: string, token: string) => {
  try {
    const tokens = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || '{}');
    tokens[tempEmailId] = token;
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  } catch (e) {
    console.error('Failed to store token:', e);
  }
};

export const useSecureEmailService = () => {
  const { user } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [currentEmail, setCurrentEmail] = useState<TempEmail | null>(null);
  const [receivedEmails, setReceivedEmails] = useState<ReceivedEmail[]>([]);
  const [emailHistory, setEmailHistory] = useState<TempEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Debug / instance identity (helps verify there is only one provider instance)
  const instanceIdRef = useRef(`${Date.now()}-${Math.random().toString(16).slice(2)}`);

  // Ref to prevent duplicate initialization
  const initStartedRef = useRef(false);

  // Refs to avoid stale async updates when switching addresses
  const currentEmailRef = useRef<TempEmail | null>(null);
  const activeEmailIdRef = useRef<string | null>(null);
  const fetchSeqRef = useRef(0);

  useEffect(() => {
    currentEmailRef.current = currentEmail;
    activeEmailIdRef.current = currentEmail?.id ?? null;
  }, [currentEmail]);

  // Debug logs
  useEffect(() => {
    console.info(`[email-service:${instanceIdRef.current}] mounted`);
    return () => console.info(`[email-service:${instanceIdRef.current}] unmounted`);
  }, []);

  useEffect(() => {
    console.info(
      `[email-service:${instanceIdRef.current}] currentEmail: ${currentEmail?.address || "(none)"} (${currentEmail?.id || "-"})`
    );
  }, [currentEmail?.id]);

  // Load domains from Supabase
  useEffect(() => {
    const loadDomains = async () => {
      const { data, error } = await supabase
        .from('domains')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Error loading domains:', error);
        return;
      }

      setDomains(data || []);
    };

    loadDomains();
  }, []);

  // Load email history for logged-in users
  useEffect(() => {
    if (!user) return;

    const loadHistory = async () => {
      const { data, error } = await supabase
        .from('temp_emails')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading history:', error);
        return;
      }

      setEmailHistory(data || []);
    };

    loadHistory();
  }, [user]);

  // Generate new email with secret token
  const generateEmail = useCallback(async (domainId?: string, customUsername?: string, skipExistingCheck = false) => {
    if (domains.length === 0) return;

    setIsGenerating(true);

    try {
      // Fetch admin settings to check limits
      const { data: settingsData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'user_settings')
        .maybeSingle();
      
      const adminSettings = settingsData?.value as {
        allowGuestAccess?: boolean;
        guestEmailLimit?: number;
        userEmailLimit?: number;
      } | null;

      if (adminSettings) {
        const isGuest = !user;
        const limit = isGuest ? (adminSettings.guestEmailLimit ?? 5) : (adminSettings.userEmailLimit ?? 50);
        const currentCount = getEmailCreationCount();
        
        if (isGuest && adminSettings.allowGuestAccess === false) {
          toast.error('Guest email creation is disabled. Please sign in.');
          setIsGenerating(false);
          return false;
        }
        
        if (currentCount >= limit && limit > 0) {
          toast.error(`Daily email creation limit of ${limit} reached`);
          setIsGenerating(false);
          return false;
        }
      }

      const selectedDomain = domainId 
        ? domains.find(d => d.id === domainId) 
        : domains[0];

      if (!selectedDomain) {
        setIsGenerating(false);
        return;
      }

      // Generate random username if not provided
      let username = customUsername;
      if (!username) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        username = '';
        for (let i = 0; i < 10; i++) {
          username += chars.charAt(Math.floor(Math.random() * chars.length));
        }
      }
      const address = username + selectedDomain.name;

      // Calculate expiry time: 2 hours for guests, 10 hours for registered users
      const expiryHours = user ? 10 : 2;
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

      // Create temp email in database (token is auto-generated and returned only on INSERT)
      const { data: newEmail, error } = await supabase
        .from('temp_emails')
        .insert({
          address,
          domain_id: selectedDomain.id,
          user_id: user?.id || null,
          is_active: true,
          expires_at: expiresAt,
        })
        .select('id, address, domain_id, user_id, expires_at, is_active, created_at, secret_token')
        .single();

      if (error) {
        console.error('Error creating temp email:', error);
        
        // Check for rate limit error
        if (error.message?.includes('Rate limit exceeded')) {
          toast.error('Rate limit exceeded. Please wait before creating more emails.');
        } else if (error.code === '23505') {
          toast.error('This email address already exists. Please try a different username.');
        } else {
          toast.error('Failed to create email. Please try again.');
        }
        setIsGenerating(false);
        return false;
      }

      // Invalidate any in-flight inbox fetches before switching address
      fetchSeqRef.current++;

      // Store the token securely in localStorage
      if (newEmail.secret_token) {
        storeToken(newEmail.id, newEmail.secret_token);
      }

      // Persist the "current" email id so Generator + Inbox always agree across reloads
      try {
        localStorage.setItem(CURRENT_EMAIL_ID_KEY, newEmail.id);
      } catch {
        // ignore
      }

      setCurrentEmail(newEmail);
      setReceivedEmails([]);
      
      // Increment local creation count
      incrementEmailCreationCount();

      if (user) {
        setEmailHistory(prev => [newEmail, ...prev]);
      }

      toast.success(customUsername ? `Custom email created: ${address}` : 'New secure email created!');
      return true;
    } catch (error) {
      console.error('Error generating email:', error);
      toast.error('Failed to create email');
      return false;
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
  }, [domains, user]);

  // Generate custom email with specific username
  const generateCustomEmail = useCallback(async (username: string, domainId: string) => {
    return generateEmail(domainId, username, true);
  }, [generateEmail]);

  // Initial email generation - check for existing first
  useEffect(() => {
    const initializeEmail = async () => {
      // Guard: prevent duplicate initialization
      if (initStartedRef.current) return;
      if (domains.length === 0) return;
      if (currentEmail) {
        setIsLoading(false);
        return;
      }

      // Mark initialization as started immediately
      initStartedRef.current = true;

      // Check localStorage for existing session email
      const storedTokensRaw = localStorage.getItem(TOKEN_STORAGE_KEY);
      let tokens: Record<string, string> = {};

      if (storedTokensRaw) {
        try {
          tokens = JSON.parse(storedTokensRaw) || {};
        } catch (e) {
          console.error('Error parsing stored tokens:', e);
          tokens = {};
        }
      }

      // 1) Prefer the explicitly-stored current email id (prevents generator/inbox divergence)
      const preferredId = localStorage.getItem(CURRENT_EMAIL_ID_KEY);
      if (preferredId && tokens[preferredId]) {
        const { data: preferredEmail, error: preferredError } = await supabase
          .from('temp_emails')
          .select('id, address, domain_id, user_id, expires_at, is_active, created_at')
          .eq('id', preferredId)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (!preferredError && preferredEmail) {
          setCurrentEmail({ ...preferredEmail, secret_token: tokens[preferredEmail.id] });
          setIsLoading(false);
          return;
        }

        // If the preferred email is no longer valid, clear the pointer.
        try {
          localStorage.removeItem(CURRENT_EMAIL_ID_KEY);
        } catch {
          // ignore
        }
      }

      // 2) Fallback: pick the most recent valid email from all stored tokens
      const emailIds = Object.keys(tokens);
      if (emailIds.length > 0) {
        const { data: existingEmail, error } = await supabase
          .from('temp_emails')
          .select('id, address, domain_id, user_id, expires_at, is_active, created_at')
          .in('id', emailIds)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!error && existingEmail) {
          try {
            localStorage.setItem(CURRENT_EMAIL_ID_KEY, existingEmail.id);
          } catch {
            // ignore
          }

          setCurrentEmail({ ...existingEmail, secret_token: tokens[existingEmail.id] });
          setIsLoading(false);
          return;
        }
      }

      // No valid existing email, generate new one
      await generateEmail();
    };

    void initializeEmail();
  }, [domains, currentEmail, generateEmail]);

  // Clear stale tokens and email from storage
  const clearStaleEmail = useCallback((emailId: string) => {
    try {
      // Remove token
      const tokens = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || '{}');
      delete tokens[emailId];
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
      
      // Clear current email pointer if it matches
      const currentId = localStorage.getItem(CURRENT_EMAIL_ID_KEY);
      if (currentId === emailId) {
        localStorage.removeItem(CURRENT_EMAIL_ID_KEY);
      }
    } catch (e) {
      console.error('Failed to clear stale email:', e);
    }
  }, []);

  // Fetch emails using secure backend function
  const fetchSecureEmailsFor = useCallback(async (email: TempEmail) => {
    const token = getStoredToken(email.id) || email.secret_token;

    if (!token) {
      console.error('No token available for this email');
      return;
    }

    // Sequence guard: only the most recent fetch may update state
    const seq = ++fetchSeqRef.current;

    try {
      const { data, error } = await supabase.functions.invoke('secure-email-access', {
        body: {
          action: 'get_emails',
          tempEmailId: email.id,
          token,
        },
      });

      if (seq !== fetchSeqRef.current) return;
      if (activeEmailIdRef.current !== email.id) return;

      if (error) {
        // Check if this is an "email not found" error - handle 404 responses
        const isNotFound = 
          error.message?.includes('404') || 
          error.message?.includes('non-2xx') ||
          data?.code === 'EMAIL_NOT_FOUND' ||
          data?.error === 'Temp email not found';
        
        if (isNotFound) {
          console.warn('[email-service] Temp email not found, clearing stale data and regenerating...');
          clearStaleEmail(email.id);
          setCurrentEmail(null);
          initStartedRef.current = false; // Allow re-initialization
          return;
        }
        console.error('Error fetching emails:', error);
        return;
      }

      // Also check if data contains error (edge function might return error in body)
      if (data?.error) {
        if (data.code === 'EMAIL_NOT_FOUND' || data.error === 'Temp email not found') {
          console.warn('[email-service] Temp email not found (from response), clearing stale data...');
          clearStaleEmail(email.id);
          setCurrentEmail(null);
          initStartedRef.current = false;
          return;
        }
        console.error('Error from edge function:', data.error);
        return;
      }

      if (data?.emails) {
        setReceivedEmails(data.emails);
      }
    } catch (error: any) {
      // Also handle caught errors for 404
      const errorMessage = error?.message || '';
      if (errorMessage.includes('404') || errorMessage.includes('Temp email not found') || errorMessage.includes('non-2xx')) {
        console.warn('[email-service] Temp email not found (caught), clearing stale data...');
        clearStaleEmail(email.id);
        setCurrentEmail(null);
        initStartedRef.current = false;
        return;
      }
      console.error('Error in fetchSecureEmails:', error);
    }
  }, [clearStaleEmail]);

  const fetchSecureEmails = useCallback(async () => {
    const email = currentEmailRef.current;
    if (!email) return;
    await fetchSecureEmailsFor(email);
  }, [fetchSecureEmailsFor]);

  // Load emails when current email changes
  useEffect(() => {
    if (currentEmail) {
      void fetchSecureEmails();
    }
  }, [currentEmail?.id, fetchSecureEmails]);

  // Trigger IMAP fetch from mail server
  const triggerImapFetch = useCallback(
    async (options?: { mode?: 'latest' | 'unseen'; limit?: number }) => {
      try {
        const mode = options?.mode ?? 'latest';
        const limit = options?.limit ?? 10;

        console.log('Triggering IMAP fetch...');
        const { data, error } = await supabase.functions.invoke('fetch-imap-emails', {
          body: { mode, limit },
        });

        if (error) {
          console.error('IMAP fetch error:', error);
          throw error;
        }

        console.log('IMAP fetch result:', data);

        // Always refetch emails for the latest active address after IMAP poll
        await fetchSecureEmails();

        return data;
      } catch (error) {
        console.error('Error triggering IMAP fetch:', error);
        throw error;
      }
    },
    [fetchSecureEmails]
  );

  // Mark email as read using secure edge function
  const markAsRead = useCallback(async (emailId: string) => {
    if (!currentEmail) return;

    const token = getStoredToken(currentEmail.id) || currentEmail.secret_token;
    
    if (!token) return;

    try {
      await supabase.functions.invoke('secure-email-access', {
        body: {
          action: 'mark_read',
          tempEmailId: currentEmail.id,
          token: token,
          emailId: emailId,
        },
      });

      setReceivedEmails(prev => 
        prev.map(e => e.id === emailId ? { ...e, is_read: true } : e)
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, [currentEmail]);

  // Save email to favorites
  const saveEmail = async (emailId: string) => {
    if (!user) {
      toast.error('Please sign in to save emails');
      return false;
    }

    const { error } = await supabase
      .from('saved_emails')
      .insert({
        user_id: user.id,
        received_email_id: emailId,
      });

    if (error) {
      if (error.code === '23505') {
        toast.info('Email already saved');
      } else {
        toast.error('Failed to save email');
      }
      return false;
    }

    toast.success('Email saved to favorites!');
    return true;
  };

  // Change domain
  const changeDomain = (domainId: string) => {
    generateEmail(domainId);
  };

  // Add custom domain
  const addCustomDomain = async (domainName: string) => {
    if (!user) {
      toast.error('Please sign in to add custom domains');
      return false;
    }

    const name = domainName.startsWith('@') ? domainName : `@${domainName}`;

    const { data, error } = await supabase
      .from('domains')
      .insert({
        name,
        is_premium: false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        toast.error('Domain already exists');
      } else {
        toast.error('Failed to add domain');
      }
      return false;
    }

    setDomains(prev => [...prev, data]);
    toast.success('Custom domain added!');
    return true;
  };

  // Load a previous email from history
  const loadFromHistory = useCallback(
    async (emailId: string) => {
      const email = emailHistory.find((e) => e.id === emailId);
      if (email) {
        // Invalidate any in-flight inbox fetches before switching address
        fetchSeqRef.current++;

        try {
          localStorage.setItem(CURRENT_EMAIL_ID_KEY, email.id);
        } catch {
          // ignore
        }

        setCurrentEmail(email);
        setReceivedEmails([]);
        // The fetchSecureEmails will be triggered by the useEffect
      }
    },
    [emailHistory]
  );

  // Get the access token for the current email (for sharing or other uses)
  const getAccessToken = useCallback(() => {
    if (!currentEmail) return null;
    return getStoredToken(currentEmail.id) || currentEmail.secret_token;
  }, [currentEmail]);

  return {
    domains,
    currentEmail,
    receivedEmails,
    emailHistory,
    isLoading,
    isGenerating,
    generateEmail,
    generateCustomEmail,
    changeDomain,
    markAsRead,
    saveEmail,
    addCustomDomain,
    loadFromHistory,
    refetch: fetchSecureEmails,
    triggerImapFetch,
    getAccessToken,
  };
};

export default useSecureEmailService;
