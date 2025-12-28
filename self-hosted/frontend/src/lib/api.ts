/**
 * Self-Hosted API Wrapper
 * Replaces Supabase client for self-hosted deployments
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: string[];
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
}

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.authToken = localStorage.getItem('auth_token');
  }

  setAuthToken(token: string | null): void {
    this.authToken = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers = {}, token } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const authToken = token || this.authToken;
    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          errors: data.errors,
        };
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Auth endpoints
  auth = {
    register: async (email: string, password: string, name?: string) => {
      const response = await this.request<{ user: User; token: string }>('/auth/register.php', {
        method: 'POST',
        body: { email, password, name },
      });

      if (response.success && response.data?.token) {
        this.setAuthToken(response.data.token);
      }

      return response;
    },

    login: async (email: string, password: string, totpCode?: string) => {
      const response = await this.request<{ user: User; token: string; requires_2fa?: boolean }>('/auth/login.php', {
        method: 'POST',
        body: { email, password, totp_code: totpCode },
      });

      if (response.success && response.data?.token) {
        this.setAuthToken(response.data.token);
      }

      return response;
    },

    logout: async () => {
      const response = await this.request('/auth/logout.php', { method: 'POST' });
      this.setAuthToken(null);
      return response;
    },

    getUser: async () => {
      return this.request<{ user: User }>('/auth/me.php');
    },

    updateProfile: async (data: Partial<User>) => {
      return this.request('/auth/me.php', {
        method: 'PUT',
        body: data,
      });
    },

    verifyEmail: async (token: string) => {
      return this.request(`/auth/verify-email.php?token=${token}`);
    },

    resendVerification: async () => {
      return this.request('/auth/verify-email.php', { method: 'POST' });
    },

    requestPasswordReset: async (email: string) => {
      return this.request('/auth/reset-password.php', {
        method: 'POST',
        body: { action: 'request', email },
      });
    },

    resetPassword: async (token: string, password: string) => {
      return this.request('/auth/reset-password.php', {
        method: 'POST',
        body: { action: 'reset', token, password },
      });
    },

    setup2FA: async () => {
      return this.request<{ secret: string; qr_url: string }>('/auth/2fa.php', {
        method: 'POST',
        body: { action: 'setup' },
      });
    },

    verify2FA: async (code: string) => {
      return this.request('/auth/2fa.php', {
        method: 'POST',
        body: { action: 'verify', code },
      });
    },

    enable2FA: async (code: string) => {
      return this.request<{ backup_codes: string[] }>('/auth/2fa.php', {
        method: 'POST',
        body: { action: 'enable', code },
      });
    },

    disable2FA: async (password: string) => {
      return this.request('/auth/2fa.php', {
        method: 'POST',
        body: { action: 'disable', password },
      });
    },
  };

  // Email endpoints
  emails = {
    create: async (domainId?: string) => {
      return this.request<TempEmail>('/emails/create.php', {
        method: 'POST',
        body: { domain_id: domainId },
      });
    },

    validate: async (token: string, email?: string) => {
      return this.request<TempEmailInfo>('/emails/validate.php', {
        method: 'POST',
        body: { token, email },
      });
    },

    getInbox: async (token: string, email?: string, page = 1, limit = 20) => {
      const params = new URLSearchParams({
        token,
        page: page.toString(),
        limit: limit.toString(),
      });
      if (email) params.append('email', email);

      return this.request<InboxResponse>(`/emails/inbox.php?${params}`);
    },

    markAsRead: async (token: string, emailId: string) => {
      return this.request('/emails/actions.php', {
        method: 'POST',
        body: { token, email_id: emailId, action: 'mark_read' },
      });
    },

    markAsUnread: async (token: string, emailId: string) => {
      return this.request('/emails/actions.php', {
        method: 'POST',
        body: { token, email_id: emailId, action: 'mark_unread' },
      });
    },

    star: async (token: string, emailId: string) => {
      return this.request('/emails/actions.php', {
        method: 'POST',
        body: { token, email_id: emailId, action: 'star' },
      });
    },

    unstar: async (token: string, emailId: string) => {
      return this.request('/emails/actions.php', {
        method: 'POST',
        body: { token, email_id: emailId, action: 'unstar' },
      });
    },

    delete: async (token: string, emailId: string) => {
      return this.request('/emails/actions.php', {
        method: 'POST',
        body: { token, email_id: emailId, action: 'delete' },
      });
    },

    getDomains: async () => {
      return this.request<{ domains: Domain[] }>('/emails/domains.php');
    },
  };

  // Admin endpoints
  admin = {
    getStats: async (period = '7d') => {
      return this.request<AdminStats>(`/admin/stats.php?period=${period}`);
    },

    getSettings: async (category?: string) => {
      const url = category ? `/admin/settings.php?category=${category}` : '/admin/settings.php';
      return this.request<{ settings: Record<string, unknown> }>(url);
    },

    updateSettings: async (settings: Record<string, unknown>, category = 'general') => {
      return this.request('/admin/settings.php', {
        method: 'PUT',
        body: { settings, category },
      });
    },

    getDomains: async () => {
      return this.request<{ domains: AdminDomain[] }>('/admin/domains.php');
    },

    createDomain: async (data: CreateDomainData) => {
      return this.request('/admin/domains.php', {
        method: 'POST',
        body: data,
      });
    },

    updateDomain: async (id: string, data: Partial<AdminDomain>) => {
      return this.request('/admin/domains.php', {
        method: 'PUT',
        body: { id, ...data },
      });
    },

    deleteDomain: async (id: string) => {
      return this.request(`/admin/domains.php?id=${id}`, { method: 'DELETE' });
    },

    getUsers: async (page = 1, limit = 20, search?: string) => {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (search) params.append('search', search);
      return this.request<UsersResponse>(`/admin/users.php?${params}`);
    },

    updateUser: async (id: string, data: Partial<AdminUser>) => {
      return this.request('/admin/users.php', {
        method: 'PUT',
        body: { id, ...data },
      });
    },

    deleteUser: async (id: string) => {
      return this.request(`/admin/users.php?id=${id}`, { method: 'DELETE' });
    },
  };

  // Storage endpoints
  storage = {
    upload: async (file: File, type: 'avatar' | 'attachment' | 'backup' = 'attachment') => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const headers: Record<string, string> = {};
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      try {
        const response = await fetch(`${this.baseUrl}/storage/upload.php`, {
          method: 'POST',
          headers,
          body: formData,
        });

        return await response.json();
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Upload failed',
        };
      }
    },

    getDownloadUrl: (fileId: string, token: string) => {
      return `${this.baseUrl}/storage/download.php?id=${fileId}&token=${token}`;
    },
  };

  // Stripe endpoints
  stripe = {
    createCheckout: async (tierId: string, successUrl?: string, cancelUrl?: string) => {
      return this.request<{ checkout_url: string; session_id: string }>('/stripe/checkout.php', {
        method: 'POST',
        body: { tier_id: tierId, success_url: successUrl, cancel_url: cancelUrl },
      });
    },
  };
}

// Types
export interface User {
  id: string;
  email: string;
  name?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  email_verified: boolean;
  two_factor_enabled?: boolean;
  is_admin?: boolean;
  created_at?: string;
  last_login_at?: string;
  subscription?: {
    tier_id: string;
    tier_name: string;
    features: Record<string, unknown>;
  };
}

export interface TempEmail {
  id: string;
  email: string;
  token: string;
  domain: string;
  expires_at: string;
  expires_in_hours: number;
}

export interface TempEmailInfo {
  valid: boolean;
  id: string;
  email: string;
  domain: string;
  expires_at: string;
  is_active: boolean;
  unread_count: number;
  created_at: string;
}

export interface ReceivedEmail {
  id: string;
  from_email: string;
  from_name: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  attachment_count: number;
  received_at: string;
  created_at: string;
}

export interface InboxResponse {
  emails: ReceivedEmail[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  temp_email: {
    id: string;
    email: string;
    expires_at: string;
  };
}

export interface Domain {
  id: string;
  domain: string;
  is_premium: boolean;
  default_expiry_hours: number;
}

export interface AdminDomain extends Domain {
  is_active: boolean;
  mx_verified: boolean;
  email_count: number;
  active_count: number;
  created_at: string;
}

export interface CreateDomainData {
  domain: string;
  is_active?: boolean;
  is_premium?: boolean;
  default_expiry_hours?: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  display_name?: string;
  avatar_url?: string;
  is_active: boolean;
  email_verified: boolean;
  two_factor_enabled: boolean;
  role?: string;
  email_count: number;
  created_at: string;
  last_login_at?: string;
}

export interface UsersResponse {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface AdminStats {
  overview: {
    total_users: number;
    new_users: number;
    total_temp_emails: number;
    active_temp_emails: number;
    total_received_emails: number;
    active_domains: number;
    active_subscriptions: number;
    storage_used_bytes: number;
  };
  chart_data: Array<{ date: string; created: number; received: number }>;
  top_domains: Array<{ domain: string; email_count: number }>;
  recent_activity: Array<{ action: string; entity_type: string; created_at: string }>;
  period: string;
}

// Export singleton instance
export const api = new ApiClient(API_URL);
export default api;
