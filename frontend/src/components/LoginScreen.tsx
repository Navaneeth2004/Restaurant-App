import React, { useState } from 'react';
import { verifyPin } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export default function LoginScreen() {
  const [pin, setPin]       = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const { login }  = useAuth();
  const settings   = useSettings();

  const handleDigit = async (d: string) => {
    if (pin.length >= 6 || loading) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length >= 4) {
      setLoading(true);
      try {
        const user = await verifyPin(next);
        login(user);
      } catch {
        setError('Invalid PIN');
        setTimeout(() => { setPin(''); setError(''); }, 600);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => setPin(p => p.slice(0, -1));

  const digits = [1,2,3,4,5,6,7,8,9,'',0,'⌫'];

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
          {/* PIN dots */}
          <div className="flex justify-center gap-3 mb-6">
            {[0,1,2,3].map(i => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                  i < pin.length
                    ? 'bg-brand-500 border-brand-500 scale-110'
                    : 'bg-transparent border-zinc-600'
                } ${error ? 'border-red-500 bg-red-500' : ''}`}
              />
            ))}
          </div>

          {error && (
            <p className="text-center text-red-400 text-xs mb-4 animate-fade-in">{error}</p>
          )}

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
        </div>

        <p className="text-center text-zinc-600 text-xs mt-5">
          Default PINs — Admin: <span className="font-mono text-zinc-500">0000</span>&nbsp;
          Waiter: <span className="font-mono text-zinc-500">1111</span>&nbsp;
          Kitchen: <span className="font-mono text-zinc-500">2222</span>
        </p>
      </div>
    </div>
  );
}
