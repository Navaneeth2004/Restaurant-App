import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getToken as getSharedToken } from '../utils/authedFetch';
import type { AuthUser } from '../types';

interface AuthCtx {
  user: AuthUser | null;
  sessionToken: string | null;
  login:      (u: AuthUser, token: string) => void;
  logout:     () => Promise<void>;
  kickedOut:  boolean;
  clearKicked: () => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  sessionToken: null,
  login:       () => {},
  logout:      async () => {},
  kickedOut:   false,
  clearKicked: () => {},
});

const API_BASE    = process.env.REACT_APP_API_URL || window.location.origin;
const HEARTBEAT   = 30_000; // ms between session checks

// FIX: was its own uncached fetch of /api/auth/token on every single call —
// now uses the shared, correctly-cached implementation.
async function getApiToken(): Promise<string | null> {
  return getSharedToken();
}

async function authedPost(path: string, body: object): Promise<void> {
  const token = await getApiToken();
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  await fetch(`${API_BASE}${path}`, { method: 'POST', headers: h, body: JSON.stringify(body) });
}

async function authedGet(path: string): Promise<any> {
  const token = await getApiToken();
  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API_BASE}${path}`, { headers: h });
  return r.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('pos_user') || 'null'); }
    catch { return null; }
  });
  const [sessionToken, setSessionToken] = useState<string | null>(
    () => sessionStorage.getItem('pos_session_token')
  );
  const [kickedOut, setKickedOut] = useState(false);
  const [validating, setValidating] = useState<boolean>(() => {
    return !!(
      sessionStorage.getItem('pos_user') &&
      sessionStorage.getItem('pos_session_token')
    );
  });

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef({ user, sessionToken });
  stateRef.current = { user, sessionToken };

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const forceLogout = useCallback(() => {
    stopHeartbeat();
    setUser(null);
    setSessionToken(null);
    setKickedOut(true);
    sessionStorage.removeItem('pos_user');
    sessionStorage.removeItem('pos_session_token');
  }, [stopHeartbeat]);

  const startHeartbeat = useCallback((staffId: number, token: string) => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(async () => {
      try {
        const data = await authedGet(
          `/api/staff/session/validate?staffId=${staffId}&sessionToken=${encodeURIComponent(token)}`
        );
        if (data.valid === false) forceLogout();
      } catch { /* network hiccup — try again next tick */ }
    }, HEARTBEAT);
  }, [stopHeartbeat, forceLogout]);

  const login = useCallback((u: AuthUser, token: string) => {
    setUser(u);
    setSessionToken(token);
    setKickedOut(false);
    setValidating(false);
    sessionStorage.setItem('pos_user', JSON.stringify(u));
    sessionStorage.setItem('pos_session_token', token);
    startHeartbeat(u.id, token);
  }, [startHeartbeat]);

  const logout = useCallback(async () => {
    const { user: u, sessionToken: t } = stateRef.current;
    stopHeartbeat();
    if (u && t) {
      try { await authedPost('/api/staff/logout', { staffId: u.id, sessionToken: t }); }
      catch { /* best-effort */ }
    }
    setUser(null);
    setSessionToken(null);
    sessionStorage.removeItem('pos_user');
    sessionStorage.removeItem('pos_session_token');
  }, [stopHeartbeat]);

  const clearKicked = useCallback(() => setKickedOut(false), []);

  useEffect(() => {
    const storedUser  = sessionStorage.getItem('pos_user');
    const storedToken = sessionStorage.getItem('pos_session_token');

    if (!storedUser || !storedToken) {
      setValidating(false);
      return;
    }

    let cancelled = false;
    let parsedUser: AuthUser | null = null;
    try { parsedUser = JSON.parse(storedUser); } catch {}

    if (!parsedUser) {
      sessionStorage.removeItem('pos_user');
      sessionStorage.removeItem('pos_session_token');
      setUser(null);
      setSessionToken(null);
      setValidating(false);
      return;
    }

    authedGet(
      `/api/staff/session/validate?staffId=${parsedUser.id}&sessionToken=${encodeURIComponent(storedToken)}`
    ).then((data: any) => {
      if (cancelled) return;
      if (data.valid === false) {
        sessionStorage.removeItem('pos_user');
        sessionStorage.removeItem('pos_session_token');
        setUser(null);
        setSessionToken(null);
        setKickedOut(true);
      } else {
        startHeartbeat(parsedUser!.id, storedToken);
      }
      setValidating(false);
    }).catch(() => {
      if (!cancelled) {
        startHeartbeat(parsedUser!.id, storedToken);
        setValidating(false);
      }
    });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (validating) {
    return (
      <AuthContext.Provider value={{ user: null, sessionToken: null, login, logout, kickedOut: false, clearKicked }}>
        <div className="min-h-screen bg-surface flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-brand-500 rounded-full animate-spin" />
        </div>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, sessionToken, login, logout, kickedOut, clearKicked }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }