import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { api, User, Session, clearAuthTokens, getAuthToken } from '@/lib/api';
import { toast } from 'sonner';

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null; data: { user: User | null } | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithFacebook: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await api.db.query<Profile>('profiles', {
      filter: { user_id: userId },
      single: true,
    });

    if (!error && data) {
      setProfile(data);
    }
  }, []);

  const checkAdminStatus = useCallback(async (userId: string) => {
    const { data, error } = await api.db.rpc<boolean>('is_admin', { _user_id: userId });
    if (!error) {
      setIsAdmin(data === true);
    }
  }, []);

  // Initialize auth state on mount
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // Check if we have a stored token
      const token = getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Validate session with backend
      const { user: sessionUser, session: sessionData, error } = await api.auth.getSession();

      if (!isMounted) return;

      if (error || !sessionUser) {
        clearAuthTokens();
        setIsLoading(false);
        return;
      }

      setUser(sessionUser);
      setSession(sessionData);

      // Fetch profile and admin status in parallel
      await Promise.all([
        fetchProfile(sessionUser.id),
        checkAdminStatus(sessionUser.id),
      ]);

      if (isMounted) {
        setIsLoading(false);
      }
    };

    initAuth();

    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('token');
    const refreshToken = urlParams.get('refresh_token');
    
    if (authToken) {
      // OAuth callback - store tokens and reload
      import('@/lib/api').then(({ setAuthTokens }) => {
        setAuthTokens(authToken, refreshToken || undefined);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        // Reload to initialize with new tokens
        window.location.reload();
      });
    }

    return () => {
      isMounted = false;
    };
  }, [fetchProfile, checkAdminStatus]);

  const signUp = async (email: string, password: string, name?: string): Promise<{ error: Error | null; data: { user: User | null } | null }> => {
    try {
      const { user: newUser, session: newSession, error } = await api.auth.signUp(email, password, name);

      if (error) {
        return { error: new Error(error.message), data: null };
      }

      if (newUser) {
        setUser(newUser);
        setSession(newSession);
        if (newUser.id) {
          await Promise.all([
            fetchProfile(newUser.id),
            checkAdminStatus(newUser.id),
          ]);
        }
      }

      return { error: null, data: { user: newUser } };
    } catch (error) {
      return { error: error as Error, data: null };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const { user: authUser, session: authSession, error } = await api.auth.signIn(email, password);

      if (error) {
        return { error: new Error(error.message) };
      }

      if (authUser) {
        setUser(authUser);
        setSession(authSession);
        await Promise.all([
          fetchProfile(authUser.id),
          checkAdminStatus(authUser.id),
        ]);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    try {
      api.auth.signInWithGoogle();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithFacebook = async (): Promise<{ error: Error | null }> => {
    try {
      api.auth.signInWithFacebook();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await api.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;

    const { error } = await api.db.update('profiles', updates, { user_id: user.id });

    if (error) {
      toast.error('Failed to update profile');
      return;
    }

    // Refresh profile data
    await fetchProfile(user.id);
    toast.success('Profile updated successfully');
  };

  const resetPassword = async (email: string): Promise<{ error: Error | null }> => {
    try {
      const { error } = await api.auth.resetPassword(email);

      if (error) {
        return { error: new Error(error.message) };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ error: Error | null }> => {
    try {
      const { error } = await api.auth.updatePassword(newPassword);

      if (error) {
        return { error: new Error(error.message) };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: user as any, // Cast for compatibility
        session: session as any,
        profile,
        isLoading,
        isAdmin,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithFacebook,
        signOut,
        updateProfile,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  
  // During HMR, context might temporarily be undefined
  // Return a safe loading state instead of throwing to prevent crashes
  if (context === undefined) {
    if (import.meta.env.DEV) {
      console.warn('useAuth called outside AuthProvider - returning loading state');
    }
    return {
      user: null,
      session: null,
      profile: null,
      isLoading: true,
      isAdmin: false,
      signUp: async () => ({ error: new Error('Auth not ready'), data: null }),
      signIn: async () => ({ error: new Error('Auth not ready') }),
      signInWithGoogle: async () => ({ error: new Error('Auth not ready') }),
      signInWithFacebook: async () => ({ error: new Error('Auth not ready') }),
      signOut: async () => {},
      updateProfile: async () => {},
      resetPassword: async () => ({ error: new Error('Auth not ready') }),
      updatePassword: async () => ({ error: new Error('Auth not ready') }),
    };
  }
  return context;
};

// Re-export for backward compatibility
export { AuthProvider as default };
