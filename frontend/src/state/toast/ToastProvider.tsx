import { ReactNode, useCallback, useState } from 'react';
import Icon, { IconName } from 'components/ui/base/Icon';
import { useTimeouts } from 'hooks/time/useTimeouts';
import { ToastContext, ToastType } from './toast-context';

interface Toast { id: number; message: string; type: ToastType }

const LOOK: Record<ToastType, { icon: IconName; chip: string }> = {
  success: { icon: 'check', chip: 'bg-emerald-500/15 text-emerald-400' },
  error: { icon: 'x', chip: 'bg-red-500/15 text-red-400' },
  info: { icon: 'info', chip: 'bg-brand-500/15 text-brand-400' },
  default: { icon: 'info', chip: 'bg-zinc-700/40 text-zinc-300' },
};
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
      <div aria-live="polite" className="fixed top-3 left-3 right-3 sm:left-auto sm:right-4 sm:top-4 z-[9999] flex flex-col items-center sm:items-end gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} role={t.type === 'error' ? 'alert' : 'status'}
            className="animate-slide-up flex items-center gap-3 pl-2.5 pr-4 py-2.5 rounded-xl border border-surface-border bg-surface-card shadow-xl shadow-black/30 max-w-sm">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${LOOK[t.type].chip}`}>
              <Icon name={LOOK[t.type].icon} className="w-3.5 h-3.5" strokeWidth={2.5} />
            </span>
            <span className="text-[13px] font-medium leading-snug text-white">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
