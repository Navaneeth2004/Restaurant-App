/**
 * views/waiter/ParcelModal.tsx
 *
 * FIX (accidental data loss): removed backdrop click-to-close — a
 * half-typed customer name/phone was previously lost on any outside tap.
 */

import React, { useState } from 'react';
import { authedFetch } from '../../utils/authedFetch';
import { useToast } from '../../context/ToastContext';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

interface Props {
  onCreated: () => void;
  onClose:   () => void;
}

export default function ParcelModal({ onCreated, onClose }: Props) {
  const [customerName,  setCustomerName]  = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [creating,      setCreating]      = useState(false);
  const toast = useToast();

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await authedFetch(`${API_BASE}/api/parcel/slot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name:  customerName.trim()  || undefined,
          customer_phone: customerPhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create parcel slot');
      toast(`${data.label || 'Parcel slot'} created`, 'success');
      onCreated();
      onClose();
    } catch (e: any) {
      toast(e.message || 'Failed to create parcel slot', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="rounded-xl border border-surface-border bg-surface-card p-5 w-full max-w-sm animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-bold text-white text-base mb-1">New Parcel / Takeaway</h3>
        <p className="text-zinc-500 text-xs mb-4">
          Creates a temporary slot for a takeaway order — customer name is optional.
        </p>

        <div className="space-y-3">
          <div>
            <label className="label">Customer Name <span className="text-zinc-600 font-normal normal-case tracking-normal">(optional)</span></label>
            <input
              className="input"
              placeholder="e.g. Rahul"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Phone <span className="text-zinc-600 font-normal normal-case tracking-normal">(optional)</span></label>
            <input
              className="input"
              placeholder="e.g. 98765 43210"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button className="btn flex-1" onClick={onClose} disabled={creating}>Cancel</button>
          <button className="btn btn-brand flex-1" onClick={handleCreate} disabled={creating}>
            {creating ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Creating…
              </span>
            ) : 'Create Slot'}
          </button>
        </div>
      </div>
    </div>
  );
}