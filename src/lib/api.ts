/**
 * Unified API Client - Supports both Lovable Cloud (Supabase) and Self-Hosted PHP Backend
 * 
 * This file provides a unified interface that:
 * - Uses Supabase SDK when running on Lovable Cloud
 * - Uses fetch-based REST API when running on self-hosted PHP backend
 */

// Explicit self-hosted flag (set during cPanel build)
const FORCE_SELF_HOSTED = import.meta.env.VITE_SELF_HOSTED === 'true' || 
                          Boolean(import.meta.env.VITE_PHP_API_URL);

// Auto-detect PHP backend by checking if we're on a non-Lovable domain
const isLovableDomain = typeof window !== 'undefined' && (
  window.location.hostname.includes('lovable.app') ||
  window.location.hostname.includes('lovableproject.com') ||
  window.location.hostname === 'localhost'
);

// Detect which backend to use - FORCE_SELF_HOSTED takes priority
const USE_SUPABASE = !FORCE_SELF_HOSTED && Boolean(
  isLovableDomain &&
  import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

// PHP API URL - auto-detect from current domain or use env variable
const PHP_API_URL = import.meta.env.VITE_PHP_API_URL || 
  (typeof window !== 'undefined' && !isLovableDomain 
    ? `${window.location.origin}/api` 
    : 'https://myserver.com/api');

// Token storage keys for PHP backend
const AUTH_TOKEN_KEY = 'nullsto_auth_token';
const REFRESH_TOKEN_KEY = 'nullsto_refresh_token';

// ============================================
// TYPE DEFINITIONS
// ============================================

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

// ============================================
// PHP BACKEND HELPERS
// ============================================

export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
};

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

export const clearAuthTokens = (): void => {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    console.error('Failed to clear auth tokens');
  }
};

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

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  includeAuth = true
): Promise<ApiResponse<T>> {
  const url = `${PHP_API_URL}${endpoint}`;

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
// SUPABASE IMPORT (conditional)
// ============================================

let supabaseClient: any = null;

const getSupabaseClient = async () => {
  if (!USE_SUPABASE) return null;
  if (supabaseClient) return supabaseClient;
  
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    supabaseClient = supabase;
    return supabase;
  } catch {
    console.warn('Supabase client not available, falling back to PHP API');
    return null;
  }
};

// ============================================
// AUTH API
// ============================================

export const auth = {
  async signUp(email: string, password: string, displayName?: string): Promise<AuthResponse> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: displayName }
          }
        });
        
        if (error) {
          return { user: null, session: null, error: { message: error.message, code: error.code } };
        }
        
        return {
          user: data.user ? {
            id: data.user.id,
            email: data.user.email || '',
            display_name: displayName,
            created_at: data.user.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } : null,
          session: data.session ? {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at || 0,
            user: {
              id: data.user?.id || '',
              email: data.user?.email || '',
              display_name: displayName,
              created_at: data.user?.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          } : null,
          error: null
        };
      }
    }

    // PHP Backend
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
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
          return { user: null, session: null, error: { message: error.message, code: error.code } };
        }
        
        return {
          user: data.user ? {
            id: data.user.id,
            email: data.user.email || '',
            created_at: data.user.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } : null,
          session: data.session ? {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at || 0,
            user: {
              id: data.user?.id || '',
              email: data.user?.email || '',
              created_at: data.user?.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          } : null,
          error: null
        };
      }
    }

    // PHP Backend
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
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        return { data: null, error: error ? { message: error.message } : null };
      }
    }

    const result = await fetchApi<void>('/auth/logout', { method: 'POST' });
    clearAuthTokens();
    return result;
  },

  async getSession(): Promise<AuthResponse> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          return { user: null, session: null, error: { message: error.message } };
        }
        
        return {
          user: session?.user ? {
            id: session.user.id,
            email: session.user.email || '',
            created_at: session.user.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } : null,
          session: session ? {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at || 0,
            user: {
              id: session.user?.id || '',
              email: session.user?.email || '',
              created_at: session.user?.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          } : null,
          error: null
        };
      }
    }

    // PHP Backend
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
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?mode=reset`
        });
        return { data: null, error: error ? { message: error.message } : null };
      }
    }

    return fetchApi<void>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }, false);
  },

  async updatePassword(newPassword: string): Promise<ApiResponse<void>> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        return { data: null, error: error ? { message: error.message } : null };
      }
    }

    return fetchApi<void>('/auth/update-password', {
      method: 'POST',
      body: JSON.stringify({ password: newPassword }),
    });
  },

  async updateProfile(updates: Partial<User>): Promise<ApiResponse<User>> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase.auth.updateUser({
          data: updates
        });
        if (error) {
          return { data: null, error: { message: error.message } };
        }
        return { 
          data: data.user ? {
            id: data.user.id,
            email: data.user.email || '',
            ...updates,
            created_at: data.user.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } : null,
          error: null
        };
      }
    }

    return fetchApi<User>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  // Social auth
  async signInWithGoogle(): Promise<void> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/` }
        });
        return;
      }
    }
    window.location.href = `${PHP_API_URL}/auth/google`;
  },

  async signInWithFacebook(): Promise<void> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        await supabase.auth.signInWithOAuth({
          provider: 'facebook',
          options: { redirectTo: `${window.location.origin}/` }
        });
        return;
      }
    }
    window.location.href = `${PHP_API_URL}/auth/facebook`;
  },

  // Auth state change listener
  onAuthStateChange(callback: (event: string, session: Session | null) => void): { unsubscribe: () => void } {
    if (USE_SUPABASE) {
      // This will be set up synchronously from cached client or async
      let subscription: any = null;
      
      getSupabaseClient().then(supabase => {
        if (supabase) {
          const { data } = supabase.auth.onAuthStateChange((event: string, session: any) => {
            const mappedSession: Session | null = session ? {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_at: session.expires_at || 0,
              user: {
                id: session.user?.id || '',
                email: session.user?.email || '',
                created_at: session.user?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            } : null;
            callback(event, mappedSession);
          });
          subscription = data.subscription;
        }
      });
      
      return {
        unsubscribe: () => {
          if (subscription) {
            subscription.unsubscribe();
          }
        }
      };
    }

    // PHP Backend - poll for session changes
    let lastToken = getAuthToken();
    const interval = setInterval(async () => {
      const currentToken = getAuthToken();
      if (currentToken !== lastToken) {
        lastToken = currentToken;
        if (currentToken) {
          const { session } = await auth.getSession();
          callback('SIGNED_IN', session);
        } else {
          callback('SIGNED_OUT', null);
        }
      }
    }, 1000);

    return {
      unsubscribe: () => clearInterval(interval)
    };
  }
};

