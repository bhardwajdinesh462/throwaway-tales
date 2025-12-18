import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useSupabaseAuth';
import { toast } from 'sonner';

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

      // Create temp email in database (token is auto-generated and returned only on INSERT)
      const { data: newEmail, error } = await supabase
        .from('temp_emails')
        .insert({
          address,
          domain_id: selectedDomain.id,
          user_id: user?.id || null,
          is_active: true,
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

      // Store the token securely in localStorage
      if (newEmail.secret_token) {
        storeToken(newEmail.id, newEmail.secret_token);
      }

      setCurrentEmail(newEmail);
      setReceivedEmails([]);
      
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
      if (domains.length === 0 || currentEmail || isGenerating) return;

      // Check localStorage for existing session email
      const storedTokens = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedTokens) {
        try {
          const tokens = JSON.parse(storedTokens);
          const emailIds = Object.keys(tokens);
          
          if (emailIds.length > 0) {
            // Try to load the most recent valid email
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
              console.log('Found existing valid email:', existingEmail.address);
              setCurrentEmail({ ...existingEmail, secret_token: tokens[existingEmail.id] });
              setIsLoading(false);
              return;
            }
          }
        } catch (e) {
          console.error('Error parsing stored tokens:', e);
        }
      }

      // No valid existing email, generate new one
      generateEmail();
    };

    initializeEmail();
  }, [domains, currentEmail, isGenerating]);

  // Fetch emails using secure edge function
  const fetchSecureEmails = useCallback(async () => {
    if (!currentEmail) return;

    const token = getStoredToken(currentEmail.id) || currentEmail.secret_token;
    
    if (!token) {
      console.error('No token available for this email');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('secure-email-access', {
        body: {
          action: 'get_emails',
          tempEmailId: currentEmail.id,
          token: token,
        },
      });

      if (error) {
        console.error('Error fetching emails:', error);
        return;
      }

      if (data?.emails) {
        setReceivedEmails(data.emails);
      }
    } catch (error) {
      console.error('Error in fetchSecureEmails:', error);
    }
  }, [currentEmail]);

  // Load emails when current email changes
  useEffect(() => {
    if (currentEmail) {
      fetchSecureEmails();
    }
  }, [currentEmail, fetchSecureEmails]);

  // Trigger IMAP fetch from mail server
  const triggerImapFetch = useCallback(async () => {
    try {
      console.log('Triggering IMAP fetch...');
      const { data, error } = await supabase.functions.invoke('fetch-imap-emails', {
        body: {},
      });

      if (error) {
        console.error('IMAP fetch error:', error);
        throw error;
      }

      console.log('IMAP fetch result:', data);
      
      // Refetch emails after IMAP poll
      await fetchSecureEmails();
      
      return data;
    } catch (error) {
      console.error('Error triggering IMAP fetch:', error);
      throw error;
    }
  }, [fetchSecureEmails]);

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
  const loadFromHistory = useCallback(async (emailId: string) => {
    const email = emailHistory.find(e => e.id === emailId);
    if (email) {
      setCurrentEmail(email);
      // The fetchSecureEmails will be triggered by the useEffect
    }
  }, [emailHistory]);

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
