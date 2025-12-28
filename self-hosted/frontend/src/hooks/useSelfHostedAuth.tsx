import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, User } from '../lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string, totpCode?: string) => Promise<{ error?: string; requires2FA?: boolean }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<{ error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = api.getAuthToken();
    
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.auth.getUser();
      
      if (response.success && response.data?.user) {
        setUser(response.data.user);
      } else {
        // Token invalid, clear it
        api.setAuthToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      api.setAuthToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      const response = await api.auth.register(email, password, name);
      
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        return {};
      }
      
      return { error: response.error || 'Registration failed' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Registration failed' };
    }
  };

  const signIn = async (email: string, password: string, totpCode?: string) => {
    try {
      const response = await api.auth.login(email, password, totpCode);
      
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        return {};
      }
      
      if (response.data?.requires_2fa) {
        return { requires2FA: true };
      }
      
      return { error: response.error || 'Login failed' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Login failed' };
    }
  };

  const signOut = async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      const response = await api.auth.updateProfile(data);
      
      if (response.success) {
        // Refresh user data
        await loadUser();
        return {};
      }
      
      return { error: response.error || 'Update failed' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Update failed' };
    }
  };

  const refreshUser = async () => {
    await loadUser();
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin || false,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

export default useAuth;