// ============================================
// DATABASE API
// ============================================

interface QueryOptions {
  select?: string;
  filter?: Record<string, any>;
  order?: { column: string; ascending?: boolean } | Array<{ column: string; ascending?: boolean }>;
  limit?: number;
  offset?: number;
  single?: boolean;
  eq?: Record<string, any>;
  neq?: Record<string, any>;
  gt?: Record<string, any>;
  gte?: Record<string, any>;
  lt?: Record<string, any>;
  lte?: Record<string, any>;
  like?: Record<string, any>;
  ilike?: Record<string, any>;
  in?: Record<string, any[]>;
  is?: Record<string, any>;
}

export const db = {
  async query<T>(table: string, options: QueryOptions = {}): Promise<ApiResponse<T>> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        let query = supabase.from(table).select(options.select || '*');
        
        // Apply filters
        if (options.eq) {
          Object.entries(options.eq).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }
        if (options.neq) {
          Object.entries(options.neq).forEach(([key, value]) => {
            query = query.neq(key, value);
          });
        }
        if (options.gt) {
          Object.entries(options.gt).forEach(([key, value]) => {
            query = query.gt(key, value);
          });
        }
        if (options.gte) {
          Object.entries(options.gte).forEach(([key, value]) => {
            query = query.gte(key, value);
          });
        }
        if (options.lt) {
          Object.entries(options.lt).forEach(([key, value]) => {
            query = query.lt(key, value);
          });
        }
        if (options.lte) {
          Object.entries(options.lte).forEach(([key, value]) => {
            query = query.lte(key, value);
          });
        }
        if (options.like) {
          Object.entries(options.like).forEach(([key, value]) => {
            query = query.like(key, value);
          });
        }
        if (options.ilike) {
          Object.entries(options.ilike).forEach(([key, value]) => {
            query = query.ilike(key, value);
          });
        }
        if (options.in) {
          Object.entries(options.in).forEach(([key, values]) => {
            query = query.in(key, values);
          });
        }
        if (options.is) {
          Object.entries(options.is).forEach(([key, value]) => {
            query = query.is(key, value);
          });
        }
        if (options.filter) {
          Object.entries(options.filter).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }
        
        // Apply ordering
        if (options.order) {
          const orders = Array.isArray(options.order) ? options.order : [options.order];
          orders.forEach(o => {
            query = query.order(o.column, { ascending: o.ascending ?? true });
          });
        }
        
        if (options.limit) query = query.limit(options.limit);
        if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
        if (options.single) query = query.single();
        
        const { data, error } = await query;
        return { data: data as T, error: error ? { message: error.message, code: error.code } : null };
      }
    }

    // PHP Backend
    const params = new URLSearchParams();

    if (options.select) params.set('select', options.select);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    if (options.single) params.set('single', 'true');
    
    if (options.order) {
      const orders = Array.isArray(options.order) ? options.order : [options.order];
      params.set('order', orders.map(o => `${o.column}.${o.ascending ? 'asc' : 'desc'}`).join(','));
    }
    
    // Add all filter types
    const addFilters = (type: string, obj?: Record<string, any>) => {
      if (obj) {
        Object.entries(obj).forEach(([key, value]) => {
          params.set(`${type}[${key}]`, Array.isArray(value) ? value.join(',') : String(value));
        });
      }
    };
    
    addFilters('eq', options.eq || options.filter);
    addFilters('neq', options.neq);
    addFilters('gt', options.gt);
    addFilters('gte', options.gte);
    addFilters('lt', options.lt);
    addFilters('lte', options.lte);
    addFilters('like', options.like);
    addFilters('ilike', options.ilike);
    addFilters('in', options.in);
    addFilters('is', options.is);

    const queryString = params.toString();
    const endpoint = `/data/${table}${queryString ? `?${queryString}` : ''}`;

    return fetchApi<T>(endpoint);
  },

  async insert<T>(table: string, data: Record<string, any> | Record<string, any>[], options?: { select?: string }): Promise<ApiResponse<T>> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        let query = supabase.from(table).insert(data);
        if (options?.select) {
          query = query.select(options.select);
        }
        const result = await query;
        return { data: result.data as T, error: result.error ? { message: result.error.message } : null };
      }
    }

    return fetchApi<T>(`/data/${table}`, {
      method: 'POST',
      body: JSON.stringify({ data, select: options?.select }),
    });
  },

  async update<T>(
    table: string,
    data: Record<string, any>,
    filter: Record<string, any>,
    options?: { select?: string }
  ): Promise<ApiResponse<T>> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        let query = supabase.from(table).update(data);
        Object.entries(filter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
        if (options?.select) {
          query = query.select(options.select);
        }
        const result = await query;
        return { data: result.data as T, error: result.error ? { message: result.error.message } : null };
      }
    }

    const params = new URLSearchParams();
    Object.entries(filter).forEach(([key, value]) => {
      params.set(`filter[${key}]`, String(value));
    });

    return fetchApi<T>(`/data/${table}?${params.toString()}`, {
      method: 'PATCH',
      body: JSON.stringify({ data, select: options?.select }),
    });
  },

  async upsert<T>(
    table: string,
    data: Record<string, any> | Record<string, any>[],
    options?: { onConflict?: string; select?: string }
  ): Promise<ApiResponse<T>> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        let query = supabase.from(table).upsert(data, { onConflict: options?.onConflict });
        if (options?.select) {
          query = query.select(options.select);
        }
        const result = await query;
        return { data: result.data as T, error: result.error ? { message: result.error.message } : null };
      }
    }

    return fetchApi<T>(`/data/${table}/upsert`, {
      method: 'POST',
      body: JSON.stringify({ data, onConflict: options?.onConflict, select: options?.select }),
    });
  },

  async delete(table: string, filter: Record<string, any>): Promise<ApiResponse<void>> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        let query = supabase.from(table).delete();
        Object.entries(filter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
        const { error } = await query;
        return { data: null, error: error ? { message: error.message } : null };
      }
    }

    const params = new URLSearchParams();
    Object.entries(filter).forEach(([key, value]) => {
      params.set(`filter[${key}]`, String(value));
    });

    return fetchApi<void>(`/data/${table}?${params.toString()}`, {
      method: 'DELETE',
    });
  },

  async rpc<T>(functionName: string, params: Record<string, any> = {}): Promise<ApiResponse<T>> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase.rpc(functionName, params);
        return { data: data as T, error: error ? { message: error.message, code: error.code } : null };
      }
    }

    return fetchApi<T>(`/rpc/${functionName}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};

// ============================================
// STORAGE API
// ============================================

export const storage = {
  async upload(
    bucket: string,
    path: string,
    file: File
  ): Promise<ApiResponse<{ path: string; url: string }>> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: '3600',
          upsert: true
        });
        if (error) {
          return { data: null, error: { message: error.message } };
        }
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
        return { data: { path: data.path, url: urlData.publicUrl }, error: null };
      }
    }

    // PHP Backend
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
      const response = await fetch(`${PHP_API_URL}/storage/upload`, {
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
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase.storage.from(bucket).download(path);
        return { data, error: error ? { message: error.message } : null };
      }
    }

    try {
      const token = getAuthToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${PHP_API_URL}/storage/download?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`,
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
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { error } = await supabase.storage.from(bucket).remove(paths);
        return { data: null, error: error ? { message: error.message } : null };
      }
    }

    return fetchApi<void>('/storage/delete', {
      method: 'DELETE',
      body: JSON.stringify({ bucket, paths }),
    });
  },

  getPublicUrl(bucket: string, path: string): string {
    if (USE_SUPABASE) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
    }
    return `${PHP_API_URL}/storage/public/${bucket}/${path}`;
  },
};

