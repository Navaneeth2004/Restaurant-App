import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkPin } from 'api/access/staff.api';
import { updateSettings } from 'api/restaurant/settings.api';
import { errorMessage } from 'api/errors';
import PinModal from 'components/pin/PinModal';
import { STORAGE } from 'config/storage-keys';
import { useSettingsState } from 'state/settings/useSettings';
import { useToast } from 'state/toast/useToast';
import { AdminLockContext } from './lock-context';
import { AdminLockConfig, isExpired, parseLockConfig } from './lock-logic';

const CHECK_MS = 10_000;

interface Prompt { title?: string; subtitle?: string }

function readLocked(): boolean {
  try { return sessionStorage.getItem(STORAGE.adminLockLocked) === 'true'; } catch { return false; }
}
function writeLocked(v: boolean): void {
  try { if (v) sessionStorage.setItem(STORAGE.adminLockLocked, 'true'); else sessionStorage.removeItem(STORAGE.adminLockLocked); } catch { /* optional */ }
}

export default function AdminLockProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettingsState();
  const toast = useToast();
  const fromServer = useMemo(() => parseLockConfig(settings.admin_lock_config), [settings.admin_lock_config]);
  const [optimistic, setOptimistic] = useState<AdminLockConfig | null>(null);
  useEffect(() => { setOptimistic(null); }, [fromServer]);
  const config = optimistic ?? fromServer;

  const [locked, setLocked] = useState(readLocked);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const unlockedAt = useRef<number | null>(null);
  const pending = useRef<{ promise: Promise<boolean>; resolve: (ok: boolean) => void } | null>(null);

  const lock = useCallback(() => { setLocked(true); writeLocked(true); }, []);
  const unlock = useCallback(() => { setLocked(false); writeLocked(false); unlockedAt.current = Date.now(); }, []);
  const touch = useCallback(() => { unlockedAt.current = Date.now(); }, []);

  useEffect(() => { if (!config.enabled && locked) { setLocked(false); writeLocked(false); } }, [config.enabled, locked]);

  useEffect(() => {
    if (!config.enabled || locked || config.timeout_mins <= 0) return undefined;
    const id = setInterval(() => { if (isExpired(unlockedAt.current, config.timeout_mins, Date.now())) lock(); }, CHECK_MS);
    return () => clearInterval(id);
  }, [config.enabled, config.timeout_mins, locked, lock]);

  const ask = useCallback((p: Prompt): Promise<boolean> => {
    if (pending.current) return pending.current.promise; // never orphan an earlier promise
    let resolve: (ok: boolean) => void = () => undefined;
    const promise = new Promise<boolean>(r => { resolve = r; });
    pending.current = { promise, resolve };
    setPrompt(p);
    return promise;
  }, []);

  const settle = useCallback((ok: boolean) => {
    pending.current?.resolve(ok);
    pending.current = null;
    setPrompt(null);
  }, []);

  const ensureUnlocked = useCallback(async (): Promise<boolean> => {
    if (!config.enabled) return true;
    if (!locked && !isExpired(unlockedAt.current, config.timeout_mins, Date.now())) return true;
    const ok = await ask({});
    if (ok) unlock();
    return ok;
  }, [config.enabled, config.timeout_mins, locked, ask, unlock]);

  const requirePin = useCallback((onSuccess: () => void, title?: string, subtitle?: string) => {
    if (!config.enabled) { onSuccess(); return; }
    void ask({ title, subtitle }).then(ok => { if (ok) onSuccess(); });
  }, [config.enabled, ask]);

  const setConfig = useCallback(async (c: AdminLockConfig) => {
    setOptimistic(c);
    try {
      await updateSettings({ admin_lock_config: JSON.stringify(c) });
    } catch (e) {
      setOptimistic(null);
      toast(errorMessage(e, 'Could not save the lock settings'), 'error');
    }
  }, [toast]);

  const value = useMemo(() => ({ config, isLocked: config.enabled && locked, setConfig, lock, touch, ensureUnlocked, requirePin }),
    [config, locked, setConfig, lock, touch, ensureUnlocked, requirePin]);

  return (
    <AdminLockContext.Provider value={value}>
      {children}
      {prompt && (
        <PinModal
          title={prompt.title ?? 'Admin PIN required'}
          subtitle={prompt.subtitle ?? 'Enter your admin PIN to access this area'}
          verify={checkPin}
          onSuccess={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </AdminLockContext.Provider>
  );
}
