import { useState, useEffect, useCallback, useRef } from 'react';
import { api, TempEmail, ReceivedEmail, Domain, TempEmailInfo } from '../lib/api';

interface EmailServiceState {
  domains: Domain[];
  currentEmail: TempEmail | null;
  emailInfo: TempEmailInfo | null;
  inbox: ReceivedEmail[];
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface UseEmailServiceReturn extends EmailServiceState {
  generateEmail: (domainId?: string) => Promise<void>;
  refreshInbox: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (emailId: string) => Promise<void>;
  markAsUnread: (emailId: string) => Promise<void>;
  starEmail: (emailId: string) => Promise<void>;
  unstarEmail: (emailId: string) => Promise<void>;
  deleteEmail: (emailId: string) => Promise<void>;
  loadFromToken: (token: string, email?: string) => Promise<void>;
  clearEmail: () => void;
}

const STORAGE_KEY = 'temp_email_data';
const POLL_INTERVAL = 5000; // Fallback polling interval (5 seconds)
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function useEmailService(): UseEmailServiceReturn {
  const [state, setState] = useState<EmailServiceState>({
    domains: [],
    currentEmail: null,
    emailInfo: null,
    inbox: [],
    isLoading: true,
    error: null,
    isConnected: false,
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load domains on mount
  useEffect(() => {
    loadDomains();
    loadStoredEmail();

    return () => {
      stopPolling();
      disconnectSSE();
    };
  }, []);

  // Start real-time connection when we have a valid email
  useEffect(() => {
    if (state.currentEmail?.token) {
      connectSSE();
    } else {
      disconnectSSE();
      stopPolling();
    }

    return () => {
      disconnectSSE();
      stopPolling();
    };
  }, [state.currentEmail?.token]);

  const loadDomains = async () => {
    try {
      const response = await api.emails.getDomains();
      if (response.success && response.data?.domains) {
        setState(prev => ({ ...prev, domains: response.data!.domains }));
      }
    } catch (error) {
      console.error('Failed to load domains:', error);
    }
  };

  const loadStoredEmail = async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const data = JSON.parse(stored) as TempEmail;
      
      // Validate the stored email
      const response = await api.emails.validate(data.token, data.email);
      
      if (response.success && response.data?.valid) {
        setState(prev => ({
          ...prev,
          currentEmail: data,
          emailInfo: response.data!,
          isLoading: false,
        }));
        
        // Load inbox
        await fetchInbox(data.token, data.email);
      } else {
        // Email expired or invalid, clear it
        localStorage.removeItem(STORAGE_KEY);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Failed to load stored email:', error);
      localStorage.removeItem(STORAGE_KEY);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const fetchInbox = async (token: string, email?: string, page = 1) => {
    try {
      const response = await api.emails.getInbox(token, email, page, state.pagination.limit);
      
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          inbox: page === 1 ? response.data!.emails : [...prev.inbox, ...response.data!.emails],
          pagination: {
            page: response.data!.pagination.page,
            limit: response.data!.pagination.limit,
            total: response.data!.pagination.total,
            totalPages: response.data!.pagination.total_pages,
          },
          error: null,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch inbox:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch inbox',
      }));
    }
  };

  // Connect to SSE for real-time updates
  const connectSSE = () => {
    if (!state.currentEmail?.token) return;
    
    disconnectSSE();
    
    const sseUrl = `${API_BASE}/emails/websocket.php?token=${encodeURIComponent(state.currentEmail.token)}`;
    console.log('[SSE] Connecting to:', sseUrl);
    
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', () => {
      console.log('[SSE] Connected');
      setState(prev => ({ ...prev, isConnected: true }));
      stopPolling(); // Stop polling when SSE is connected
    });

    eventSource.addEventListener('new_email', (event: MessageEvent) => {
      try {
        const email = JSON.parse(event.data);
        console.log('[SSE] New email:', email);
        // Refresh inbox to get full email data
        if (state.currentEmail?.token) {
          fetchInbox(state.currentEmail.token, state.currentEmail.email, 1);
        }
      } catch (e) {
        console.error('[SSE] Parse error:', e);
      }
    });

    eventSource.onerror = () => {
      console.log('[SSE] Connection error, falling back to polling');
      setState(prev => ({ ...prev, isConnected: false }));
      disconnectSSE();
      startPolling(); // Fallback to polling
    };