// ============================================
// FUNCTIONS API (Edge Functions / PHP Functions)
// ============================================

export const functions = {
  async invoke<T>(
    functionName: string,
    options: { body?: any; headers?: Record<string, string> } = {}
  ): Promise<ApiResponse<T>> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: options.body,
          headers: options.headers
        });
        return { data: data as T, error: error ? { message: error.message } : null };
      }
    }

    return fetchApi<T>(`/functions/${functionName}`, {
      method: 'POST',
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: options.headers,
    });
  },
};

// ============================================
// REALTIME API (with SSE support for PHP backend)
// ============================================

type RealtimeCallback = (payload: { eventType: string; new: any; old?: any }) => void;

interface RealtimeFilterConfig {
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema?: string;
  table?: string;
  filter?: string;
}

class RealtimeChannel {
  private channelName: string;
  private callbacks: Array<{ filter: RealtimeFilterConfig; callback: RealtimeCallback }> = [];
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastDataMap: Map<string, any[]> = new Map();
  private supabaseChannel: any = null;
  private eventSource: EventSource | null = null;
  private pollIntervalMs: number = 2000; // Fast polling fallback: 2 seconds
  private useSSE: boolean = true; // Try SSE first

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  on(
    type: 'postgres_changes',
    filter: RealtimeFilterConfig,
    callback: RealtimeCallback
  ): this {
    this.callbacks.push({ filter, callback });
    return this;
  }

