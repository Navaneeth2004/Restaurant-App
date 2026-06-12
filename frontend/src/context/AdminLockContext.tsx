import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
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

const STORAGE_KEY = 'pos_admin_lock_cfg';

function loadConfig(): AdminLockConfig {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: false, timeout_mins: 5 };
}

function saveConfig(c: AdminLockConfig) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch {}
}

const Ctx = createContext<AdminLockCtx>({
  config: { enabled: false, timeout_mins: 5 },
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
        <div className={`flex justify-center gap-3 mb-5 ${shake ? 'animate-[wiggle_0.3s_ease-in-out]' : ''}`}
          style={shake ? { animation: 'shake 0.3s ease-in-out' } : {}}>
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
  const [config, setConfigState] = useState<AdminLockConfig>(loadConfig);
  const [isLocked, setIsLocked] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalProps, setModalProps] = useState<{ title?: string; subtitle?: string }>({});
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);
  const [inlineModal, setInlineModal] = useState(false);
  const [inlineProps, setInlineProps] = useState<{ title?: string; subtitle?: string; onSuccess: () => void }>({ onSuccess: () => {} });
  const lastUnlockRef = useRef<number>(Date.now());

  const setConfig = useCallback((c: AdminLockConfig) => {
    setConfigState(c);
    saveConfig(c);
  }, []);

  const lock = useCallback(() => { setIsLocked(true); }, []);
  const unlock = useCallback(() => { setIsLocked(false); lastUnlockRef.current = Date.now(); }, []);

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
      requirePin: (onSuccess: () => void, title?: string, subtitle?: string) => requirePin(onSuccess, title, subtitle),
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