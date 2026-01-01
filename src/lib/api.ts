/**
 * API Client for PHP/MySQL Backend
 * Replaces Supabase SDK with standard fetch() calls
 */

const API_BASE_URL = 'https://myserver.com/api';

// Token storage
const AUTH_TOKEN_KEY = 'nullsto_auth_token';
const REFRESH_TOKEN_KEY = 'nullsto_refresh_token';

export interface ApiResponse<T = any> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface User {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: User;
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: ApiError | null;
}

// Get stored auth token
export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

// Store auth tokens
export const setAuthTokens = (accessToken: string, refreshToken?: string): void => {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  } catch {
    console.error('Failed to store auth tokens');
  }
};

// Clear auth tokens
export const clearAuthTokens = (): void => {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    console.error('Failed to clear auth tokens');
  }
};

// Build headers with optional auth
const buildHeaders = (includeAuth = true): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
};

// Generic fetch wrapper with error handling
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  includeAuth = true
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...buildHeaders(includeAuth),
        ...options.headers,
      },
    });

    const contentType = response.headers.get('content-type');
    let data: any = null;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      return {
        data: null,
        error: {
          message: data?.message || data?.error || `Request failed with status ${response.status}`,
          code: data?.code,
          status: response.status,
        },
      };
    }

    return { data, error: null };
  } catch (error: any) {
    return {
      data: null,
      error: {
        message: error?.message || 'Network error',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

// ============================================
// AUTH API
// ============================================

export const auth = {
  async signUp(email: string, password: string, displayName?: string): Promise<AuthResponse> {
    const { data, error } = await fetchApi<{ user: User; session: Session }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName }),
    }, false);

    if (error) {
      return { user: null, session: null, error };
    }

    if (data?.session) {
      setAuthTokens(data.session.access_token, data.session.refresh_token);
    }

    return { user: data?.user || null, session: data?.session || null, error: null };
  },

  async signIn(email: string, password: string): Promise<AuthResponse> {
    const { data, error } = await fetchApi<{ user: User; session: Session }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, false);

    if (error) {
      return { user: null, session: null, error };
    }

    if (data?.session) {
      setAuthTokens(data.session.access_token, data.session.refresh_token);
    }

    return { user: data?.user || null, session: data?.session || null, error: null };
  },

  async signOut(): Promise<ApiResponse<void>> {
    const result = await fetchApi<void>('/auth/logout', { method: 'POST' });
    clearAuthTokens();
    return result;
  },

  async getSession(): Promise<AuthResponse> {
    const token = getAuthToken();
    if (!token) {
      return { user: null, session: null, error: null };
    }

    const { data, error } = await fetchApi<{ user: User; session: Session }>('/auth/session');

    if (error) {
      if (error.status === 401) {
        clearAuthTokens();
      }
      return { user: null, session: null, error };
    }

    return { user: data?.user || null, session: data?.session || null, error: null };
  },

  async resetPassword(email: string): Promise<ApiResponse<void>> {
    return fetchApi<void>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }, false);
  },

  async updatePassword(newPassword: string): Promise<ApiResponse<void>> {
    return fetchApi<void>('/auth/update-password', {
      method: 'POST',
      body: JSON.stringify({ password: newPassword }),
    });
  },

  async updateProfile(updates: Partial<User>): Promise<ApiResponse<User>> {
    return fetchApi<User>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  // Social auth - redirects to OAuth provider
  signInWithGoogle(): void {
    window.location.href = `${API_BASE_URL}/auth/google`;
  },

  signInWithFacebook(): void {
    window.location.href = `${API_BASE_URL}/auth/facebook`;
  },
};

// ============================================
// DATABASE API (replaces supabase.from())
// ============================================

interface QueryOptions {
  select?: string;
  filter?: Record<string, any>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  single?: boolean;
}

