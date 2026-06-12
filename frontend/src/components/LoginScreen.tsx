import React, { useState } from 'react';
import { verifyPin } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

export default function LoginScreen() {
  const [pin,     setPin]     = useState('');
  const [loading, setLoading] = useState(false);
  const { login }  = useAuth();
  const settings   = useSettings();
  const toast      = useToast();
  const logoUrl    = (settings as any).logo_url as string | undefined;

  const tryLogin = async (p: string) => {
    if (loading || p.length < 4) return;
    setLoading(true);
    try {
      const user = await verifyPin(p);
      login(user);
    } catch {
      toast('Incorrect PIN — try again', 'error');
      setTimeout(() => setPin(''), 400);
    } finally {
      setLoading(false);
    }
  };

  const handleDigit = (d: string) => {
    if (loading) return;
    const next = pin + d;
    if (next.length > 6) return;
    setPin(next);
  };

  const handleBack = () => {
    if (!loading) setPin(p => p.slice(0, -1));
  };

  const handleSubmit = () => {
    if (pin.length >= 4 && !loading) tryLogin(pin);
  };

  // Layout: 1 2 3 / 4 5 6 / 7 8 9 / ⌫ 0 ✓
  // The empty slot (was bottom-left) is now ⌫
  // The ⌫ slot (was bottom-right) is now ✓ (Login)
  const cells: ('digit' | 'back' | 'login')[] = [
    'digit','digit','digit',  // 1 2 3
    'digit','digit','digit',  // 4 5 6
    'digit','digit','digit',  // 7 8 9
    'back', 'digit','login',  // ⌫ 0 ✓
  ];
  const digitValues = [1,2,3,4,5,6,7,8,9,0];
  let digitIdx = 0;

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 overflow-hidden shadow-xl shadow-brand-500/30">
            {logoUrl && (
              <img src={`${API_BASE}${logoUrl}`} alt="logo" className="w-full h-full object-cover" />
            )}
          </div>
          <h1 className="font-display font-700 text-2xl text-white tracking-tight">
            {settings.restaurant_name}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Enter your PIN to continue</p>
        </div>

        <div className="card p-6">
          {/* PIN dots */}
          <div className="flex justify-center gap-3 mb-6">
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className={`w-3 h-3 rounded-full border-2 transition-all duration-200 ${
                i < pin.length
                  ? 'bg-brand-500 border-brand-500 scale-110'
                  : 'bg-transparent border-zinc-700'
              }`} />
            ))}
          </div>

          {/* Numpad — 4 rows × 3 cols */}
          <div className="grid grid-cols-3 gap-2.5">
            {cells.map((type, i) => {
              if (type === 'digit') {
                const val = digitValues[digitIdx++];
                return (
                  <button
                    key={i}
                    onClick={() => handleDigit(String(val))}
                    disabled={loading}
                    className="h-14 rounded-xl font-mono font-medium text-lg border bg-surface-raised border-surface-border text-white hover:bg-zinc-600 hover:border-zinc-500 active:scale-95 active:bg-brand-500/20 transition-all duration-100 select-none disabled:opacity-50"
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
                    className="h-14 rounded-xl border bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 active:scale-95 transition-all duration-100 select-none disabled:opacity-30 flex items-center justify-center"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.374-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
                    </svg>
                  </button>
                );
              }

              // login button
              return (
                <button
                  key={i}
                  onClick={handleSubmit}
                  disabled={loading || pin.length < 4}
                  className="h-14 rounded-xl border bg-brand-500 border-brand-600 text-white hover:bg-brand-600 active:scale-95 transition-all duration-100 select-none disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading
                    ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                  }
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-center text-zinc-700 text-xs mt-5">
          Contact your manager if you've forgotten your PIN
        </p>
      </div>
    </div>
  );
}