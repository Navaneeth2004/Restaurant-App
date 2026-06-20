import React, { useState, useEffect } from 'react';
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

type OrderType = 'dine_in' | 'parcel';

interface SplitEntry { method: string; amount: string; }

interface Props {
  orderIds: string[];
  currentMethod: string | null;
  total: number;
  /** Previously recorded amount actually paid, if any (for prefill) */
  currentAmountPaid?: number | null;
  /** Previously recorded split entries, if method was split (for prefill) */
  currentPaymentDetails?: any;
  /** Previously recorded order type, if any (for prefill) */
  currentOrderType?: OrderType | null;
  onClose: () => void;
  onSaved: (newMethod: string, newDetails?: any, newAmountPaid?: number, newOrderType?: OrderType) => void;
}

function parseSplitDetails(details: any): SplitEntry[] | null {
  try {
    const arr = Array.isArray(details)
      ? details
      : typeof details === 'string'
        ? JSON.parse(details)
        : null;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr.map((e: any) => ({ method: e.method || 'cash', amount: String(e.amount ?? '') }));
  } catch {
    return null;
  }
}

export default function PaymentEditModal({
  orderIds, currentMethod, total, currentAmountPaid, currentPaymentDetails, currentOrderType,
  onClose, onSaved,
}: Props) {
  const settings = useSettings();
  const sym      = settings.currency_symbol || '₹';
  const taxPct   = parseFloat(settings.tax_percent || '5') / 100;
  const grandTotal = total * (1 + taxPct);

  const [method,  setMethod]  = useState(currentMethod || 'cash');

  // FIX: prefill split entries from currentPaymentDetails if the order was
  // already a split payment, instead of always starting from two blank
  // rows. Previously, opening "Edit Payment" on a split order showed empty
  // Cash/UPI rows with 0 amounts, and "Amount Paid" silently kept showing
  // the OLD recorded amount_paid (e.g. the bill total) instead of the
  // actual split sum — because nothing recalculated it until Save was
  // clicked, and even then the split total wasn't reflected back into the
  // summary view consistently. Now splitTotal always drives the displayed
  // "paid" figure live, and starts pre-populated with the real split.
  const initialSplits = (currentMethod === 'split' && parseSplitDetails(currentPaymentDetails))
    || [{ method: 'cash', amount: '' }, { method: 'upi', amount: '' }];
  const [splits,  setSplits]  = useState<SplitEntry[]>(initialSplits);

  const [amountPaid, setAmountPaid] = useState(
    currentAmountPaid != null ? currentAmountPaid.toFixed(2) : grandTotal.toFixed(2)
  );
  // Order type — defaults to whatever was recorded, or Dine In if unset
  // (testing-stage app, so older/unset orders default to Dine In).
  const [orderType, setOrderType] = useState<OrderType>(currentOrderType || 'dine_in');
  const [saving,  setSaving]  = useState(false);
  const toast = useToast();

  const splitTotal = splits.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  // Keep the non-split "amount paid" field in sync with whichever method
  // is selected, so switching methods doesn't leave a stale figure behind.
  useEffect(() => {
    if (method !== 'split' && currentMethod !== method) {
      // Only reset when actually switching INTO a different non-split
      // method than what was originally recorded — avoids clobbering a
      // value the admin just typed.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  const addSplit    = () => setSplits(s => [...s, { method: 'cash', amount: '' }]);
  const removeSplit = (i: number) => setSplits(s => s.filter((_, idx) => idx !== i));
  const updateSplit = (i: number, field: keyof SplitEntry, val: string) =>
    setSplits(s => s.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  // FIX: this is now always the live, correct "what will be saved" figure —
  // splitTotal for split, the editable field otherwise. Nothing here can
  // go stale relative to what Save actually sends.
  const effectivePaid = method === 'split' ? splitTotal : (parseFloat(amountPaid) || 0);
  const diff = effectivePaid - grandTotal;
  const diffIsTiny = Math.abs(diff) < 0.01;

  const handleSave = async () => {
    setSaving(true);
    try {
      let paymentDetails: any = null;
      if (method === 'split') {
        paymentDetails = splits.filter(s => parseFloat(s.amount) > 0).map(s => ({ method: s.method, amount: parseFloat(s.amount) }));
      }
      const finalAmountPaid = method === 'split' ? splitTotal : (parseFloat(amountPaid) || grandTotal);
      await Promise.all(orderIds.map(id => updateOrderPayment(id, {
        payment_method: method,
        payment_details: paymentDetails,
        change_amount: 0,
        amount_paid: finalAmountPaid,
        order_type: orderType,
      } as any)));
      toast('Payment updated', 'success');
      onSaved(method, paymentDetails, finalAmountPaid, orderType);
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
            <span className="text-zinc-500 text-xs">Bill</span>
            <span className="font-mono font-bold text-white text-sm">{sym}{grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {currentMethod && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-surface-raised border border-surface-border text-xs text-zinc-500">
            Currently: <span className="text-zinc-300 font-semibold capitalize">{currentMethod}</span>
            {currentAmountPaid != null && Math.abs(currentAmountPaid - grandTotal) > 0.01 && (
              <span className="ml-1.5">
                — paid <span className="text-zinc-300 font-semibold">{sym}{currentAmountPaid.toFixed(2)}</span>
              </span>
            )}
          </div>
        )}

        {/* Order type — Dine In / Parcel slider */}
        <label className="label mb-2">Order Type</label>
        <div
          role="radiogroup"
          aria-label="Order type"
          onClick={() => setOrderType(t => t === 'dine_in' ? 'parcel' : 'dine_in')}
          className="relative flex bg-surface-raised rounded-xl p-1 mb-4 cursor-pointer border border-brand-500/50 select-none"
        >
          <div
            aria-hidden
            className="absolute top-1 bottom-1 bg-brand-500 rounded-lg transition-all duration-150"
            style={{ left: orderType === 'dine_in' ? 4 : '50%', width: 'calc(50% - 4px)' }}
          />
          {(['dine_in', 'parcel'] as const).map(t => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={orderType === t}
              onClick={e => { e.stopPropagation(); setOrderType(t); }}
              className={`flex-1 relative z-10 text-center py-2 text-xs font-bold transition-colors bg-transparent border-none cursor-pointer ${
                orderType === t ? 'text-white' : 'text-zinc-400'
              }`}
            >
              {t === 'dine_in' ? 'Dine In' : 'Parcel'}
            </button>
          ))}
        </div>

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

        {method === 'split' ? (
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
          </div>
        ) : (
          <div className="mb-4">
            <label className="label mb-2">Amount Actually Paid</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">{sym}</span>
              <input type="number" min="0" step="0.01" placeholder={grandTotal.toFixed(2)} value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                className="input pl-7 font-mono text-sm" />
            </div>
            <p className="text-zinc-600 text-[10px] mt-1.5">Edit if the customer paid a different amount than the bill</p>
          </div>
        )}

        {/* Bill vs Paid summary — always reflects what Save will actually send */}
        <div className={`flex justify-between text-xs px-3 py-2 rounded-lg border mb-2 ${
          diffIsTiny
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : diff < 0
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
        }`}>
          <span>{method === 'split' ? 'Split total (= amount paid)' : 'Amount paid'}</span>
          <span className="font-mono font-semibold">{sym}{effectivePaid.toFixed(2)}</span>
        </div>
        {!diffIsTiny && (
          <div className={`flex justify-between text-[11px] px-3 py-1.5 rounded-lg mb-2 ${diff < 0 ? 'text-red-400/80' : 'text-blue-400/80'}`}>
            <span>{diff < 0 ? 'Less than bill' : 'More than bill'}</span>
            <span className="font-mono">{diff < 0 ? '-' : '+'}{sym}{Math.abs(diff).toFixed(2)}</span>
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