/**
 * components/admin/StaffModal.tsx
 *
 * Modal for adding a new staff member.
 * Extracted from AdminStaff.tsx.
 */

import React, { useState } from 'react';

const ROLE_STYLES: Record<string, string> = {
  admin:   'bg-red-500/15 text-red-400 border-red-500/25',
  kitchen: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  waiter:  'bg-brand-500/15 text-brand-400 border-brand-500/25',
};

interface Props {
  onSave:  (fields: { name: string; pin: string; role: string }) => void;
  onClose: () => void;
}

export default function StaffModal({ onSave, onClose }: Props) {
  const [name, setName] = useState('');
  const [pin,  setPin]  = useState('');
  const [role, setRole] = useState('waiter');

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
              onChange={e => setName(e.target.value)}
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
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            />
          </div>

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
          <button className="btn flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-brand flex-1"
            onClick={() => name && pin.length >= 4 && onSave({ name, pin, role })}
            disabled={!name || pin.length < 4}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}