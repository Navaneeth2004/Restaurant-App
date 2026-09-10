import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'default' | 'success' | 'error' | 'info';
interface Toast { id: number; message: string; type: ToastType; }

const ToastContext = createContext<(msg: string, type?: ToastType) => void>(() => {});

// FIX (#6.3): id used to be Date.now(), so two toasts fired within the
// same millisecond got the same id — removing one via its timeout could
// remove both, and React warns about duplicate keys. A simple module-level
// monotonic counter guarantees uniqueness regardless of timing.
let _toastSeq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'default') => {
    const id = ++_toastSeq;
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }, []);

  const icons: Record<ToastType, string> = {
    success: '✓', error: '✕', info: 'ℹ', default: '•'
  };

  const colors: Record<ToastType, string> = {
    success: 'bg-emerald-500',
    error:   'bg-red-500',
    info:    'bg-brand-500',
    default: 'bg-zinc-700',
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`${colors[t.type]} animate-slide-up flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-medium max-w-xs`}>
            <span className="text-base leading-none">{icons[t.type]}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() { return useContext(ToastContext); }