  async subscribe(statusCallback?: (status: string, error?: any) => void): Promise<this> {
    if (USE_SUPABASE) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        let channel = supabase.channel(this.channelName);
        
        this.callbacks.forEach(({ filter, callback }) => {
          channel = channel.on('postgres_changes', filter, (payload: any) => {
            callback({
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old
            });
          });
        });
        
        this.supabaseChannel = channel.subscribe((status: string, err?: any) => {
          if (statusCallback) {
            statusCallback(status, err);
          }
        });
        
        return this;
      }
    }

    // PHP Backend - Try SSE first, fall back to polling
    if (this.useSSE && this.callbacks.length > 0) {
      const filter = this.callbacks[0].filter;
      if (filter.filter) {
        const match = filter.filter.match(/temp_email_id=eq\.(.+)/);
        if (match) {
          const tempEmailId = match[1];
          try {
            await this.connectSSE(tempEmailId, statusCallback);
            return this;
          } catch (err) {
            console.warn('SSE connection failed, falling back to polling:', err);
            this.useSSE = false;
          }
        }
      }
    }

    // Fallback to polling
    if (statusCallback) {
      statusCallback('SUBSCRIBED');
    }
    
    this.poll();
    this.pollInterval = setInterval(() => this.poll(), this.pollIntervalMs);
    
    return this;
  }

  private connectSSE(tempEmailId: string, statusCallback?: (status: string, error?: any) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const token = getAuthToken();
      const sseUrl = new URL(`${PHP_API_URL}/sse`);
      sseUrl.searchParams.set('temp_email_id', tempEmailId);
      if (token) {
        sseUrl.searchParams.set('token', token);
      }

      this.eventSource = new EventSource(sseUrl.toString());
      
      this.eventSource.onopen = () => {
        if (statusCallback) {
          statusCallback('SUBSCRIBED');
        }
        resolve();
      };

      this.eventSource.addEventListener('connected', (e: MessageEvent) => {
        console.log('SSE connected:', JSON.parse(e.data));
      });

      this.eventSource.addEventListener('new_email', (e: MessageEvent) => {
        const emailData = JSON.parse(e.data);
        this.callbacks.forEach(({ callback }) => {
          callback({
            eventType: 'INSERT',
            new: emailData
          });
        });
      });

      this.eventSource.addEventListener('heartbeat', () => {
        // Keep-alive, no action needed
      });

      this.eventSource.addEventListener('reconnect', () => {
        // Server asking us to reconnect
        this.reconnectSSE(tempEmailId, statusCallback);
      });

      this.eventSource.addEventListener('error', (e: MessageEvent) => {
        const errorData = e.data ? JSON.parse(e.data) : { message: 'Unknown error' };
        console.error('SSE error:', errorData);
      });

      this.eventSource.onerror = (err) => {
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          console.warn('SSE connection closed, reconnecting...');
          setTimeout(() => this.reconnectSSE(tempEmailId, statusCallback), 2000);
        } else {
          reject(err);
        }
      };

      // Timeout for initial connection
      setTimeout(() => {
        if (this.eventSource?.readyState !== EventSource.OPEN) {
          reject(new Error('SSE connection timeout'));
        }
      }, 5000);
    });
  }

  private reconnectSSE(tempEmailId: string, statusCallback?: (status: string, error?: any) => void): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    setTimeout(() => {
      this.connectSSE(tempEmailId, statusCallback).catch(err => {
        console.error('SSE reconnection failed, switching to polling:', err);
        this.useSSE = false;
        if (statusCallback) {
          statusCallback('SUBSCRIBED');
        }
        this.poll();
        this.pollInterval = setInterval(() => this.poll(), this.pollIntervalMs);
      });
    }, 1000);
  }

  unsubscribe(): void {
    if (this.supabaseChannel) {
      this.supabaseChannel.unsubscribe();
      this.supabaseChannel = null;
    }
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async poll(): Promise<void> {
    for (const { filter, callback } of this.callbacks) {
      try {
        const table = filter.table || this.channelName;
        const filterObj: Record<string, any> = {};
        
        // Parse filter string like "temp_email_id=eq.xxx"
        if (filter.filter) {
          const [key, value] = filter.filter.split('=eq.');
          if (key && value) {
            filterObj[key] = value;
          }
        }
        
        const { data, error } = await db.query<any[]>(table, {
          filter: filterObj,
          order: { column: 'received_at', ascending: false },
          limit: 50,
        });

        if (error || !data) continue;

        const cacheKey = `${table}-${JSON.stringify(filterObj)}`;
        const lastData = this.lastDataMap.get(cacheKey) || [];
        const oldIds = new Set(lastData.map((item) => item.id));
        const newItems = data.filter((item) => !oldIds.has(item.id));

        newItems.forEach((item) => {
          callback({ eventType: 'INSERT', new: item });
        });

        this.lastDataMap.set(cacheKey, data);
      } catch (err) {
        console.error('Realtime poll error:', err);
      }
    }
  }
}

