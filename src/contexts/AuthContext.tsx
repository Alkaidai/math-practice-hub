import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { AuthUser } from '../lib/types';
import { supabase } from '@/integrations/supabase/client';
import { getProfileByAuthId, setCurrentUser, logout as logoutStorage } from '../lib/storage';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<AuthUser | null>;
  logout: () => void;
  requestPasswordReset: (email: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  login: async () => null,
  logout: () => {},
  requestPasswordReset: async () => ({}),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(authUserId: string) {
      try {
        const profile = await getProfileByAuthId(authUserId);
        if (cancelled) return;
        if (profile) {
          setCurrentUser(profile);
          setUser(profile);
          setError(null);
        } else {
          // Session exists but no profile — don't block the app
          console.warn('Auth session found but no matching profile for', authUserId);
          setUser(null);
          setError('Perfil não encontrado. Contate o administrador.');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading profile:', err);
        setUser(null);
        setError('Erro ao carregar perfil.');
      }
    }

    // 1. Check initial session FIRST
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user) {
        await loadProfile(session.user.id);
      }
      if (!cancelled) {
        setLoading(false);
        setInitialized(true);
      }
    }).catch(() => {
      if (!cancelled) {
        setLoading(false);
        setInitialized(true);
      }
    });

    // 2. Listen for auth changes AFTER initial load
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!initialized && !cancelled) return; // Skip during initial load to avoid race
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setError(null);
        return;
      }
      
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY')) {
        await loadProfile(session.user.id);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [initialized]);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser | null> => {
    setError(null);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !data.user) {
      setError('Email ou senha inválidos.');
      return null;
    }

    const profile = await getProfileByAuthId(data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      setError('Perfil não encontrado. Contate o administrador.');
      return null;
    }

    // Check blocked
    const { data: profileRow } = await supabase.from('profiles').select('status, login_count').eq('auth_user_id', data.user.id).single();
    if ((profileRow as any)?.status === 'blocked') {
      await supabase.auth.signOut();
      setError('Conta bloqueada. Contate o administrador.');
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

  const logout = useCallback(async () => {
    logoutStorage();
    setUser(null);
    setError(null);
    await supabase.auth.signOut();
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<{ error?: string }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, requestPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
