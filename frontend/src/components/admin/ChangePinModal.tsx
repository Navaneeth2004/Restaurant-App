/**
 * components/admin/ChangePinModal.tsx
 *
 * Modal for changing a staff member's PIN.
 * Extracted from AdminStaff.tsx.
 */

import React, { useState } from 'react';
import type { Staff } from '../../types';

interface Props {
  staff:   Staff;
  onSave:  (newPin: string) => void;
  onClose: () => void;
}

export default function ChangePinModal({ staff, onSave, onClose }: Props) {
  const [newPin,     setNewPin]     = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error,      setError]      = useState('');

  const handleSave = () => {
    if (newPin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    if (newPin !== confirmPin) { setError('PINs do not match'); return; }
    onSave(newPin);
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
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button className="btn flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-brand flex-1"
            onClick={handleSave}
            disabled={newPin.length < 4 || confirmPin.length < 4}
          >
            Save PIN
          </button>
        </div>
      </div>
    </div>
  );
}