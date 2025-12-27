import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useSupabaseAuth';
import { toast } from 'sonner';
import { storage } from '@/lib/storage';
import { parseEmailCreationError } from '@/lib/emailErrorHandler';
import { generateUsername, UsernameStyle } from '@/lib/usernameGenerator';

const USERNAME_STYLE_KEY = 'nullsto_username_style';

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
  
  // Username style preference: 'human' (default) or 'random'
  const [usernameStyle, setUsernameStyleState] = useState<UsernameStyle>(() => {
    try {
      const stored = localStorage.getItem(USERNAME_STYLE_KEY);
      return (stored === 'random' ? 'random' : 'human') as UsernameStyle;
    } catch {
      return 'human';
    }
  });
  
  const setUsernameStyle = useCallback((style: UsernameStyle) => {
    setUsernameStyleState(style);
    try {
      localStorage.setItem(USERNAME_STYLE_KEY, style);
    } catch {
      // ignore
    }
  }, []);
  
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
      // Small retry to avoid getting stuck in "generating..." when backend is temporarily busy
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { data, error } = await supabase
          .from('domains')
          .select('*')
          .eq('is_active', true);

        if (!error) {
          setDomains(data || []);
          return;
        }

        console.error('Error loading domains:', error);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 250 * attempt));
        } else {
          toast.error('Backend is busy. Please refresh and try again.');
          setIsLoading(false);
          initStartedRef.current = false;
        }
      }
    };

    void loadDomains();
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

      // Generate username if not provided based on user preference
      // Default is 'human' style (e.g., "john.smith42") for better deliverability
      let username = customUsername;
      if (!username) {
        username = generateUsername(usernameStyle);
      }
      const address = username + selectedDomain.name;

      // Use the SECURITY DEFINER function for reliable email creation
      // This bypasses RLS issues for both guests and authenticated users
      const { data: result, error: rpcError } = await supabase.rpc('create_temp_email', {
        p_address: address,
        p_domain_id: selectedDomain.id,
        p_user_id: user?.id || null,
        p_expires_at: null, // Let the function calculate expiry based on user status
      });

      if (rpcError) {
        console.error('Error creating temp email (RPC):', rpcError);
        toast.error('Failed to create email. Please try again.');
        setIsGenerating(false);
        return false;
      }

      // Parse the JSONB result
      const rpcResult = result as { success: boolean; error?: string; email?: any };
      
      if (!rpcResult?.success) {
        console.error('Email creation failed:', rpcResult?.error);
        toast.error(rpcResult?.error || 'Failed to create email');
        setIsGenerating(false);
        return false;
      }

      const newEmail = rpcResult.email;

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

  // Initial email generation - check for existing first using edge function
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
      console.log('[email-service] Starting initialization...');

      // Check localStorage for existing session email
      const storedTokensRaw = localStorage.getItem(TOKEN_STORAGE_KEY);
      let tokens: Record<string, string> = {};

      if (storedTokensRaw) {
        try {
          tokens = JSON.parse(storedTokensRaw) || {};
        } catch (e) {
          console.error('[email-service] Error parsing stored tokens:', e);
          tokens = {};
        }
      }

      const emailIds = Object.keys(tokens);
      const preferredId = localStorage.getItem(CURRENT_EMAIL_ID_KEY);

      console.log(`[email-service] Found ${emailIds.length} stored tokens, preferredId: ${preferredId || 'none'}`);

      // Use edge function to validate emails (bypasses RLS issues)
      if (emailIds.length > 0) {
        try {
          // First try preferred email with token validation
          if (preferredId && tokens[preferredId]) {
            console.log(`[email-service] Validating preferred email: ${preferredId}`);
            const { data: preferredResult, error: preferredError } = await supabase.functions.invoke('validate-temp-email', {
              body: { tempEmailId: preferredId, token: tokens[preferredId] },
            });

            // Handle retryable errors (503) - skip validation and generate new
            if (preferredError || preferredResult?.retryable) {
              console.warn('[email-service] Validation failed or backend busy, will generate new email');
              // Don't clear tokens on timeout - just skip to generation
            } else if (preferredResult?.valid && preferredResult?.email) {
              console.log(`[email-service] Preferred email is valid: ${preferredResult.email.address}`);
              setCurrentEmail({ ...preferredResult.email, secret_token: tokens[preferredId] });
              setIsLoading(false);
              return;
            } else {
              console.log(`[email-service] Preferred email invalid or expired, clearing...`);
              // Clear invalid preferred email pointer
              try {
                localStorage.removeItem(CURRENT_EMAIL_ID_KEY);
                delete tokens[preferredId];
                localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
              } catch {
                // ignore
              }
            }
          }

          // Fallback: validate all stored email IDs to find most recent valid one
          const remainingEmailIds = Object.keys(tokens);
          if (remainingEmailIds.length > 0) {
            console.log(`[email-service] Checking ${remainingEmailIds.length} remaining stored emails...`);
            const { data: bulkResult, error: bulkError } = await supabase.functions.invoke('validate-temp-email', {
              body: { emailIds: remainingEmailIds },
            });

            // Handle retryable errors - proceed to generate new email
            if (bulkError || bulkResult?.retryable) {
              console.warn('[email-service] Bulk validation failed or backend busy, will generate new email');
            } else if (bulkResult?.valid && bulkResult?.email) {
              console.log(`[email-service] Found valid email: ${bulkResult.email.address}`);
              
              // Clean up stale tokens (only keep valid ones)
              if (bulkResult.validEmailIds) {
                const validSet = new Set(bulkResult.validEmailIds);
                const cleanedTokens: Record<string, string> = {};
                for (const id of remainingEmailIds) {
                  if (validSet.has(id)) {
                    cleanedTokens[id] = tokens[id];
                  }
                }
                try {
                  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(cleanedTokens));
                  localStorage.setItem(CURRENT_EMAIL_ID_KEY, bulkResult.email.id);
                } catch {
                  // ignore
                }
              }

              setCurrentEmail({ ...bulkResult.email, secret_token: tokens[bulkResult.email.id] });
              setIsLoading(false);
              return;
            } else {
              console.log('[email-service] No valid emails found from stored tokens');
            }
          }
        } catch (error) {
          console.error('[email-service] Error validating emails via edge function:', error);
          // Don't block - proceed to generate new email
        }
      }

      // No valid existing email, generate new one
      console.log('[email-service] No valid email found, generating new one...');
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
        const msg = error.message || '';
        const isRetryable = msg.includes('503') || msg.includes('timeout') || msg.includes('connect') || msg.includes('non-2xx');

        // Circuit breaker: max 3 retries with exponential backoff
        const retryCount = (email as any)._retryCount || 0;
        if (isRetryable && retryCount < 3) {
          const delay = Math.min(1500 * Math.pow(2, retryCount), 10000);
          console.warn(`[email-service] Backend temporarily unavailable, retry ${retryCount + 1}/3 in ${delay}ms...`);
          setTimeout(() => {
            const emailWithRetry = { ...email, _retryCount: retryCount + 1 } as any;
            void fetchSecureEmailsFor(emailWithRetry);
          }, delay);
          return;
        }
        
        if (isRetryable) {
          console.error('[email-service] Backend unavailable after 3 retries, stopping');
          toast.error('Backend temporarily unavailable. Click "Check Mail" to retry.');
          return;
        }

        // Check if this is an "email not found" error - handle 404 responses
        const isNotFound = 
          msg.includes('404') || 
          msg.includes('EMAIL_NOT_FOUND') ||
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
    usernameStyle,
    setUsernameStyle,
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
