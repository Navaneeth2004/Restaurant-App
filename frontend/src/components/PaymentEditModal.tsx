import React, { useState } from 'react';
import { updateOrderPayment } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';

const PAYMENT_METHODS = [
  { key: 'cash',   label: 'Cash' },
  { key: 'upi',    label: 'UPI' },
  { key: 'card',   label: 'Card' },
  { key: 'cheque', label: 'Cheque' },
  { key: 'split',  label: 'Split' },
];

interface SplitEntry { method: string; amount: string; }

interface Props {
  orderIds: string[];
  currentMethod: string | null;
  total: number;
  onClose: () => void;
  onSaved: (newMethod: string, newDetails?: any) => void;
}

export default function PaymentEditModal({ orderIds, currentMethod, total, onClose, onSaved }: Props) {
  const settings = useSettings();
  const sym      = settings.currency_symbol || '₹';
  const taxPct   = parseFloat(settings.tax_percent || '5') / 100;
  const grandTotal = total * (1 + taxPct);

  const [method,  setMethod]  = useState(currentMethod || 'cash');
  const [splits,  setSplits]  = useState<SplitEntry[]>([{ method: 'cash', amount: '' }, { method: 'upi', amount: '' }]);
  const [saving,  setSaving]  = useState(false);
  const toast = useToast();

  const splitTotal = splits.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const addSplit    = () => setSplits(s => [...s, { method: 'cash', amount: '' }]);
  const removeSplit = (i: number) => setSplits(s => s.filter((_, idx) => idx !== i));
  const updateSplit = (i: number, field: keyof SplitEntry, val: string) =>
    setSplits(s => s.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const handleSave = async () => {
    setSaving(true);
    try {
      let paymentDetails: any = null;
      if (method === 'split') {
        paymentDetails = splits.filter(s => parseFloat(s.amount) > 0).map(s => ({ method: s.method, amount: parseFloat(s.amount) }));
      }
      await Promise.all(orderIds.map(id => updateOrderPayment(id, {
        payment_method: method,
        payment_details: paymentDetails,
        change_amount: 0,
      })));
      toast('Payment updated', 'success');
      onSaved(method, paymentDetails);
    } catch (e: any) {
      toast(e.response?.data?.error || 'Failed to update payment', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-xl border border-surface-border bg-surface-card p-5 w-full max-w-sm animate-slide-up shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-sm">Edit Payment Method</h3>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-raised border border-surface-border">
            <span className="text-zinc-500 text-xs">Total</span>
            <span className="font-mono font-bold text-white text-sm">{sym}{grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {currentMethod && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-surface-raised border border-surface-border text-xs text-zinc-500">
            Currently: <span className="text-zinc-300 font-semibold capitalize">{currentMethod}</span>
          </div>
        )}

        <label className="label mb-2">Payment Method</label>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PAYMENT_METHODS.map(m => (
            <button key={m.key} onClick={() => setMethod(m.key)}
              className={`py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                method === m.key
                  ? 'bg-brand-500 border-brand-600 text-white'
                  : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'
              }`}>
              {m.label}
            </button>
          ))}
        </div>

        {method === 'split' && (
          <div className="mb-4 space-y-2">
            <label className="label">Split Details</label>
            {splits.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select value={s.method} onChange={e => updateSplit(i, 'method', e.target.value)}
                  className="input flex-1 py-1.5 text-xs">
                  {PAYMENT_METHODS.filter(m => m.key !== 'split').map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">{sym}</span>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={s.amount}
                    onChange={e => updateSplit(i, 'amount', e.target.value)}
                    className="input pl-6 py-1.5 text-xs font-mono" />
                </div>
                {splits.length > 2 && (
                  <button onClick={() => removeSplit(i)} className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
            ))}
            <button onClick={addSplit}
              className="w-full py-2 rounded-lg border-2 border-dashed border-surface-border text-zinc-500 text-xs hover:text-zinc-300 hover:border-zinc-600 transition-colors">
              + Add method
            </button>
            <div className={`flex justify-between text-xs px-3 py-2 rounded-lg border ${
              Math.abs(splitTotal - grandTotal) < 0.01
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-surface-raised border-surface-border text-zinc-400'
            }`}>
              <span>Split total</span>
              <span className="font-mono font-semibold">{sym}{splitTotal.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button className="btn flex-1" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-brand flex-1" onClick={handleSave} disabled={saving}>
            {saving
              ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</>
              : 'Save Payment'
            }
          </button>
        </div>
      </div>
    </div>
  );
}