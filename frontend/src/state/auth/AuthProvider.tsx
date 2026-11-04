import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logoutStaff, validateSession } from 'api/access/staff.api';
import { isApiError } from 'api/errors';
import { isAbort } from 'api/http';
import { HEARTBEAT_MS } from 'config/constants';
import { WINDOW_EVENTS } from 'config/events';
import { joinStaffRoom, leaveStaffRoom } from 'realtime/socket';
import { useRefetchOnReconnect } from 'realtime/useRefetchOnReconnect';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import type { AuthUser } from 'types/core/auth';
import { AuthContext } from './auth-context';
import { clearSession, EndReason, endReason, readSession, writeSession } from './session-store';

interface Session { user: AuthUser; token: string; startedAt: number | null }

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readSession);
  const [validating, setValidating] = useState<boolean>(() => readSession() !== null);
  const [endedBy, setEndedBy] = useState<EndReason | null>(null);
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; });

  const end = useCallback((byServer: boolean) => {
    const startedAt = sessionRef.current?.startedAt ?? readSession()?.startedAt ?? null;
    leaveStaffRoom();
    clearSession();
    setSession(null);
    if (byServer) setEndedBy(endReason(startedAt));
  }, []);

  // One-time check of a session restored from sessionStorage.
  useEffect(() => {
    const stored = readSession();
    if (!stored) return undefined;
    const ctrl = new AbortController();
    validateSession(stored.user.id, stored.token, ctrl.signal)
      .then(r => { if (!r.valid) end(true); else void joinStaffRoom(stored.user.id, stored.token); })
      .catch((e: unknown) => {
        if (isAbort(e)) return;
        if (isApiError(e) && e.status === 401) end(true);
        else void joinStaffRoom(stored.user.id, stored.token); // network hiccup: stay signed in, heartbeat will re-check
      })
      .finally(() => { if (!ctrl.signal.aborted) setValidating(false); });
    return () => ctrl.abort();
  }, [end]);

  // Heartbeat: exists exactly while someone is signed in, and is torn down on logout/unmount.
  const userId = session?.user.id;
  const token = session?.token;
  useEffect(() => {
    if (userId === undefined || !token) return undefined;
    const ctrl = new AbortController();
    const id = setInterval(() => {
      validateSession(userId, token, ctrl.signal)
        .then(r => { if (!r.valid) end(true); })
        .catch(() => undefined); // transient failure: try again next tick (401 is handled by the central event)
    }, HEARTBEAT_MS);
    return () => { clearInterval(id); ctrl.abort(); };
  }, [userId, token, end]);

  // The server says our staff session is gone (expired after 7 days, deactivated, PIN changed).
  useEffect(() => {
    const onRequired = (): void => { if (sessionRef.current) end(true); };
    window.addEventListener(WINDOW_EVENTS.staffRequired, onRequired);
    return () => window.removeEventListener(WINDOW_EVENTS.staffRequired, onRequired);
  }, [end]);

  useRefetchOnReconnect(() => {
    const s = sessionRef.current;
    if (s) void joinStaffRoom(s.user.id, s.token);
  });

  const login = useCallback((user: AuthUser, sessionToken: string) => {
    const next = { user, token: sessionToken, startedAt: Date.now() };
    writeSession(next);
    setSession(next);
    setEndedBy(null);
    setValidating(false);
    void joinStaffRoom(user.id, sessionToken);
  }, []);

  const logout = useCallback(async () => {
    const s = sessionRef.current;
    end(false);
    if (s) { try { await logoutStaff(s.user.id, s.token); } catch { /* local sign-out already done */ } }
  }, [end]);

  const value = useMemo(() => ({
    user: session?.user ?? null,
    sessionEnded: endedBy !== null,
    sessionEndReason: endedBy,
    login,
    logout,
    dismissSessionEnded: () => setEndedBy(null),
    currentSessionToken: () => sessionRef.current?.token ?? null,
  }), [session, endedBy, login, logout]);

  if (validating) return <PageSpinner />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