export const realtime = {
  channel(name: string): RealtimeChannel {
    return new RealtimeChannel(name);
  },

  removeChannel(channel: RealtimeChannel): void {
    channel.unsubscribe();
  },
};

// ============================================
// ADMIN API
// ============================================

export const admin = {
  // Users management
  async getUsers(options: { page?: number; pageSize?: number; search?: string } = {}): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.rpc('get_all_profiles_for_admin', {
        p_page: options.page || 1,
        p_page_size: options.pageSize || 50,
        p_search: options.search || null
      });
    }
    return fetchApi('/admin/users', {
      method: 'GET',
    });
  },

  async deleteUser(userId: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.rpc('delete_user_as_admin', { target_user_id: userId });
    }
    return fetchApi(`/admin/users/${userId}`, { method: 'DELETE' });
  },

  async suspendUser(userId: string, reason?: string, until?: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.rpc('suspend_user', {
        target_user_id: userId,
        suspension_reason: reason,
        suspend_until: until
      });
    }
    return fetchApi(`/admin/users/${userId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason, until })
    });
  },

  async unsuspendUser(userId: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.rpc('unsuspend_user', { target_user_id: userId });
    }
    return fetchApi(`/admin/users/${userId}/unsuspend`, { method: 'POST' });
  },

  // Domains management
  async getDomains(): Promise<ApiResponse<any>> {
    return db.query('domains', { order: { column: 'name', ascending: true } });
  },

  async addDomain(name: string, isPremium: boolean): Promise<ApiResponse<any>> {
    return db.insert('domains', { name, is_premium: isPremium, is_active: true });
  },

  async updateDomain(id: string, updates: Record<string, any>): Promise<ApiResponse<any>> {
    return db.update('domains', updates, { id });
  },

  async deleteDomain(id: string): Promise<ApiResponse<any>> {
    return db.delete('domains', { id });
  },

  // Mailboxes management
  async getMailboxes(): Promise<ApiResponse<any>> {
    return db.query('mailboxes', { order: { column: 'priority', ascending: false } });
  },

  async saveMailbox(mailbox: Record<string, any>): Promise<ApiResponse<any>> {
    if (mailbox.id) {
      return db.update('mailboxes', mailbox, { id: mailbox.id });
    }
    return db.insert('mailboxes', mailbox);
  },

  async deleteMailbox(id: string): Promise<ApiResponse<any>> {
    return db.delete('mailboxes', { id });
  },

  async testMailbox(type: 'smtp' | 'imap', config: Record<string, any>): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return functions.invoke(type === 'smtp' ? 'smtp-connectivity-test' : 'fetch-imap-emails', {
        body: { ...config, test_only: true }
      });
    }
    return fetchApi(`/admin/mailboxes/test-${type}`, {
      method: 'POST',
      body: JSON.stringify(config)
    });
  },

  async pollIMAP(mailboxId: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return functions.invoke('fetch-imap-emails', { body: { mailbox_id: mailboxId } });
    }
    return fetchApi(`/admin/mailboxes/${mailboxId}/poll`, { method: 'POST' });
  },

  // Email logs
  async getEmailLogs(options: { page?: number; pageSize?: number; search?: string; status?: string } = {}): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.rpc('get_email_logs', {
        p_page: options.page || 1,
        p_page_size: options.pageSize || 50,
        p_search: options.search || null,
        p_status_filter: options.status || null
      });
    }
    const params = new URLSearchParams();
    if (options.page) params.set('page', String(options.page));
    if (options.pageSize) params.set('page_size', String(options.pageSize));
    if (options.search) params.set('search', options.search);
    if (options.status) params.set('status', options.status);
    return fetchApi(`/admin/email-logs?${params.toString()}`);
  },

  async getEmailStats(): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.rpc('get_email_stats');
    }
    return fetchApi('/admin/email-stats');
  },

  // Audit logs
  async getAuditLogs(options: { page?: number; pageSize?: number; action?: string } = {}): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.rpc('get_admin_audit_logs', {
        p_page: options.page || 1,
        p_page_size: options.pageSize || 50,
        p_action_filter: options.action || null
      });
    }
    const params = new URLSearchParams();
    if (options.page) params.set('page', String(options.page));
    if (options.pageSize) params.set('page_size', String(options.pageSize));
    if (options.action) params.set('action', options.action);
    return fetchApi(`/admin/audit-logs?${params.toString()}`);
  },

  // Settings management
  async getSettings(key: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.query('app_settings', { eq: { key }, single: true });
    }
    return fetchApi(`/admin/settings?key=${encodeURIComponent(key)}`, {
      method: 'GET'
    });
  },

  async saveSettings(key: string, value: any): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.upsert('app_settings', { key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    return fetchApi('/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ action: 'settings', key, value })
    });
  },

  // Alias for saveSettings
  async updateSettings(key: string, value: any): Promise<ApiResponse<any>> {
    return this.saveSettings(key, value);
  },

  // Banners management
  async getBanners(): Promise<ApiResponse<any>> {
    return db.query('banners', { order: { column: 'priority', ascending: false } });
  },

  async saveBanner(banner: Record<string, any>): Promise<ApiResponse<any>> {
    if (banner.id) {
      return db.update('banners', banner, { id: banner.id });
    }
    return db.insert('banners', banner);
  },

  async deleteBanner(id: string): Promise<ApiResponse<any>> {
    return db.delete('banners', { id });
  },

  // Subscriptions management
  async getSubscriptionTiers(): Promise<ApiResponse<any>> {
    return db.query('subscription_tiers', { eq: { is_active: true }, order: { column: 'price_monthly', ascending: true } });
  },

  async findUserByEmail(email: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.rpc('find_user_by_email', { search_email: email });
    }
    return fetchApi(`/admin/users/search?email=${encodeURIComponent(email)}`);
  },

  async getUserSubscription(userId: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.rpc('admin_get_user_subscription', { target_user_id: userId });
    }
    return fetchApi(`/admin/users/${userId}/subscription`);
  },

  async assignSubscription(userId: string, tierId: string, durationMonths: number): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.rpc('admin_assign_subscription', {
        target_user_id: userId,
        target_tier_id: tierId,
        duration_months: durationMonths
      });
    }
    return fetchApi(`/admin/users/${userId}/subscription`, {
      method: 'POST',
      body: JSON.stringify({ tier_id: tierId, duration_months: durationMonths })
    });
  },

  async revokeSubscription(userId: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.rpc('admin_revoke_subscription', { target_user_id: userId });
    }
    return fetchApi(`/admin/users/${userId}/subscription`, { method: 'DELETE' });
  },

  // Blogs management
  async getBlogs(): Promise<ApiResponse<any>> {
    return db.query('blogs', { order: { column: 'created_at', ascending: false } });
  },

  async saveBlog(blog: Record<string, any>): Promise<ApiResponse<any>> {
    if (blog.id) {
      return db.update('blogs', { ...blog, updated_at: new Date().toISOString() }, { id: blog.id });
    }
    return db.insert('blogs', blog);
  },

  async deleteBlog(id: string): Promise<ApiResponse<any>> {
    return db.delete('blogs', { id });
  },

  // Cron jobs management
  async getCronJobs(): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      // Supabase doesn't have a cron jobs table - return mock data
      return { data: [], error: null };
    }
    return fetchApi('/admin/cron-jobs', {
      method: 'POST',
      body: JSON.stringify({ action: 'cron-jobs' })
    });
  },

  async runCronJob(jobId: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      // Trigger specific edge function based on job
      const jobMap: Record<string, string> = {
        'clean-emails': 'auto-delete-emails',
        'imap-poll': 'imap-poll-cron',
        'cleanup-backups': 'cleanup-old-backups'
      };
      const functionName = jobMap[jobId];
      if (functionName) {
        return functions.invoke(functionName);
      }
      return { data: null, error: { message: 'Unknown cron job' } };
    }
    return fetchApi('/admin/cron-job-run', {
      method: 'POST',
      body: JSON.stringify({ action: 'cron-job-run', job_id: jobId })
    });
  },

  async toggleCronJob(jobId: string, enabled: boolean): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return { data: null, error: { message: 'Cron management requires PHP backend' } };
    }
    return fetchApi('/admin/cron-job-toggle', {
      method: 'POST',
      body: JSON.stringify({ action: 'cron-job-toggle', job_id: jobId, enabled })
    });
  },

  // Backup management
  async getBackupHistory(): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.query('backup_history', { 
        order: { column: 'created_at', ascending: false },
        limit: 10 
      });
    }
    return fetchApi('/admin/backup-history', {
      method: 'POST',
      body: JSON.stringify({ action: 'backup-history' })
    });
  },

  async generateBackup(): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return functions.invoke('generate-backup');
    }
    return fetchApi('/admin/backup-generate', {
      method: 'POST',
      body: JSON.stringify({ action: 'backup-generate' })
    });
  },

  async deleteBackupRecord(id: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.delete('backup_history', { id });
    }
    return fetchApi('/admin/backup-delete', {
      method: 'POST',
      body: JSON.stringify({ action: 'backup-delete', id })
    });
  },

  // Themes management (stored in app_settings)
  async getThemes(): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.query('app_settings', { eq: { key: 'custom_themes' }, single: true });
    }
    return fetchApi('/admin/themes-get', {
      method: 'POST',
      body: JSON.stringify({ action: 'themes-get' })
    });
  },

  async saveThemes(themes: any[]): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.upsert('app_settings', { 
        key: 'custom_themes', 
        value: themes, 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'key' });
    }
    return fetchApi('/admin/themes-save', {
      method: 'POST',
      body: JSON.stringify({ action: 'themes-save', themes })
    });
  },

  // Analytics
  async getAnalytics(days: number = 7): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      // Use existing db queries for Supabase
      return { data: null, error: null };
    }
    return fetchApi('/admin/analytics', {
      method: 'POST',
      body: JSON.stringify({ action: 'analytics', period: `${days}d` })
    });
  },

  // Dashboard stats
  async getDashboardStats(): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return { data: null, error: null };
    }
    return fetchApi('/admin/dashboard', {
      method: 'POST',
      body: JSON.stringify({ action: 'dashboard' })
    });
  },

  // Health Dashboard
  async getMailboxHealth(): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      // Supabase uses direct DB queries from the component
      return { data: null, error: null };
    }
    return fetchApi('/admin/mailbox-health', {
      method: 'POST',
      body: JSON.stringify({ action: 'mailbox-health' })
    });
  },

  async clearMailboxError(mailboxId: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.update('mailboxes', { last_error: null, last_error_at: null }, { id: mailboxId });
    }
    return fetchApi('/admin/mailbox-clear-error', {
      method: 'POST',
      body: JSON.stringify({ action: 'mailbox-clear-error', mailbox_id: mailboxId })
    });
  },

  // DNS Verification
  async verifyDomainDNS(domain: string, verificationToken?: string, skipDnsCheck?: boolean): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return functions.invoke('check-email-config', { body: { check_dns: true, domain, verification_token: verificationToken } });
    }
    return fetchApi('/admin/domain-verify-dns', {
      method: 'POST',
      body: JSON.stringify({ action: 'domain-verify-dns', domain, verification_token: verificationToken, skip_dns_check: skipDnsCheck })
    });
  },

  // Cron Logs
  async getCronLogs(jobId?: string, limit: number = 50): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return { data: { logs: [] }, error: null };
    }
    return fetchApi('/admin/cron-logs', {
      method: 'POST',
      body: JSON.stringify({ action: 'cron-logs', job_id: jobId, limit })
    });
  },

  // Error Logs (PHP backend only)
  async getErrorLogs(options: { type?: string; limit?: number; search?: string; level?: string } = {}): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return { data: { logs: [], count: 0 }, error: null };
    }
    const params = new URLSearchParams();
    if (options.type) params.set('type', options.type);
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.search) params.set('search', options.search);
    if (options.level) params.set('level', options.level);
    
    return fetchApi(`/logs/recent?${params.toString()}`, {
      method: 'GET'
    });
  },

  async getLogStats(): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return { data: null, error: null };
    }
    return fetchApi('/logs/stats', {
      method: 'GET'
    });
  },

  async clearLogs(type: string = 'all'): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return { data: null, error: null };
    }
    return fetchApi('/logs/clear', {
      method: 'POST',
      body: JSON.stringify({ type })
    });
  },

  // Deployment Health Check (PHP backend only)
  async getDeploymentHealth(): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return { data: null, error: { message: 'Deployment health check requires PHP backend' } };
    }
    return fetchApi('/admin/deployment-health', {
      method: 'POST',
      body: JSON.stringify({ action: 'deployment-health' })
    });
  },

  // Rate Limits Configuration
  async getRateLimitsConfig(): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.query('app_settings', { eq: { key: 'rate_limits_config' }, single: true });
    }
    return fetchApi('/admin/rate-limits-config', {
      method: 'POST',
      body: JSON.stringify({ action: 'rate-limits-config' })
    });
  },

  async saveRateLimitsConfig(config: any): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.upsert('app_settings', { 
        key: 'rate_limits_config', 
        value: config, 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'key' });
    }
    return fetchApi('/admin/rate-limits-config-save', {
      method: 'POST',
      body: JSON.stringify({ action: 'rate-limits-config-save', config })
    });
  },

  // Alert Settings
  async getAlertSettings(): Promise<ApiResponse<any>> {
    return this.getSettings('alert_settings');
  },

  async saveAlertSettings(settings: any): Promise<ApiResponse<any>> {
    return this.saveSettings('alert_settings', settings);
  },

  async getAlertLogs(): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.query('alert_logs', { 
        order: { column: 'sent_at', ascending: false },
        limit: 50
      });
    }
    return fetchApi('/admin/alert-logs', {
      method: 'POST',
      body: JSON.stringify({ action: 'alert-logs' })
    });
  },

  async sendTestAlert(email: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return functions.invoke('send-test-email', {
        body: {
          to: email,
          subject: '[Test] TempMail Alert System',
          body: 'This is a test alert from your TempMail installation.',
        },
      });
    }
    return fetchApi('/admin/test-alert', {
      method: 'POST',
      body: JSON.stringify({ action: 'test-alert', email })
    });
  },

  // Domain Wizard
  async startDomainWizard(domain: string, isPremium: boolean): Promise<ApiResponse<any>> {
    return this.addDomain(domain, isPremium);
  },

  async checkDomainDNSStep(domain: string, recordType: string): Promise<ApiResponse<any>> {
    return this.verifyDomainDNS(domain);
  },

  async completeDomainWizard(domainId: string): Promise<ApiResponse<any>> {
    return this.updateDomain(domainId, { is_active: true, setup_status: 'active' });
  },

  // Scheduled Maintenance
  async getMaintenance(): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.query('scheduled_maintenance', {
        order: { column: 'scheduled_start', ascending: false }
      }).then(res => ({
        data: { maintenance: res.data || [] },
        error: res.error
      }));
    }
    return fetchApi('/admin/maintenance-list', {
      method: 'POST',
      body: JSON.stringify({ action: 'maintenance-list' })
    });
  },

  async createMaintenance(data: { title: string; description?: string; scheduled_start: string; scheduled_end?: string; affected_services?: string[] }): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.insert('scheduled_maintenance', {
        ...data,
        affected_services: data.affected_services || [],
        status: 'scheduled'
      });
    }
    return fetchApi('/admin/maintenance-create', {
      method: 'POST',
      body: JSON.stringify({ action: 'maintenance-create', ...data })
    });
  },

  async updateMaintenance(id: string, data: any): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.update('scheduled_maintenance', id, data);
    }
    return fetchApi('/admin/maintenance-update', {
      method: 'POST',
      body: JSON.stringify({ action: 'maintenance-update', id, ...data })
    });
  },

  async startMaintenance(id: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.update('scheduled_maintenance', id, { status: 'in_progress' });
    }
    return fetchApi('/admin/maintenance-start', {
      method: 'POST',
      body: JSON.stringify({ action: 'maintenance-start', id })
    });
  },

  async completeMaintenance(id: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.update('scheduled_maintenance', id, { status: 'completed' });
    }
    return fetchApi('/admin/maintenance-complete', {
      method: 'POST',
      body: JSON.stringify({ action: 'maintenance-complete', id })
    });
  },

  async cancelMaintenance(id: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.update('scheduled_maintenance', id, { status: 'cancelled' });
    }
    return fetchApi('/admin/maintenance-cancel', {
      method: 'POST',
      body: JSON.stringify({ action: 'maintenance-cancel', id })
    });
  },

  async deleteMaintenance(id: string): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      return db.delete('scheduled_maintenance', id);
    }
    return fetchApi('/admin/maintenance-delete', {
      method: 'POST',
      body: JSON.stringify({ action: 'maintenance-delete', id })
    });
  },

  // Public Status
  async getPublicStatus(): Promise<ApiResponse<any>> {
    if (USE_SUPABASE) {
      // Get maintenance from database
      const maintenance = await db.query('scheduled_maintenance', {
        order: { column: 'scheduled_start', ascending: true }
      });
      const incidents = await db.query('status_incidents', {
        order: { column: 'created_at', ascending: false },
        limit: 10
      });
      return {
        data: {
          uptime: { overall: 99.9, imap: 99.8, smtp: 99.9, database: 100 },
          incidents: incidents.data || [],
          maintenance: (maintenance.data || []).filter((m: any) => m.status === 'scheduled' || m.status === 'in_progress')
        },
        error: null
      };
    }
    return fetchApi('/public-status', { method: 'GET' }, false);
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
  admin,
  
  // Direct fetch for custom endpoints (PHP only)
  fetch: fetchApi,
  
  // Base URL for constructing custom URLs
  get baseUrl() {
    return USE_SUPABASE ? import.meta.env.VITE_SUPABASE_URL : PHP_API_URL;
  },
  
  // Check which backend is in use
  isSupabase: USE_SUPABASE,
  isPHP: !USE_SUPABASE,
  
  // Helper method to check if PHP backend
  isPhpBackend(): boolean {
    return !USE_SUPABASE;
  },
};

export default api;
