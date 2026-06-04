import React, { useState } from 'react';
import { verifyPin } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';

export default function LoginScreen() {
  const [pin,     setPin]     = useState('');
  const [loading, setLoading] = useState(false);
  const { login }  = useAuth();
  const settings   = useSettings();
  const toast      = useToast();

  const tryLogin = async (p: string) => {
    if (loading) return;
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
    // Auto-submit at 4 digits (most common PIN length)
    // Users with 5-6 digit PINs tap the ✓ button
    if (next.length === 4) {
      // Small delay so the last dot fills before submit
      setTimeout(() => tryLogin(next), 120);
    }
  };

  const handleBack = () => {
    if (!loading) setPin(p => p.slice(0, -1));
  };

  const handleSubmit = () => {
    if (pin.length >= 4 && !loading) tryLogin(pin);
  };

  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'];

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-brand shadow-xl shadow-brand-500/30 mb-4">
            <span className="text-2xl">🍗</span>
          </div>
          <h1 className="font-display font-700 text-2xl text-white tracking-tight">
            {settings.restaurant_name}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Enter your PIN to continue</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          {/* PIN dots — show up to 6 */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full border-2 transition-all duration-200 ${
                  i < pin.length
                    ? 'bg-brand-500 border-brand-500 scale-110'
                    : 'bg-transparent border-zinc-700'
                }`}
              />
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2.5">
            {digits.map((d, i) => {
              if (d === '') return <div key={i} />;
              return (
                <button
                  key={i}
                  onClick={() => d === '⌫' ? handleBack() : handleDigit(String(d))}
                  disabled={loading}
                  className={`h-14 rounded-xl font-mono font-medium text-lg transition-all duration-100 border select-none
                    ${d === '⌫'
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 active:scale-95 text-base'
                      : 'bg-surface-raised border-surface-border text-white hover:bg-zinc-600 hover:border-zinc-500 active:scale-95 active:bg-brand-500/20'
                    } disabled:opacity-50`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* Submit button — shown for 5-6 digit PINs (after 4 digits entered) */}
          {pin.length >= 5 && (
            <button
              onClick={handleSubmit}
              disabled={loading || pin.length < 4}
              className="mt-3 w-full h-12 rounded-xl bg-brand-500 hover:bg-brand-600 border border-brand-600 text-white font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Log In
                  </>
              }
            </button>
          )}
        </div>

        <p className="text-center text-zinc-700 text-xs mt-5">
          Contact your manager if you've forgotten your PIN
        </p>
      </div>
    </div>
  );
}