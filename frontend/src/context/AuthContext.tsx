import React, { createContext, useContext, useState } from 'react';
import type { AuthUser } from '../types';

interface AuthCtx {
  user: AuthUser | null;
  login:  (u: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({ user: null, login: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('pos_user') || 'null'); }
    catch { return null; }
  });

  const login  = (u: AuthUser) => { setUser(u); sessionStorage.setItem('pos_user', JSON.stringify(u)); };
  const logout = ()            => { setUser(null); sessionStorage.removeItem('pos_user'); };

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
