import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { AuthUser } from '../lib/types';
import { supabase } from '@/integrations/supabase/client';
import { getProfileByAuthId, setCurrentUser, logout as logoutStorage } from '../lib/storage';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser | null>;
  logout: () => void;
  requestPasswordReset: (email: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => null,
  logout: () => {},
  requestPasswordReset: async () => ({}),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await getProfileByAuthId(session.user.id);
        if (profile) {
          setCurrentUser(profile);
          setUser(profile);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await getProfileByAuthId(session.user.id);
        if (profile) {
          setCurrentUser(profile);
          setUser(profile);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return null;

    const profile = await getProfileByAuthId(data.user.id);
    if (!profile) return null;

    // Check blocked
    const { data: profileRow } = await supabase.from('profiles').select('status, login_count').eq('auth_user_id', data.user.id).single();
    if ((profileRow as any)?.status === 'blocked') {
      await supabase.auth.signOut();
      return null;
    }

    // Update login count
    const newCount = ((profileRow as any)?.login_count ?? 0) + 1;
    await supabase.from('profiles').update({ 
      last_login_at: new Date().toISOString(), 
      login_count: newCount 
    } as any).eq('auth_user_id', data.user.id);

    setCurrentUser(profile);
    setUser(profile);
    return profile;
  }, []);

  const logout = useCallback(() => {
    logoutStorage();
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, requestPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
