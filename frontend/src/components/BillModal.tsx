import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { closeOrderWithPayment } from '../services/api';
import { useToast } from '../context/ToastContext';
import type { Order, Table } from '../types';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;

interface Props {
  orders: Order[];
  orderId: string;
  table: Table | null;
  onClose: () => void;
  onClosed: () => void;
}

const PAYMENT_METHODS = [
  { key: 'cash',   label: 'Cash',   icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
  )},
  { key: 'upi',    label: 'UPI',    icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3" /></svg>
  )},
  { key: 'card',   label: 'Card',   icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
  )},
  { key: 'cheque', label: 'Cheque', icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
  )},
  { key: 'split',  label: 'Split',  icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
  )},
];

interface SplitEntry { method: string; amount: string; }

// Large-difference threshold: warn if difference > 5% of total or > 20 units
const WARN_THRESHOLD_PCT  = 0.05;
const WARN_THRESHOLD_ABS  = 20;

// Themed confirmation modal
function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
  confirmLabel?: string; danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-surface-card border border-surface-border rounded-2xl p-6 w-full max-w-sm animate-slide-up shadow-2xl">
        <h3 className="font-bold text-white text-base mb-2">{title}</h3>
        <p className="text-zinc-400 text-sm leading-relaxed mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-surface-border text-zinc-300 text-sm font-semibold hover:bg-surface-raised transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${danger ? 'bg-amber-500 text-white hover:bg-amber-600 border border-amber-600' : 'bg-brand-500 text-white hover:bg-brand-600 border border-brand-600'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BillModal({ orders, orderId, table, onClose, onClosed }: Props) {
  const settings = useSettings();
  const toast    = useToast();
  const sym      = settings.currency_symbol || '₹';
  const taxPct   = parseFloat(settings.tax_percent || '5') / 100;
  const brand    = (settings.brand_color as string) || '#f97316';
  const logoUrl  = (settings as any).logo_url as string | undefined;

  // Merge all order items
  const itemMap = new Map<string, { name: string; price: number; quantity: number; note: string }>();
  for (const order of orders) {
    for (const item of order.items) {
      const key = `${item.name}||${item.note || ''}||${item.price}`;
      const ex = itemMap.get(key);
      if (ex) { ex.quantity += item.quantity; }
      else { itemMap.set(key, { name: item.name, price: item.price, quantity: item.quantity, note: item.note || '' }); }
    }
  }
  const allItems = Array.from(itemMap.values());
  const subtotal = allItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax      = subtotal * taxPct;
  const total    = subtotal + tax;

  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const [payMethod,    setPayMethod]    = useState('cash');
  const [received,     setReceived]     = useState('');
  const [splits,       setSplits]       = useState<SplitEntry[]>([
    { method: 'cash', amount: '' },
    { method: 'upi',  amount: '' },
  ]);
  const [activeTab,    setActiveTab]    = useState<'bill'|'payment'>('bill');
  const [paying,       setPaying]       = useState(false);
  const [warnModal,    setWarnModal]    = useState(false);
  const [pendingPay,   setPendingPay]   = useState(false);

  const receivedNum  = parseFloat(received) || 0;
  const change       = payMethod !== 'split' ? Math.max(0, receivedNum - total) : 0;
  const splitTotal   = splits.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const splitBalance = total - splitTotal;

  const addSplit    = () => setSplits(s => [...s, { method: 'cash', amount: '' }]);
  const removeSplit = (i: number) => setSplits(s => s.filter((_, idx) => idx !== i));
  const updateSplit = (i: number, field: keyof SplitEntry, val: string) =>
    setSplits(s => s.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const executePay = async () => {
    setPaying(true);
    setWarnModal(false);
    setPendingPay(false);
    try {
      let paymentDetails: any = null;
      let changeAmt = 0;

      if (payMethod === 'split') {
        paymentDetails = splits.filter(s => parseFloat(s.amount) > 0).map(s => ({
          method: s.method,
          amount: parseFloat(s.amount),
        }));
      } else {
        changeAmt = change;
        if (received) paymentDetails = { received: receivedNum, change: changeAmt };
      }

      await closeOrderWithPayment(orderId, {
        payment_method:  payMethod,
        payment_details: paymentDetails,
        change_amount:   changeAmt,
      });
      toast('Table cleared!', 'success');
      onClosed();
    } catch (err: any) {
      toast(err?.response?.data?.error || 'Failed to close order', 'error');
    } finally {
      setPaying(false);
    }
  };

  const handleMarkPaid = async () => {
    if (payMethod === 'split') {
      const diff = Math.abs(splitBalance);
      const bigDifference = diff > total * WARN_THRESHOLD_PCT || diff > WARN_THRESHOLD_ABS;
      if (bigDifference && splitBalance > 0) {
        // Underpaid by a significant amount — warn
        setPendingPay(true);
        setWarnModal(true);
        return;
      }
      // Small difference (rounding, discount) — proceed silently
    }
    await executePay();
  };

  const sans = 'system-ui,-apple-system,sans-serif';

  return (
    <>
      {warnModal && (
        <ConfirmModal
          title="Large Payment Difference"
          message={`The split total (${sym}${splitTotal.toFixed(2)}) is ${sym}${Math.abs(splitBalance).toFixed(2)} less than the bill total (${sym}${total.toFixed(2)}). Are you sure you want to proceed?`}
          confirmLabel="Mark Paid Anyway"
          danger
          onConfirm={executePay}
          onCancel={() => { setWarnModal(false); setPendingPay(false); setPaying(false); }}
        />
      )}

      {/* Full-screen on mobile, centered modal on desktop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col md:items-center md:justify-center md:p-4"
        onClick={onClose}
      >
        <style>{`
          @media print {
            @page { size: 80mm auto; margin: 4mm; }
            body * { visibility: hidden !important; }
            .bill-print-area, .bill-print-area * { visibility: visible !important; }
            .bill-print-area {
              position: fixed !important; top: 0 !important; left: 0 !important;
              width: 72mm !important; max-width: 72mm !important;
              border-radius: 0 !important; box-shadow: none !important;
              max-height: none !important; overflow: visible !important;
            }
            .bill-scroll { overflow: visible !important; max-height: none !important; }
            .no-print { display: none !important; }
            .bill-header * { color: #111 !important; background: transparent !important; }
          }
        `}</style>

        <div
          className="bill-print-area flex flex-col bg-white w-full md:max-w-sm md:rounded-2xl overflow-hidden shadow-2xl flex-1 md:flex-none md:max-h-[92vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* ── MOBILE TOP BAR (no-print) ── */}
          <div className="no-print md:hidden flex-shrink-0 flex items-center px-4 py-3 border-b border-gray-100 bg-white">
            <button onClick={onClose} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Back</span>
            </button>
            <span className="flex-1 text-center text-sm font-bold text-gray-800">
              {table?.label || `Table ${orders[0]?.table_id}`}
            </span>
            <div className="w-14" />
          </div>

          {/* ── HEADER ── */}
          <div className="bill-header flex-shrink-0" style={{ background: brand, padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
              {logoUrl && (
                <img src={`${API_BASE}${logoUrl}`} alt="logo"
                  style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: sans, letterSpacing: '-0.3px' }}>
                  {settings.restaurant_name || 'Restaurant'}
                </div>
                {settings.address && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontFamily: sans }}>{settings.address}</div>
                )}
              </div>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(0,0,0,0.2)', borderRadius: 20, padding: '3px 12px',
              fontSize: 11, color: '#fff', fontFamily: sans,
            }}>
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {table?.label || `Table ${orders[0]?.table_id}`}
              <span style={{ opacity: 0.6 }}>·</span>
              {dateStr}
              <span style={{ opacity: 0.6 }}>·</span>
              {timeStr}
            </div>
          </div>

          {/* ── TABS (no-print) ── */}
          <div className="no-print flex-shrink-0 flex bg-white border-b border-gray-100">
            {[{ key: 'bill', label: 'Bill' }, { key: 'payment', label: 'Payment' }].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 700, fontFamily: sans,
                  borderBottom: activeTab === tab.key ? `2.5px solid ${brand}` : '2.5px solid transparent',
                  color: activeTab === tab.key ? brand : '#9ca3af',
                  background: 'white', border: 'none',
                  borderBottom: activeTab === tab.key ? `2.5px solid ${brand}` : '2.5px solid transparent',
                  cursor: 'pointer', letterSpacing: '0.01em',
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── BILL TAB ── */}
          {activeTab === 'bill' && (
            <div className="bill-scroll flex-1 overflow-y-auto" style={{ background: '#fff' }}>
              {/* Items */}
              <div style={{ padding: '14px 18px 0' }}>
                <div style={{ borderTop: '1.5px dashed #e5e5e5', marginBottom: 10 }} />
                {allItems.map((item, i) => (
                  <div key={i} style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, paddingRight: 10 }}>
                      <div style={{ fontSize: 13, color: '#111', fontWeight: 600, fontFamily: sans }}>
                        <span style={{ color: brand, fontWeight: 800 }}>{item.quantity}×</span> {item.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#bbb', fontFamily: sans, marginTop: 1 }}>
                        @ {sym}{item.price.toFixed(2)} each
                      </div>
                      {item.note && (
                        <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic', fontFamily: sans, marginTop: 1 }}>
                          ↳ {item.note}
                        </div>
                      )}
                    </div>
                    <div style={{ whiteSpace: 'nowrap', fontSize: 13, fontWeight: 700, fontFamily: sans, color: '#111' }}>
                      {sym}{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div style={{ padding: '0 18px 14px' }}>
                <div style={{ borderTop: '1.5px dashed #e5e5e5', margin: '4px 0 10px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5, color: '#888', fontFamily: sans }}>
                  <span>Subtotal</span>
                  <span style={{ fontWeight: 600 }}>{sym}{subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: '#888', fontFamily: sans }}>
                  <span>Tax ({settings.tax_percent || 5}%)</span>
                  <span style={{ fontWeight: 600 }}>{sym}{tax.toFixed(2)}</span>
                </div>
                <div style={{ borderTop: '1.5px dashed #e5e5e5', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#111', fontFamily: sans }}>TOTAL</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: brand, fontFamily: sans }}>{sym}{total.toFixed(2)}</span>
                </div>
                {settings.bill_footer && (
                  <>
                    <div style={{ borderTop: '1.5px dashed #e5e5e5', margin: '10px 0 6px' }} />
                    <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', fontStyle: 'italic', fontFamily: sans }}>
                      {settings.bill_footer}
                    </div>
                  </>
                )}
                <div style={{ textAlign: 'center', fontSize: 9, color: '#e0e0e0', letterSpacing: 4, marginTop: 8 }}>
                  |||||  ||||||  |||||  ||||||  ||||
                </div>
              </div>
            </div>
          )}

          {/* ── PAYMENT TAB ── */}
          {activeTab === 'payment' && (
            <div className="no-print flex-1 overflow-y-auto" style={{ padding: '16px 18px', background: '#fff' }}>

              {/* Total banner */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: '#f9fafb', borderRadius: 12,
                border: '1.5px solid #e5e7eb', marginBottom: 16,
              }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', fontFamily: sans, marginBottom: 2 }}>
                    Total Due
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: brand, fontFamily: sans, letterSpacing: '-0.5px' }}>
                    {sym}{total.toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: sans }}>{allItems.reduce((s,i)=>s+i.quantity,0)} items</div>
                  <div style={{ fontSize: 11, color: '#6b7280', fontFamily: sans }}>{table?.label || `Table ${orders[0]?.table_id}`}</div>
                </div>
              </div>

              {/* Payment method */}
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 8, fontFamily: sans }}>
                Payment Method
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.key}
                    onClick={() => setPayMethod(m.key)}
                    style={{
                      padding: '10px 12px', borderRadius: 10,
                      border: `1.5px solid ${payMethod === m.key ? brand : '#e5e7eb'}`,
                      background: payMethod === m.key ? `${brand}18` : '#fff',
                      color: payMethod === m.key ? brand : '#374151',
                      fontFamily: sans, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'all 0.15s',
                    }}>
                    <span style={{ color: payMethod === m.key ? brand : '#6b7280' }}>{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Split payment entries */}
              {payMethod === 'split' ? (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 8, fontFamily: sans }}>
                    Split Details
                  </div>
                  {splits.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <select
                        value={s.method}
                        onChange={e => updateSplit(i, 'method', e.target.value)}
                        style={{ flex: 1.2, padding: '9px 10px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontFamily: sans, fontSize: 13, color: '#374151', background: '#fff' }}>
                        {PAYMENT_METHODS.filter(m => m.key !== 'split').map(m => (
                          <option key={m.key} value={m.key}>{m.label}</option>
                        ))}
                      </select>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: sans, fontSize: 13, color: '#9ca3af' }}>{sym}</span>
                        <input
                          type="number" min="0" step="0.01" placeholder="0.00"
                          value={s.amount}
                          onChange={e => updateSplit(i, 'amount', e.target.value)}
                          style={{ width: '100%', padding: '9px 9px 9px 24px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontFamily: sans, fontSize: 13, color: '#374151', boxSizing: 'border-box' }}
                        />
                      </div>
                      {splits.length > 2 && (
                        <button onClick={() => removeSplit(i)} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                      )}
                    </div>
                  ))}
                  <button onClick={addSplit} style={{ width: '100%', padding: '8px', borderRadius: 10, border: '1.5px dashed #d1d5db', background: '#f9fafb', color: '#6b7280', fontFamily: sans, fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>
                    + Add another method
                  </button>

                  {/* Split summary */}
                  <div style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: Math.abs(splitBalance) < 0.01 ? '#f0fdf4' : splitBalance > total * WARN_THRESHOLD_PCT ? '#fef2f2' : '#fffbeb',
                    border: `1.5px solid ${Math.abs(splitBalance) < 0.01 ? '#bbf7d0' : splitBalance > total * WARN_THRESHOLD_PCT ? '#fca5a5' : '#fde68a'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: sans, fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: '#374151', fontWeight: 500 }}>Split total</span>
                      <span style={{ fontWeight: 700, color: Math.abs(splitBalance) < 0.01 ? '#16a34a' : '#374151' }}>{sym}{splitTotal.toFixed(2)}</span>
                    </div>
                    {splitBalance > 0.01 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: sans, fontSize: 12 }}>
                        <span style={{ color: splitBalance > total * WARN_THRESHOLD_PCT ? '#dc2626' : '#d97706', fontWeight: 500 }}>
                          {splitBalance > total * WARN_THRESHOLD_PCT ? 'Significant underpayment' : 'Difference (discount / rounding)'}
                        </span>
                        <span style={{ fontWeight: 700, color: splitBalance > total * WARN_THRESHOLD_PCT ? '#dc2626' : '#d97706' }}>
                          -{sym}{splitBalance.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {Math.abs(splitBalance) < 0.01 && (
                      <div style={{ fontSize: 11, color: '#16a34a', fontFamily: sans, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                        Balanced
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Cash/UPI/Card/Cheque — received + change */
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 8, fontFamily: sans }}>
                    Amount Received
                  </div>
                  <div style={{ position: 'relative', marginBottom: 12 }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: sans, fontSize: 16, color: '#9ca3af', fontWeight: 500 }}>{sym}</span>
                    <input
                      type="number" min="0" step="0.50"
                      placeholder={total.toFixed(2)}
                      value={received}
                      onChange={e => setReceived(e.target.value)}
                      style={{ width: '100%', padding: '12px 12px 12px 30px', borderRadius: 12, border: '1.5px solid #e5e7eb', fontFamily: sans, fontSize: 18, fontWeight: 700, color: '#111', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>

                  {/* Quick amounts */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                    {[total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100]
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .map(amt => (
                        <button key={amt} onClick={() => setReceived(amt.toFixed(2))}
                          style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${Math.abs(receivedNum - amt) < 0.01 ? brand : '#e5e7eb'}`, background: Math.abs(receivedNum - amt) < 0.01 ? `${brand}15` : '#f9fafb', fontFamily: sans, fontSize: 12, color: Math.abs(receivedNum - amt) < 0.01 ? brand : '#374151', cursor: 'pointer', fontWeight: 600, transition: 'all 0.12s' }}>
                          {sym}{amt.toFixed(0)}
                        </button>
                      ))}
                  </div>

                  {/* Change display */}
                  <div style={{
                    padding: '12px 16px', borderRadius: 12,
                    background: change > 0 ? '#f0fdf4' : '#f9fafb',
                    border: `1.5px solid ${change > 0 ? '#bbf7d0' : '#e5e7eb'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
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
                </div>
              )}
            </div>
          )}

          {/* ── ACTIONS ── */}
          <div className="no-print flex-shrink-0" style={{ padding: '12px 16px 16px', background: '#fff', borderTop: '1.5px solid #f3f4f6' }}>
            <button
              onClick={handleMarkPaid}
              disabled={paying}
              style={{
                width: '100%', padding: '14px', borderRadius: 12,
                background: paying ? '#9ca3af' : '#10b981',
                border: 'none',
                color: '#fff', fontWeight: 800, fontSize: 15,
                cursor: paying ? 'not-allowed' : 'pointer',
                fontFamily: sans, marginBottom: 10, letterSpacing: '0.01em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
              {paying
                ? <><span style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Processing…</>
                : <><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Mark Paid &nbsp;·&nbsp; {sym}{total.toFixed(2)}</>
              }
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.print()} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: sans, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659" /></svg>
                Print
              </button>
              <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 500, fontSize: 13, cursor: 'pointer', fontFamily: sans }}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}