import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { useToast } from './ToastContext';

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

// ── Server-side config helpers ────────────────────────────────────────────
// The lock config is stored in the `settings` table (key: admin_lock_config)
// so it is consistent across all devices. localStorage is only used as a
// fast initial cache to avoid a flash on first render.
const LOCAL_CACHE_KEY = 'pos_admin_lock_cfg_cache';
const LOCKED_KEY      = 'pos_admin_locked'; // sessionStorage — per-tab

const DEFAULT_CONFIG: AdminLockConfig = { enabled: false, timeout_mins: 5 };

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

async function fetchApiToken(): Promise<string | null> {
  try {
    const r = await fetch(`${API_BASE}/api/auth/token`);
    const d = await r.json();
    return d.token ?? null;
  } catch { return null; }
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

interface PinModalProps {
  title?: string;
  subtitle?: string;
  onSuccess: (pin: string) => void;
  onCancel: () => void;
  verifyFn: (pin: string) => Promise<boolean>;
}

export function PinModal({ title = 'Admin PIN Required', subtitle, onSuccess, onCancel, verifyFn }: PinModalProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const toast = useToast();

  const handleDigit = (d: string) => {
    if (loading) return;
    const next = pin + d;
    if (next.length > 6) return;
    setPin(next);
  };

  const handleBack = () => {
    if (!loading) setPin(p => p.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (pin.length < 4 || loading) return;
    setLoading(true);
    try {
      const ok = await verifyFn(pin);
      if (ok) {
        onSuccess(pin);
      } else {
        toast('Incorrect PIN — try again', 'error');
        setShake(true);
        setTimeout(() => { setPin(''); setShake(false); }, 400);
      }
    } catch {
      toast('Error verifying PIN', 'error');
    } finally {
      setLoading(false);
    }
  };

  const cells: ('digit' | 'back' | 'login')[] = [
    'digit','digit','digit',
    'digit','digit','digit',
    'digit','digit','digit',
    'back', 'digit','login',
  ];
  const digitValues = [1,2,3,4,5,6,7,8,9,0];
  let digitIdx = 0;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5 w-full max-w-xs animate-slide-up shadow-2xl">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-brand-500/15 border border-brand-500/25 mb-3">
            <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h3 className="font-bold text-white text-sm">{title}</h3>
          {subtitle && <p className="text-zinc-500 text-xs mt-0.5">{subtitle}</p>}
        </div>

        {/* PIN dots */}
        <div
          className="flex justify-center gap-3 mb-5"
          style={shake ? { animation: 'shake 0.3s ease-in-out' } : {}}
        >
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className={`w-3 h-3 rounded-full border-2 transition-all duration-200 ${
              i < pin.length
                ? 'bg-brand-500 border-brand-500 scale-110'
                : 'bg-transparent border-zinc-700'
            }`} />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2">
          {cells.map((type, i) => {
            if (type === 'digit') {
              const val = digitValues[digitIdx++];
              return (
                <button
                  key={i}
                  onClick={() => handleDigit(String(val))}
                  disabled={loading}
                  className="h-12 rounded-xl font-mono font-medium text-lg border bg-surface-raised border-surface-border text-white hover:bg-zinc-600 active:scale-95 transition-all duration-100 select-none disabled:opacity-50"
                >
                  {val}
                </button>
              );
            }
            if (type === 'back') {
              return (
                <button
                  key={i}
                  onClick={handleBack}
                  disabled={loading || pin.length === 0}
                  className="h-12 rounded-xl border bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.374-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
                  </svg>
                </button>
              );
            }
            return (
              <button
                key={i}
                onClick={handleSubmit}
                disabled={loading || pin.length < 4}
                className="h-12 rounded-xl border bg-brand-500 border-brand-600 text-white hover:bg-brand-600 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                }
              </button>
            );
          })}
        </div>

        <button
          onClick={onCancel}
          className="mt-3 w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function AdminLockProvider({ children, verifyPin }: {
  children: React.ReactNode;
  verifyPin: (pin: string) => Promise<boolean>;
}) {
  // Start from local cache so first render is instant, then sync from server
  const [config, setConfigState] = useState<AdminLockConfig>(loadLocalCache);

  // isLocked is per-tab (sessionStorage). But on page load we also check
  // whether the lock SHOULD be active based on server config.
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

  // ── Load config from server on mount, keep in sync via socket ────────────
  useEffect(() => {
    loadConfigFromServer().then(serverConfig => {
      if (!serverConfig) return;
      setConfigState(serverConfig);
      writeLocalCache(serverConfig);
      // If lock just got enabled on another device and we're unlocked, honour it
      if (serverConfig.enabled && sessionStorage.getItem(LOCKED_KEY) !== 'false_explicit') {
        // Don't force-lock an already-active session — but do update the config
        // so the next navigation will respect it.
      }
      if (!serverConfig.enabled) {
        setIsLocked(false);
        try { sessionStorage.removeItem(LOCKED_KEY); } catch {}
      }
    });
  }, []);

  // Listen for settings_updated socket events to sync lock config across devices
  useEffect(() => {
    // Import dynamically to avoid circular deps
    import('./SettingsContext').then(({ getSocket }: any) => {}).catch(() => {});
    // Use a raw socket listener instead
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
    // Lazy-import socket to avoid circular dependency
    let socket: any = null;
    import('../services/socket').then(({ getSocket }) => {
      socket = getSocket();
      socket.on('settings_updated', handler);
    }).catch(() => {});
    return () => {
      if (socket) socket.off('settings_updated', handler);
    };
  }, []);

  const setConfig = useCallback((c: AdminLockConfig) => {
    setConfigState(c);
    writeLocalCache(c);
    saveConfigToServer(c);
    if (!c.enabled) {
      setIsLocked(false);
      try { sessionStorage.removeItem(LOCKED_KEY); } catch {}
    }
  }, []);

  const lock = useCallback(() => {
    setIsLocked(true);
    try { sessionStorage.setItem(LOCKED_KEY, 'true'); } catch {}
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