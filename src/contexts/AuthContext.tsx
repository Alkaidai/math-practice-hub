import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { AuthUser } from '../lib/types';
import { authenticate as authFn, getCurrentUser, setCurrentUser, logout as logoutFn } from '../lib/storage';

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<AuthUser | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => null,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getCurrentUser());

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<AuthUser | null> => {
    const result = await authFn(username, password);
    if (result) {
      setCurrentUser(result);
      setUser(result);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    logoutFn();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
