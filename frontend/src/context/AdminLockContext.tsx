import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { getSocket } from '../services/socket';
import { getToken as getSharedToken } from '../utils/authedFetch';
import { PinModal } from '../components/admin/PinModal';

interface AdminLockConfig {
  enabled: boolean;
  timeout_mins: number;
}

interface AdminLockCtx {
  config: AdminLockConfig;
  setConfig: (c: AdminLockConfig) => void;
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
  requestPin: () => Promise<boolean>;
  requirePin: (onSuccess: () => void, title?: string, subtitle?: string) => void;
}

const LOCAL_CACHE_KEY = 'pos_admin_lock_cfg_cache';
const LOCKED_KEY      = 'pos_admin_locked';

const DEFAULT_CONFIG: AdminLockConfig = { enabled: false, timeout_mins: 5 };

const AUTO_LOCK_CHECK_INTERVAL_MS = 10_000;

function loadLocalCache(): AdminLockConfig {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_CONFIG;
}

function writeLocalCache(c: AdminLockConfig) {
  try { localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(c)); } catch {}
}

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

// FIX: was its own uncached fetch on every call — now shared/cached.
async function fetchApiToken(): Promise<string | null> {
  return getSharedToken();
}

async function loadConfigFromServer(): Promise<AdminLockConfig | null> {
  try {
    const token = await fetchApiToken();
    const h: Record<string, string> = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    const r = await fetch(`${API_BASE}/api/settings`, { headers: h });
    if (!r.ok) return null;
    const data = await r.json();
    if (!data.admin_lock_config) return null;
    return { ...DEFAULT_CONFIG, ...JSON.parse(data.admin_lock_config) };
  } catch { return null; }
}

async function saveConfigToServer(c: AdminLockConfig): Promise<void> {
  try {
    const token = await fetchApiToken();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    await fetch(`${API_BASE}/api/settings`, {
      method: 'PUT',
      headers: h,
      body: JSON.stringify({ admin_lock_config: JSON.stringify(c) }),
    });
  } catch {}
}

const Ctx = createContext<AdminLockCtx>({
  config: DEFAULT_CONFIG,
  setConfig: () => {},
  isLocked: false,
  lock: () => {},
  unlock: () => {},
  requestPin: async () => true,
  requirePin: () => {},
});

export function AdminLockProvider({ children, verifyPin }: {
  children: React.ReactNode;
  verifyPin: (pin: string) => Promise<boolean>;
}) {
  const [config, setConfigState] = useState<AdminLockConfig>(loadLocalCache);

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      const cfg = loadLocalCache();
      if (!cfg.enabled) return false;
      return sessionStorage.getItem(LOCKED_KEY) === 'true';
    } catch { return false; }
  });

  const [showModal, setShowModal] = useState(false);
  const [modalProps, setModalProps] = useState<{ title?: string; subtitle?: string }>({});
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const [inlineModal, setInlineModal] = useState(false);
  const [inlineProps, setInlineProps] = useState<{ title?: string; subtitle?: string; onSuccess: () => void }>({ onSuccess: () => {} });
  const lastUnlockRef = useRef<number>(Date.now());

  const lock = useCallback(() => {
    setIsLocked(true);
    try { sessionStorage.setItem(LOCKED_KEY, 'true'); } catch {}
  }, []);

  useEffect(() => {
    loadConfigFromServer().then(serverConfig => {
      if (!serverConfig) return;
      setConfigState(serverConfig);
      writeLocalCache(serverConfig);
      if (!serverConfig.enabled) {
        setIsLocked(false);
        try { sessionStorage.removeItem(LOCKED_KEY); } catch {}
      }
    });
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const handler = (data: any) => {
      if (data?.admin_lock_config) {
        try {
          const cfg: AdminLockConfig = { ...DEFAULT_CONFIG, ...JSON.parse(data.admin_lock_config) };
          setConfigState(cfg);
          writeLocalCache(cfg);
          if (!cfg.enabled) {
            setIsLocked(false);
            try { sessionStorage.removeItem(LOCKED_KEY); } catch {}
          }
        } catch {}
      }
    };
    socket.on('settings_updated', handler);
    return () => { socket.off('settings_updated', handler); };
  }, []);

  useEffect(() => {
    if (!config.enabled || config.timeout_mins <= 0 || isLocked) return;

    const check = () => {
      const elapsedMin = (Date.now() - lastUnlockRef.current) / 60000;
      if (elapsedMin >= config.timeout_mins) lock();
    };

    check();
    const id = setInterval(check, AUTO_LOCK_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [config.enabled, config.timeout_mins, isLocked, lock]);

  const setConfig = useCallback((c: AdminLockConfig) => {
    setConfigState(c);
    writeLocalCache(c);
    saveConfigToServer(c);
    if (!c.enabled) {
      setIsLocked(false);
      try { sessionStorage.removeItem(LOCKED_KEY); } catch {}
    }
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
    lastUnlockRef.current = Date.now();
    try { sessionStorage.removeItem(LOCKED_KEY); } catch {}
  }, []);

  const isExpired = useCallback(() => {
    if (config.timeout_mins <= 0) return true;
    const elapsed = (Date.now() - lastUnlockRef.current) / 60000;
    return elapsed > config.timeout_mins;
  }, [config.timeout_mins]);

  const requestPin = useCallback((): Promise<boolean> => {
    if (!config.enabled) return Promise.resolve(true);
    if (!isLocked && !isExpired()) return Promise.resolve(true);
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
      setModalProps({});
      setShowModal(true);
    });
  }, [config.enabled, isLocked, isExpired]);

  const requirePin = useCallback((onSuccess: () => void, title?: string, subtitle?: string) => {
    if (!config.enabled) { onSuccess(); return; }
    setInlineProps({ title, subtitle, onSuccess });
    setInlineModal(true);
  }, [config.enabled]);

  const handleModalSuccess = () => {
    setShowModal(false);
    unlock();
    resolveRef.current?.(true);
    resolveRef.current = null;
  };

  const handleModalCancel = () => {
    setShowModal(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  };

  const handleInlineSuccess = () => {
    setInlineModal(false);
    inlineProps.onSuccess();
  };

  return (
    <Ctx.Provider value={{
      config,
      setConfig,
      isLocked,
      lock,
      unlock,
      requestPin,
      requirePin,
    }}>
      {children}

      {showModal && (
        <PinModal
          title="Admin PIN Required"
          subtitle="Enter your admin PIN to access this area"
          verifyFn={verifyPin}
          onSuccess={handleModalSuccess}
          onCancel={handleModalCancel}
        />
      )}

      {inlineModal && (
        <PinModal
          title={inlineProps.title || 'Confirm Admin PIN'}
          subtitle={inlineProps.subtitle || 'Enter your PIN to continue'}
          verifyFn={verifyPin}
          onSuccess={handleInlineSuccess}
          onCancel={() => setInlineModal(false)}
        />
      )}
    </Ctx.Provider>
  );
}

export function useAdminLock() { return useContext(Ctx); }