/**
 * components/admin/StaffModal.tsx
 *
 * Modal for adding a new staff member.
 * Shows an error if the chosen PIN is already in use by another staff member.
 */

import React, { useState } from 'react';

const ROLE_STYLES: Record<string, string> = {
  admin:   'bg-red-500/15 text-red-400 border-red-500/25',
  kitchen: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  waiter:  'bg-brand-500/15 text-brand-400 border-brand-500/25',
};

interface Props {
  onSave:  (fields: { name: string; pin: string; role: string }) => Promise<void> | void;
  onClose: () => void;
}

export default function StaffModal({ onSave, onClose }: Props) {
  const [name,    setName]    = useState('');
  const [pin,     setPin]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [role,    setRole]    = useState('waiter');
  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    if (!name.trim())       { setError('Please enter a name.'); return; }
    if (pin.length < 4)     { setError('PIN must be at least 4 digits.'); return; }
    if (pin !== confirm)    { setError('PINs do not match.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({ name: name.trim(), pin, role });
    } catch (e: any) {
      // 409 = PIN taken (set by parent via toast, but also show inline)
      setError(e?.message || 'Failed to add staff.');
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
        <h3 className="font-bold text-white text-base mb-4">Add Staff Member</h3>

        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              placeholder="e.g. Ali"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              autoFocus
            />
          </div>

          <div>
            <label className="label">PIN (4 digits min)</label>
            <input
              className="input font-mono tracking-widest"
              type="password"
              maxLength={6}
              placeholder="••••"
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
            />
          </div>

          <div>
            <label className="label">Confirm PIN</label>
            <input
              className="input font-mono tracking-widest"
              type="password"
              maxLength={6}
              placeholder="••••"
              value={confirm}
              onChange={e => { setConfirm(e.target.value.replace(/\D/g, '')); setError(''); }}
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

          <div>
            <label className="label">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(['waiter', 'kitchen', 'admin'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`py-2 rounded-lg border text-xs font-semibold capitalize transition-all ${
                    role === r
                      ? `${ROLE_STYLES[r]} border`
                      : 'border-surface-border text-zinc-500 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-surface-raised border border-surface-border p-3 text-xs text-zinc-500 space-y-1">
            <div><span className="text-brand-400">Waiter</span> — takes orders, generates bills</div>
            <div><span className="text-blue-400">Kitchen</span> — sees and manages kitchen display</div>
            <div><span className="text-red-400">Admin</span> — full access to all screens</div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button className="btn flex-1" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="btn btn-brand flex-1"
            onClick={handleSave}
            disabled={saving || !name || pin.length < 4 || confirm.length < 4}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Adding…
              </span>
            ) : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}