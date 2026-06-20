/**
 * components/bill/PaymentTab.tsx
 *
 * Full payment tab — method selection, split form, cash/change calculator,
 * and optional customer name/phone capture.
 *
 * FIX: "Amount Received" used to only appear for non-split methods and was
 * really just used to calculate cash change — it wasn't treated as the
 * authoritative "amount actually paid." UPI/card/cheque payments often
 * settle for a slightly different amount than the bill (rounding, a small
 * discount, a card surcharge, etc.) and that difference was completely
 * lost. Now every method (including split) has an explicit, visible
 * "Amount Actually Paid" total that defaults to the bill total but can be
 * edited, and the difference from the bill is shown clearly.
 */

import React, { useEffect } from 'react';

const sans = 'system-ui,-apple-system,sans-serif';

export const PAYMENT_METHODS = [
  {
    key: 'cash', label: 'Cash',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    key: 'upi', label: 'UPI',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3" />
      </svg>
    ),
  },
  {
    key: 'card', label: 'Card',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    key: 'cheque', label: 'Cheque',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12" />
      </svg>
    ),
  },
  {
    key: 'split', label: 'Split',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
];

export const WARN_THRESHOLD_PCT = 0.05;
export const WARN_THRESHOLD_ABS = 20;

export interface SplitEntry { method: string; amount: string; }

interface Props {
  brand:         string;
  sym:           string;
  total:         number;
  tableLabel:    string;
  itemCount:     number;
  payMethod:     string;
  setPayMethod:  (m: string) => void;
  received:      string;
  setReceived:   (v: string) => void;
  splits:        SplitEntry[];
  setSplits:     (s: SplitEntry[]) => void;
  customerName:  string;
  setCustomerName: (v: string) => void;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
}

