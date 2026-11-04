import { ReactNode, useCallback, useState } from 'react';
import { useTimeouts } from 'hooks/time/useTimeouts';
import { ToastContext, ToastType } from './toast-context';

interface Toast { id: number; message: string; type: ToastType }

const COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-500', error: 'bg-red-500', info: 'bg-brand-500', default: 'bg-zinc-700',
};
const ICONS: Record<ToastType, string> = { success: '✓', error: '✕', info: 'ℹ', default: '•' };
const TTL_MS = 3200;

let seq = 0; // monotonic: two toasts in the same millisecond can never share an id

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const later = useTimeouts();

  const toast = useCallback((message: string, type: ToastType = 'default') => {
    const id = ++seq;
    setToasts(p => [...p, { id, message, type }]);
    later(() => setToasts(p => p.filter(t => t.id !== id)), TTL_MS);
  }, [later]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div aria-live="polite" className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} role={t.type === 'error' ? 'alert' : 'status'} className={`${COLORS[t.type]} animate-slide-up flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-medium max-w-xs`}>
            <span className="text-base leading-none">{ICONS[t.type]}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
