import { useState, useEffect, useCallback } from 'react';
import { storage, STORAGE_KEYS, generateId, generateRandomString } from '@/lib/storage';
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

export const useEmailService = () => {
  const { user } = useAuth();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [currentEmail, setCurrentEmail] = useState<TempEmail | null>(null);
  const [receivedEmails, setReceivedEmails] = useState<ReceivedEmail[]>([]);
  const [emailHistory, setEmailHistory] = useState<TempEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load domains
  useEffect(() => {
    const loadedDomains = storage.get<Domain[]>(STORAGE_KEYS.DOMAINS, []);
    setDomains(loadedDomains.filter(d => d.is_active));
  }, []);

  // Load email history for logged-in users
  useEffect(() => {
    if (user) {
      const allEmails = storage.get<TempEmail[]>(STORAGE_KEYS.TEMP_EMAILS, []);
      setEmailHistory(allEmails.filter(e => e.user_id === user.id));
    }
  }, [user]);

  // Generate new email
  const generateEmail = useCallback((domainId?: string) => {
    if (domains.length === 0) return;

    setIsGenerating(true);

    const selectedDomain = domainId 
      ? domains.find(d => d.id === domainId) 
      : domains[0];

    if (!selectedDomain) {
      setIsGenerating(false);
      return;
    }

    const username = generateRandomString(10);
    const address = username + selectedDomain.name;

    const newEmail: TempEmail = {
      id: generateId(),
      user_id: user?.id || null,
      address,
      domain_id: selectedDomain.id,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      is_active: true,
      created_at: new Date().toISOString(),
    };

    // Save to storage
    const allEmails = storage.get<TempEmail[]>(STORAGE_KEYS.TEMP_EMAILS, []);
    allEmails.push(newEmail);
    storage.set(STORAGE_KEYS.TEMP_EMAILS, allEmails);

    setCurrentEmail(newEmail);
    setReceivedEmails([]);
    
    if (user) {
      setEmailHistory(prev => [newEmail, ...prev]);
    }

    setIsGenerating(false);
    setIsLoading(false);
  }, [domains, user]);

  // Initial email generation
  useEffect(() => {
    if (domains.length > 0 && !currentEmail) {
      generateEmail();
    }
  }, [domains, currentEmail, generateEmail]);

  // Load received emails for current temp email
  useEffect(() => {
    if (!currentEmail) return;

    const allReceived = storage.get<ReceivedEmail[]>(STORAGE_KEYS.RECEIVED_EMAILS, []);
    setReceivedEmails(allReceived.filter(e => e.temp_email_id === currentEmail.id));
  }, [currentEmail]);

  // Simulate receiving an email (for demo purposes)
  const simulateIncomingEmail = () => {
    if (!currentEmail) return;

    const newEmail: ReceivedEmail = {
      id: generateId(),
      temp_email_id: currentEmail.id,
      from_address: `noreply@example${Math.floor(Math.random() * 100)}.com`,
      subject: `Test Email - Verification Code: ${Math.floor(Math.random() * 999999)}`,
      body: 'This is a simulated email for testing purposes. Your verification code is above.',
      html_body: null,
      is_read: false,
      received_at: new Date().toISOString(),
    };

    const allReceived = storage.get<ReceivedEmail[]>(STORAGE_KEYS.RECEIVED_EMAILS, []);
    allReceived.push(newEmail);
    storage.set(STORAGE_KEYS.RECEIVED_EMAILS, allReceived);

    setReceivedEmails(prev => [newEmail, ...prev]);
    toast.success('New email received!', { description: newEmail.subject || 'No subject' });

    // Play notification sound
    try {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});
    } catch {}
  };

  // Mark email as read
  const markAsRead = (emailId: string) => {
    const allReceived = storage.get<ReceivedEmail[]>(STORAGE_KEYS.RECEIVED_EMAILS, []);
    const index = allReceived.findIndex(e => e.id === emailId);
    if (index !== -1) {
      allReceived[index].is_read = true;
      storage.set(STORAGE_KEYS.RECEIVED_EMAILS, allReceived);
      setReceivedEmails(prev => prev.map(e => e.id === emailId ? { ...e, is_read: true } : e));
    }
  };

  // Save email to favorites
  const saveEmail = (emailId: string) => {
    if (!user) {
      toast.error('Please sign in to save emails');
      return false;
    }

    const savedEmails = storage.get<{ user_id: string; email_id: string }[]>(STORAGE_KEYS.SAVED_EMAILS, []);
    
    if (savedEmails.find(s => s.user_id === user.id && s.email_id === emailId)) {
      toast.info('Email already saved');
      return false;
    }

    savedEmails.push({ user_id: user.id, email_id: emailId });
    storage.set(STORAGE_KEYS.SAVED_EMAILS, savedEmails);
    toast.success('Email saved to favorites!');
    return true;
  };

  // Change domain
  const changeDomain = (domainId: string) => {
    generateEmail(domainId);
  };

  // Add custom domain
  const addCustomDomain = (domainName: string) => {
    if (!user) {
      toast.error('Please sign in to add custom domains');
      return false;
    }

    const name = domainName.startsWith('@') ? domainName : `@${domainName}`;
    
    const allDomains = storage.get<Domain[]>(STORAGE_KEYS.DOMAINS, []);
    if (allDomains.find(d => d.name === name)) {
      toast.error('Domain already exists');
      return false;
    }

    const newDomain: Domain = {
      id: generateId(),
      name,
      is_premium: false,
      is_active: true,
      is_custom: true,
      created_at: new Date().toISOString(),
    };

    allDomains.push(newDomain);
    storage.set(STORAGE_KEYS.DOMAINS, allDomains);
    setDomains(prev => [...prev, newDomain]);
    toast.success('Custom domain added!');
    return true;
  };

  // Load a previous email from history
  const loadFromHistory = (emailId: string) => {
    const email = emailHistory.find(e => e.id === emailId);
    if (email) {
      setCurrentEmail(email);
      const allReceived = storage.get<ReceivedEmail[]>(STORAGE_KEYS.RECEIVED_EMAILS, []);
      setReceivedEmails(allReceived.filter(e => e.temp_email_id === email.id));
    }
  };

  return {
    domains,
    currentEmail,
    receivedEmails,
    emailHistory,
    isLoading,
    isGenerating,
    generateEmail,
    changeDomain,
    markAsRead,
    saveEmail,
    addCustomDomain,
    loadFromHistory,
    simulateIncomingEmail, // For demo
  };
};
