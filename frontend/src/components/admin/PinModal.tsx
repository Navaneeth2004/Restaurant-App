/**
 * components/admin/PinModal.tsx
 *
 * Numeric PIN-entry modal used by AdminLockContext (both the blocking
 * "requestPin" flow and the inline "requirePin" flow).
 * Extracted from AdminLockContext.tsx.
 */
import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';

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