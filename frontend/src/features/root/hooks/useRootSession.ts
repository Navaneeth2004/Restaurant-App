import { useCallback, useEffect, useState } from 'react';
import { rootLogin, rootLogout, rootMe } from 'api/platform/root.api';
import { WINDOW_EVENTS } from 'config/events';

/** undefined = still checking, null = signed out, string = the signed-in root phone. */
export function useRootSession() {
  const [phone, setPhone] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const ctrl = new AbortController();
    rootMe(ctrl.signal).then(d => setPhone(d.phone)).catch(() => { if (!ctrl.signal.aborted) setPhone(null); });
    const lost = (): void => setPhone(null);
    window.addEventListener(WINDOW_EVENTS.rootAuthLost, lost);
    return () => { ctrl.abort(); window.removeEventListener(WINDOW_EVENTS.rootAuthLost, lost); };
  }, []);

  const login = useCallback(async (p: string, password: string): Promise<void> => { setPhone((await rootLogin(p, password)).phone); }, []);
  const logout = useCallback(async (): Promise<void> => { try { await rootLogout(); } catch { /* the cookie is cleared by the server or already gone */ } setPhone(null); }, []);
  return { phone, login, logout };
}
