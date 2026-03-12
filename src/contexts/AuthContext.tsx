import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { AuthUser } from '../lib/types';
import { supabase } from '@/integrations/supabase/client';
import { getProfileByAuthId, setCurrentUser, logout as logoutStorage } from '../lib/storage';
import { subscribeVisibilityChange } from '../lib/visibility';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<AuthUser | null>;
  logout: () => void;
  requestPasswordReset: (email: string) => Promise<{ error?: string }>;
  /** Resolves when auth is ready after a tab return. Components should await this before fetching data. */
  waitForAuthReady: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  login: async () => null,
  logout: () => {},
  requestPasswordReset: async () => ({}),
  waitForAuthReady: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Auth-ready gate: a promise that resolves when auth refresh is done after tab return
  const authReadyResolveRef = useRef<(() => void) | null>(null);
  const authReadyPromiseRef = useRef<Promise<void>>(Promise.resolve());

  const waitForAuthReady = useCallback((): Promise<void> => {
    return authReadyPromiseRef.current;
  }, []);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!initialized && !cancelled) return;

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

  // Visibility-based auth refresh with gate
  useEffect(() => {
    const MIN_HIDDEN_MS = 300_000; // 5 minutes

    return subscribeVisibilityChange(async ({ state, hiddenDurationMs }) => {
      if (state !== 'visible') return;

      if (hiddenDurationMs >= MIN_HIDDEN_MS) {
        console.log(`[AuthContext] ⚠️ tab was hidden for ${Math.round(hiddenDurationMs / 1000)}s (>= ${MIN_HIDDEN_MS / 1000}s) — refreshing session`);
        // Create a new auth-ready gate that blocks data fetches until refresh completes
        let resolve: () => void;
        authReadyPromiseRef.current = new Promise<void>((r) => { resolve = r; });
        authReadyResolveRef.current = resolve!;

        try {
          console.log('[AuthContext] auth refresh started');
          const { data, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !data.session) {
            console.error('[AuthContext] auth refresh failed:', refreshError?.message ?? 'no session');
            logoutStorage();
            setUser(null);
            setError('Sua sessão expirou. Faça login novamente.');
          } else {
            console.log('[AuthContext] auth refresh completed successfully');
          }
        } catch (err) {
          console.error('[AuthContext] auth refresh network error:', err);
        } finally {
          console.log('[AuthContext] auth gate released — unblocking data fetches');
          authReadyResolveRef.current?.();
          authReadyResolveRef.current = null;
        }
      } else {
        console.log(`[AuthContext] tab visible, hidden for ${Math.round(hiddenDurationMs / 1000)}s (< ${MIN_HIDDEN_MS / 1000}s) — skipping refresh`);
      }
      // If hidden < 5 min, auth-ready promise stays resolved (no blocking)
    });
  }, []);

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

    const { data: profileRow } = await supabase.from('profiles').select('status, login_count').eq('auth_user_id', data.user.id).single();
    if ((profileRow as any)?.status === 'blocked') {
      await supabase.auth.signOut();
      setError('Conta bloqueada. Contate o administrador.');
      return null;
    }

    const newCount = ((profileRow as any)?.login_count ?? 0) + 1;
    await supabase.from('profiles').update({
      last_login_at: new Date().toISOString(),
      login_count: newCount,
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
    <AuthContext.Provider value={{ user, loading, error, login, logout, requestPasswordReset, waitForAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
