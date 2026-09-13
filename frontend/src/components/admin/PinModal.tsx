/**
 * components/admin/PinModal.tsx
 *
 * FIX (accidental data loss): removed the backdrop onClick that closed the
 * modal when clicking outside the card — a partially-typed PIN was lost.
 * Cancel button is the only way to dismiss now.
 */
import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import PinPad from '../PinPad';

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

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
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

        <PinPad
          pin={pin}
          loading={loading}
          size="md"
          onDigit={handleDigit}
          onBack={handleBack}
          onSubmit={handleSubmit}
        />

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