    eventSource.addEventListener('reconnect', () => {
      disconnectSSE();
      setTimeout(connectSSE, 1000);
    });
  };

  const disconnectSSE = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState(prev => ({ ...prev, isConnected: false }));
  };

  const startPolling = () => {
    stopPolling();
    
    pollIntervalRef.current = setInterval(() => {
      if (state.currentEmail?.token) {
        fetchInbox(state.currentEmail.token, state.currentEmail.email, 1);
      }
    }, POLL_INTERVAL);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const generateEmail = useCallback(async (domainId?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await api.emails.create(domainId);
      
      if (response.success && response.data) {
        const emailData = response.data;
        
        // Store in localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(emailData));
        
        setState(prev => ({
          ...prev,
          currentEmail: emailData,
          emailInfo: {
            valid: true,
            id: emailData.id,
            email: emailData.email,
            domain: emailData.domain,
            expires_at: emailData.expires_at,
            is_active: true,
            unread_count: 0,
            created_at: new Date().toISOString(),
          },
          inbox: [],
          isLoading: false,
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
          },
        }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: response.error || 'Failed to generate email',
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to generate email',
      }));
    }
  }, []);

  const refreshInbox = useCallback(async () => {
    if (!state.currentEmail?.token) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    await fetchInbox(state.currentEmail.token, state.currentEmail.email, 1);
    setState(prev => ({ ...prev, isLoading: false }));
  }, [state.currentEmail]);

  const loadMore = useCallback(async () => {
    if (!state.currentEmail?.token || state.pagination.page >= state.pagination.totalPages) return;
    
    await fetchInbox(
      state.currentEmail.token,
      state.currentEmail.email,
      state.pagination.page + 1
    );
  }, [state.currentEmail, state.pagination]);

  const markAsRead = useCallback(async (emailId: string) => {
    if (!state.currentEmail?.token) return;
    
    const response = await api.emails.markAsRead(state.currentEmail.token, emailId);
    
    if (response.success) {
      setState(prev => ({
        ...prev,
        inbox: prev.inbox.map(email =>
          email.id === emailId ? { ...email, is_read: true } : email
        ),
      }));
    }
  }, [state.currentEmail]);

  const markAsUnread = useCallback(async (emailId: string) => {
    if (!state.currentEmail?.token) return;
    
    const response = await api.emails.markAsUnread(state.currentEmail.token, emailId);
    
    if (response.success) {
      setState(prev => ({
        ...prev,
        inbox: prev.inbox.map(email =>
          email.id === emailId ? { ...email, is_read: false } : email
        ),
      }));
    }
  }, [state.currentEmail]);

  const starEmail = useCallback(async (emailId: string) => {
    if (!state.currentEmail?.token) return;
    
    const response = await api.emails.star(state.currentEmail.token, emailId);
    
    if (response.success) {
      setState(prev => ({
        ...prev,
        inbox: prev.inbox.map(email =>
          email.id === emailId ? { ...email, is_starred: true } : email
        ),
      }));
    }
  }, [state.currentEmail]);

  const unstarEmail = useCallback(async (emailId: string) => {
    if (!state.currentEmail?.token) return;
    
    const response = await api.emails.unstar(state.currentEmail.token, emailId);
    
    if (response.success) {
      setState(prev => ({
        ...prev,
        inbox: prev.inbox.map(email =>
          email.id === emailId ? { ...email, is_starred: false } : email
        ),
      }));
    }
  }, [state.currentEmail]);

  const deleteEmail = useCallback(async (emailId: string) => {
    if (!state.currentEmail?.token) return;
    
    const response = await api.emails.delete(state.currentEmail.token, emailId);
    
    if (response.success) {
      setState(prev => ({
        ...prev,
        inbox: prev.inbox.filter(email => email.id !== emailId),
        pagination: {
          ...prev.pagination,
          total: prev.pagination.total - 1,
        },
      }));
    }
  }, [state.currentEmail]);

  const loadFromToken = useCallback(async (token: string, email?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await api.emails.validate(token, email);
      
      if (response.success && response.data?.valid) {
        const emailData: TempEmail = {
          id: response.data.id,
          email: response.data.email,
          token: token,
          domain: response.data.domain,
          expires_at: response.data.expires_at,
          expires_in_hours: Math.ceil(
            (new Date(response.data.expires_at).getTime() - Date.now()) / 3600000
          ),
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(emailData));
        
        setState(prev => ({
          ...prev,
          currentEmail: emailData,
          emailInfo: response.data!,
          isLoading: false,
        }));
        
        await fetchInbox(token, email);
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: response.error || 'Invalid or expired token',
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load email',
      }));
    }
  }, []);

  const clearEmail = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    stopPolling();
    
    setState(prev => ({
      ...prev,
      currentEmail: null,
      emailInfo: null,
      inbox: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    }));
  }, []);

  return {
    ...state,
    generateEmail,
    refreshInbox,
    loadMore,
    markAsRead,
    markAsUnread,
    starEmail,
    unstarEmail,
    deleteEmail,
    loadFromToken,
    clearEmail,
  };
}

export default useEmailService;