export default function PaymentTab({
  brand, sym, total, tableLabel, itemCount,
  payMethod, setPayMethod,
  received, setReceived,
  splits, setSplits,
  customerName, setCustomerName,
  customerPhone, setCustomerPhone,
}: Props) {
  const receivedNum  = parseFloat(received) || 0;
  const change       = payMethod !== 'split' ? Math.max(0, receivedNum - total) : 0;
  const splitTotal   = splits.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const splitBalance = total - splitTotal;

  // "Amount actually paid" — for split, this IS splitTotal (sum of the
  // individual entries). For non-split, it's whatever is in `received`.
  // We default `received` to the bill total when the method changes so a
  // waiter who doesn't touch the field still gets the expected behavior
  // (paid == bill), but it stays fully editable.
  useEffect(() => {
    if (payMethod !== 'split' && !received) {
      setReceived(total.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payMethod]);

  const addSplit    = () => setSplits([...splits, { method: 'cash', amount: '' }]);
  const removeSplit = (i: number) => setSplits(splits.filter((_, idx) => idx !== i));
  const updateSplit = (i: number, field: keyof SplitEntry, val: string) =>
    setSplits(splits.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const paidAmount = payMethod === 'split' ? splitTotal : receivedNum;
  const paidDiff   = paidAmount - total;
  const diffIsTiny = Math.abs(paidDiff) < 0.01;

  return (
    <div className="no-print flex-1 overflow-y-auto" style={{ padding: '16px 18px', background: '#fff' }}>
      {/* Total summary */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', background: '#f9fafb', borderRadius: 12,
        border: '1.5px solid #e5e7eb', marginBottom: 16,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', fontFamily: sans, marginBottom: 2 }}>
            Bill Total
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: brand, fontFamily: sans, letterSpacing: '-0.5px' }}>
            {sym}{total.toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: sans }}>{itemCount} items</div>
          <div style={{ fontSize: 11, color: '#6b7280', fontFamily: sans }}>{tableLabel}</div>
        </div>
      </div>

      {/* Customer info */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 8, fontFamily: sans }}>
          Customer <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#d1d5db' }}>— optional</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <input type="text" placeholder="Name" value={customerName} onChange={e => setCustomerName(e.target.value)}
              style={{ width: '100%', padding: '9px 9px 9px 30px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontFamily: sans, fontSize: 13, color: '#374151', boxSizing: 'border-box' as any }} />
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
            </svg>
            <input type="tel" placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
              style={{ width: '100%', padding: '9px 9px 9px 30px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontFamily: sans, fontSize: 13, color: '#374151', boxSizing: 'border-box' as any }} />
          </div>
        </div>
      </div>

      {/* Payment method grid */}
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 8, fontFamily: sans }}>
        Payment Method
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
        {PAYMENT_METHODS.map(m => (
          <button key={m.key} onClick={() => setPayMethod(m.key)} style={{
            padding: '10px 12px', borderRadius: 10,
            border: `1.5px solid ${payMethod === m.key ? brand : '#e5e7eb'}`,
            background: payMethod === m.key ? `${brand}18` : '#fff',
            color: payMethod === m.key ? brand : '#374151',
            fontFamily: sans, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
          }}>
            <span style={{ color: payMethod === m.key ? brand : '#6b7280' }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* Split form */}
      {payMethod === 'split' && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 8, fontFamily: sans }}>
            Split Details
          </div>
          {splits.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select value={s.method} onChange={e => updateSplit(i, 'method', e.target.value)}
                style={{ flex: 1.2, padding: '9px 10px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontFamily: sans, fontSize: 13, color: '#374151', background: '#fff' }}>
                {PAYMENT_METHODS.filter(m => m.key !== 'split').map(m => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              <div style={{ flex: 1, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: sans, fontSize: 13, color: '#9ca3af' }}>{sym}</span>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={s.amount}
                  onChange={e => updateSplit(i, 'amount', e.target.value)}
                  style={{ width: '100%', padding: '9px 9px 9px 24px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontFamily: sans, fontSize: 13, color: '#374151', boxSizing: 'border-box' as any }} />
              </div>
              {splits.length > 2 && (
                <button onClick={() => removeSplit(i)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  ×
                </button>
              )}
            </div>
          ))}
          <button onClick={addSplit}
            style={{ width: '100%', padding: '8px', borderRadius: 10, border: '1.5px dashed #d1d5db', background: '#f9fafb', color: '#6b7280', fontFamily: sans, fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>
            + Add another method
          </button>
        </div>
      )}

      {/* Cash / UPI / Card / Cheque — amount paid */}
      {payMethod !== 'split' && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 8, fontFamily: sans }}>
            Amount Actually Paid
          </div>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: sans, fontSize: 16, color: '#9ca3af', fontWeight: 500 }}>
              {sym}
            </span>
            <input type="number" min="0" step="0.50" placeholder={total.toFixed(2)} value={received}
              onChange={e => setReceived(e.target.value)}
              style={{ width: '100%', padding: '12px 12px 12px 30px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontFamily: sans, fontSize: 18, fontWeight: 700, color: '#111', boxSizing: 'border-box' as any, outline: 'none' }} />
          </div>
          <p style={{ fontSize: 11, color: '#9ca3af', fontFamily: sans, margin: '0 0 12px' }}>
            Defaults to the bill total — edit if the customer paid a different amount (discount, rounding, card surcharge, etc.)
          </p>

          {/* Quick-amount buttons */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {[total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map(amt => (
                <button key={amt} onClick={() => setReceived(amt.toFixed(2))}
                  style={{
                    padding: '6px 12px', borderRadius: 8,
                    border: `1.5px solid ${Math.abs(receivedNum - amt) < 0.01 ? brand : '#e5e7eb'}`,
                    background: Math.abs(receivedNum - amt) < 0.01 ? `${brand}15` : '#f9fafb',
                    fontFamily: sans, fontSize: 12,
                    color: Math.abs(receivedNum - amt) < 0.01 ? brand : '#374151',
                    cursor: 'pointer', fontWeight: 600, transition: 'all 0.12s',
                  }}>
                  {sym}{amt.toFixed(0)}
                </button>
              ))}
          </div>

          {/* Change display — only meaningful for cash, but harmless to show for all */}
          {payMethod === 'cash' && (
            <div style={{
              padding: '12px 16px', borderRadius: 12,
              background: change > 0 ? '#f0fdf4' : '#f9fafb',
              border: `1.5px solid ${change > 0 ? '#bbf7d0' : '#e5e7eb'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 10,
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: change > 0 ? '#16a34a' : '#9ca3af', fontFamily: sans, marginBottom: 2 }}>
                  Change to return
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: change > 0 ? '#16a34a' : '#d1d5db', fontFamily: sans }}>
                  {sym}{change.toFixed(2)}
                </div>
              </div>
              {change > 0 && (
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bill vs Paid summary — shown for ALL methods including split */}
      <div style={{
        padding: '10px 14px', borderRadius: 10,
        background: diffIsTiny ? '#f0fdf4' : paidDiff < 0 ? '#fef2f2' : '#eff6ff',
        border: `1.5px solid ${diffIsTiny ? '#bbf7d0' : paidDiff < 0 ? '#fca5a5' : '#bfdbfe'}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: sans, fontSize: 13, marginBottom: diffIsTiny ? 0 : 4 }}>
          <span style={{ color: '#374151', fontWeight: 500 }}>
            {payMethod === 'split' ? 'Split total' : 'Amount paid'}
          </span>
          <span style={{ fontWeight: 700, color: diffIsTiny ? '#16a34a' : '#374151' }}>
            {sym}{paidAmount.toFixed(2)}
          </span>
        </div>
        {!diffIsTiny && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: sans, fontSize: 12 }}>
            <span style={{ color: paidDiff < 0 ? '#dc2626' : '#2563eb', fontWeight: 500 }}>
              {paidDiff < 0 ? 'Less than bill (discount/short)' : 'More than bill (overpaid/tip)'}
            </span>
            <span style={{ fontWeight: 700, color: paidDiff < 0 ? '#dc2626' : '#2563eb' }}>
              {paidDiff < 0 ? '-' : '+'}{sym}{Math.abs(paidDiff).toFixed(2)}
            </span>
          </div>
        )}
        {diffIsTiny && (
          <div style={{ fontSize: 11, color: '#16a34a', fontFamily: sans, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Matches bill exactly
          </div>
        )}
      </div>
    </div>
  );
}