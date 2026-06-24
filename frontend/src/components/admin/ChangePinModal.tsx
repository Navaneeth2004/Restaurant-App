/**
 * components/admin/ChangePinModal.tsx
 *
 * Modal for changing a staff member's PIN.
 * Shows an inline error if the new PIN is already taken by another member.
 */

import React, { useState } from 'react';
import type { Staff } from '../../types';

interface Props {
  staff:   Staff;
  onSave:  (newPin: string) => Promise<void> | void;
  onClose: () => void;
}

export default function ChangePinModal({ staff, onSave, onClose }: Props) {
  const [newPin,     setNewPin]     = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error,      setError]      = useState('');
  const [saving,     setSaving]     = useState(false);

  const handleSave = async () => {
    if (newPin.length < 4)      { setError('PIN must be at least 4 digits.'); return; }
    if (newPin !== confirmPin)  { setError('PINs do not match.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave(newPin);
    } catch (e: any) {
      setError(e?.message || 'Failed to update PIN.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="rounded-xl border border-surface-border bg-surface-card p-5 w-full max-w-sm animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-bold text-white text-base mb-1">Change PIN</h3>
        <p className="text-zinc-500 text-xs mb-4">
          Setting new PIN for <span className="text-white font-medium">{staff.name}</span>
        </p>

        <div className="space-y-3">
          <div>
            <label className="label">New PIN (4–6 digits)</label>
            <input
              className="input font-mono tracking-widest"
              type="password"
              maxLength={6}
              placeholder="••••"
              value={newPin}
              onChange={e => { setNewPin(e.target.value.replace(/\D/g, '')); setError(''); }}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Confirm PIN</label>
            <input
              className="input font-mono tracking-widest"
              type="password"
              maxLength={6}
              placeholder="••••"
              value={confirmPin}
              onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '')); setError(''); }}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button className="btn flex-1" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="btn btn-brand flex-1"
            onClick={handleSave}
            disabled={saving || newPin.length < 4 || confirmPin.length < 4}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : 'Save PIN'}
          </button>
        </div>
      </div>
    </div>
  );
}