export const db = {
  // Generic query builder
  async query<T>(table: string, options: QueryOptions = {}): Promise<ApiResponse<T>> {
    const params = new URLSearchParams();

    if (options.select) params.set('select', options.select);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    if (options.single) params.set('single', 'true');
    if (options.order) {
      params.set('order', `${options.order.column}.${options.order.ascending ? 'asc' : 'desc'}`);
    }
    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        params.set(`filter[${key}]`, String(value));
      });
    }

    const queryString = params.toString();
    const endpoint = `/data/${table}${queryString ? `?${queryString}` : ''}`;

    return fetchApi<T>(endpoint);
  },

  async insert<T>(table: string, data: Record<string, any> | Record<string, any>[]): Promise<ApiResponse<T>> {
    return fetchApi<T>(`/data/${table}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update<T>(
    table: string,
    data: Record<string, any>,
    filter: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([key, value]) => {
      params.set(`filter[${key}]`, String(value));
    });

    return fetchApi<T>(`/data/${table}?${params.toString()}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(table: string, filter: Record<string, any>): Promise<ApiResponse<void>> {
    const params = new URLSearchParams();
    Object.entries(filter).forEach(([key, value]) => {
      params.set(`filter[${key}]`, String(value));
    });

    return fetchApi<void>(`/data/${table}?${params.toString()}`, {
      method: 'DELETE',
    });
  },

  // RPC-style function calls (for stored procedures)
  async rpc<T>(functionName: string, params: Record<string, any> = {}): Promise<ApiResponse<T>> {
    return fetchApi<T>(`/rpc/${functionName}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};

// ============================================
// STORAGE API (replaces supabase.storage)
// ============================================

export const storage = {
  async upload(
    bucket: string,
    path: string,
    file: File
  ): Promise<ApiResponse<{ path: string; url: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', bucket);
    formData.append('path', path);

    const token = getAuthToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/storage/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data?.message || 'Upload failed', status: response.status },
        };
      }

      return { data, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: { message: error?.message || 'Upload failed', code: 'UPLOAD_ERROR' },
      };
    }
  },

  async download(bucket: string, path: string): Promise<ApiResponse<Blob>> {
    try {
      const token = getAuthToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/storage/download?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`,
        { headers }
      );

      if (!response.ok) {
        return {
          data: null,
          error: { message: 'Download failed', status: response.status },
        };
      }

      const blob = await response.blob();
      return { data: blob, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: { message: error?.message || 'Download failed', code: 'DOWNLOAD_ERROR' },
      };
    }
  },

  async delete(bucket: string, paths: string[]): Promise<ApiResponse<void>> {
    return fetchApi<void>('/storage/delete', {
      method: 'DELETE',
      body: JSON.stringify({ bucket, paths }),
    });
  },

  getPublicUrl(bucket: string, path: string): string {
    return `${API_BASE_URL}/storage/public/${bucket}/${path}`;
  },
};

// ============================================
// FUNCTIONS API (replaces edge functions)
// ============================================

export const functions = {
  async invoke<T>(
    functionName: string,
    options: { body?: any; headers?: Record<string, string> } = {}
  ): Promise<ApiResponse<T>> {
    return fetchApi<T>(`/functions/${functionName}`, {
      method: 'POST',
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: options.headers,
    });
  },
};

// ============================================
// REALTIME (Polling-based for PHP backend)
// ============================================

type RealtimeCallback = (payload: { eventType: string; new: any; old?: any }) => void;

class RealtimeChannel {
  private table: string;
  private callbacks: RealtimeCallback[] = [];
  private pollInterval: NodeJS.Timeout | null = null;
  private lastData: any[] = [];
  private filter: Record<string, any> = {};

  constructor(table: string) {
    this.table = table;
  }

  on(
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    filter: { schema?: string; table?: string; filter?: string } | undefined,
    callback: RealtimeCallback
  ): this {
    this.callbacks.push(callback);
    
    // Parse filter string like "temp_email_id=eq.xxx"
    if (filter?.filter) {
      const [key, value] = filter.filter.split('=eq.');
      if (key && value) {
        this.filter[key] = value;
      }
    }
    
    return this;
  }

  subscribe(): this {
    // Start polling every 5 seconds
    this.poll();
    this.pollInterval = setInterval(() => this.poll(), 5000);
    return this;
  }

  unsubscribe(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const { data, error } = await db.query<any[]>(this.table, {
        filter: this.filter,
        order: { column: 'created_at', ascending: false },
        limit: 50,
      });

      if (error || !data) return;

      // Detect new items
      const oldIds = new Set(this.lastData.map((item) => item.id));
      const newItems = data.filter((item) => !oldIds.has(item.id));

      newItems.forEach((item) => {
        this.callbacks.forEach((cb) => {
          cb({ eventType: 'INSERT', new: item });
        });
      });

      this.lastData = data;
    } catch (err) {
      console.error('Realtime poll error:', err);
    }
  }
}

export const realtime = {
  channel(name: string): RealtimeChannel {
    // Extract table name from channel name (e.g., "received-emails-xxx" -> "received_emails")
    const tableName = name.split('-').slice(0, -1).join('_').replace(/-/g, '_') || name;
    return new RealtimeChannel(tableName);
  },

  removeChannel(channel: RealtimeChannel): void {
    channel.unsubscribe();
  },
};

// ============================================
// CONVENIENCE EXPORTS
// ============================================

export const api = {
  auth,
  db,
  storage,
  functions,
  realtime,
  
  // Direct fetch for custom endpoints
  fetch: fetchApi,
  
  // Base URL for constructing custom URLs
  baseUrl: API_BASE_URL,
};

export default api;
