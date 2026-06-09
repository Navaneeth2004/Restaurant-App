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
  { key: 'cash',   label: 'Cash',   icon: '₹' },
  { key: 'upi',    label: 'UPI',    icon: '⊕' },
  { key: 'card',   label: 'Card',   icon: '▭' },
  { key: 'cheque', label: 'Cheque', icon: '✎' },
  { key: 'split',  label: 'Split',  icon: '⊗' },
];

interface SplitEntry { method: string; amount: string; }

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

  // Payment state
  const [payMethod,   setPayMethod]   = useState('cash');
  const [received,    setReceived]    = useState('');
  const [splits,      setSplits]      = useState<SplitEntry[]>([
    { method: 'cash', amount: '' },
    { method: 'upi',  amount: '' },
  ]);
  const [activeTab,   setActiveTab]   = useState<'bill'|'payment'>('bill');
  const [paying,      setPaying]      = useState(false);

  const receivedNum   = parseFloat(received) || 0;
  const change        = payMethod !== 'split' ? Math.max(0, receivedNum - total) : 0;
  const splitTotal    = splits.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const splitBalance  = total - splitTotal;

  const addSplit = () => setSplits(s => [...s, { method: 'cash', amount: '' }]);
  const removeSplit = (i: number) => setSplits(s => s.filter((_, idx) => idx !== i));
  const updateSplit = (i: number, field: keyof SplitEntry, val: string) =>
    setSplits(s => s.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const handleMarkPaid = async () => {
    setPaying(true);
    try {
      let paymentDetails: any = null;
      let changeAmt = 0;

      if (payMethod === 'split') {
        paymentDetails = splits.filter(s => parseFloat(s.amount) > 0).map(s => ({
          method: s.method,
          amount: parseFloat(s.amount),
        }));
        if (Math.abs(splitBalance) > 0.01) {
          toast(`Split total (${sym}${splitTotal.toFixed(2)}) doesn't match bill total (${sym}${total.toFixed(2)})`, 'error');
          setPaying(false);
          return;
        }
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
    } catch {
      toast('Failed to close order', 'error');
    } finally {
      setPaying(false);
    }
  };

  const sans = 'system-ui,-apple-system,sans-serif';

  return (
    <div
      className="bill-modal-overlay fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
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
        className="bill-print-area flex flex-col bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl"
        style={{ height: 'min(92dvh, 92vh)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── HEADER ── */}
        <div className="bill-header flex-shrink-0" style={{ background: brand, padding: '10px 16px', textAlign: 'center' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            {logoUrl && <img src={`${API_BASE}${logoUrl}`} alt="logo" style={{ width:32, height:32, borderRadius:6, objectFit:'cover', flexShrink:0 }} />}
            <div style={{ textAlign:'left' }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#fff', fontFamily:sans }}>{settings.restaurant_name || 'Restaurant'}</div>
              {settings.address && <div style={{ fontSize:10, color:'rgba(255,255,255,0.85)', fontFamily:sans }}>{settings.address}</div>}
            </div>
          </div>
          <div style={{ display:'inline-block', marginTop:6, background:'rgba(0,0,0,0.2)', borderRadius:20, padding:'2px 10px', fontSize:11, color:'#fff', fontFamily:sans }}>
            {table?.label || `Table ${orders[0]?.table_id}`} · {dateStr} · {timeStr}
          </div>
        </div>

        {/* ── TABS (no-print) ── */}
        <div className="no-print flex-shrink-0 flex border-b border-gray-200 bg-white">
          {[{ key:'bill', label:'Bill' }, { key:'payment', label:'Payment' }].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                flex:1, padding:'10px', fontSize:13, fontWeight:600, fontFamily:sans,
                borderBottom: activeTab === tab.key ? `2px solid ${brand}` : '2px solid transparent',
                color: activeTab === tab.key ? brand : '#6b7280',
                background: 'white', border: 'none', borderBottom: activeTab === tab.key ? `2px solid ${brand}` : '2px solid transparent',
                cursor:'pointer',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── BILL TAB ── */}
        {activeTab === 'bill' && (
          <div className="bill-scroll flex-1 overflow-y-auto" style={{ padding:'10px 14px', background:'#fff' }}>
            <div style={{ borderTop:'1px dashed #e5e5e5', margin:'0 0 8px' }} />
            {allItems.map((item, i) => (
              <div key={i} style={{ marginBottom:7 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#111' }}>
                  <span style={{ flex:1, paddingRight:8, fontFamily:sans, fontWeight:600 }}>
                    <span style={{ color:brand, fontWeight:700 }}>{item.quantity}×</span> {item.name}
                  </span>
                  <span style={{ whiteSpace:'nowrap', fontFamily:sans, fontWeight:600 }}>{sym}{(item.price*item.quantity).toFixed(2)}</span>
                </div>
                <div style={{ fontSize:10, color:'#bbb', paddingLeft:2, fontFamily:sans }}>@ {sym}{item.price.toFixed(2)} each</div>
                {item.note && <div style={{ fontSize:10, color:'#888', paddingLeft:2, fontStyle:'italic', fontFamily:sans }}>↳ {item.note}</div>}
              </div>
            ))}
            <div style={{ borderTop:'1px dashed #e5e5e5', margin:'6px 0 4px' }} />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3, color:'#666', fontFamily:sans }}><span>Subtotal</span><span>{sym}{subtotal.toFixed(2)}</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3, color:'#666', fontFamily:sans }}><span>Tax ({settings.tax_percent||5}%)</span><span>{sym}{tax.toFixed(2)}</span></div>
            <div style={{ borderTop:'1px dashed #e5e5e5', margin:'4px 0' }} />
            <div style={{ display:'flex', justifyContent:'space-between', margin:'6px 0 4px', fontFamily:sans }}>
              <span style={{ fontSize:15, fontWeight:800, color:'#111' }}>TOTAL</span>
              <span style={{ fontSize:15, fontWeight:800, color:brand }}>{sym}{total.toFixed(2)}</span>
            </div>
            {settings.bill_footer && (
              <>
                <div style={{ borderTop:'1px dashed #e5e5e5', margin:'4px 0' }} />
                <div style={{ textAlign:'center', fontSize:11, color:'#aaa', margin:'6px 0 2px', fontFamily:sans, fontStyle:'italic' }}>{settings.bill_footer}</div>
              </>
            )}
          </div>
        )}

        {/* ── PAYMENT TAB ── */}
        {activeTab === 'payment' && (
          <div className="no-print flex-1 overflow-y-auto" style={{ padding:'12px 14px', background:'#fff' }}>

            {/* Total banner */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, padding:'10px 14px', background:'#f9fafb', borderRadius:10, border:'1px solid #e5e7eb' }}>
              <span style={{ fontFamily:sans, fontSize:13, fontWeight:600, color:'#374151' }}>Bill Total</span>
              <span style={{ fontFamily:sans, fontSize:18, fontWeight:800, color:brand }}>{sym}{total.toFixed(2)}</span>
            </div>

            {/* Payment method selector */}
            <p style={{ fontFamily:sans, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Payment Method</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:14 }}>
              {PAYMENT_METHODS.map(m => (
                <button key={m.key} onClick={() => setPayMethod(m.key)}
                  style={{
                    padding:'9px 10px', borderRadius:10, border:`1.5px solid ${payMethod===m.key ? brand : '#e5e7eb'}`,
                    background: payMethod===m.key ? brand+'15' : '#fff',
                    color: payMethod===m.key ? brand : '#374151',
                    fontFamily:sans, fontSize:13, fontWeight:600, cursor:'pointer',
                    display:'flex', alignItems:'center', gap:6,
                  }}>
                  <span style={{ fontSize:14 }}>{m.icon}</span>{m.label}
                </button>
              ))}
            </div>

            {/* Split payment entries */}
            {payMethod === 'split' ? (
              <div>
                <p style={{ fontFamily:sans, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Split Details</p>
                {splits.map((s, i) => (
                  <div key={i} style={{ display:'flex', gap:6, marginBottom:7, alignItems:'center' }}>
                    <select value={s.method} onChange={e => updateSplit(i, 'method', e.target.value)}
                      style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid #e5e7eb', fontFamily:sans, fontSize:13, color:'#374151', background:'#fff' }}>
                      {PAYMENT_METHODS.filter(m => m.key !== 'split').map(m => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                    </select>
                    <div style={{ flex:1, position:'relative' }}>
                      <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontFamily:sans, fontSize:13, color:'#9ca3af' }}>{sym}</span>
                      <input type="number" min="0" step="0.01" placeholder="0.00" value={s.amount}
                        onChange={e => updateSplit(i, 'amount', e.target.value)}
                        style={{ width:'100%', padding:'8px 8px 8px 22px', borderRadius:8, border:'1px solid #e5e7eb', fontFamily:sans, fontSize:13, color:'#374151', boxSizing:'border-box' }} />
                    </div>
                    {splits.length > 2 && (
                      <button onClick={() => removeSplit(i)} style={{ width:28, height:28, borderRadius:6, border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
                    )}
                  </div>
                ))}
                <button onClick={addSplit} style={{ width:'100%', padding:'7px', borderRadius:8, border:'1px dashed #d1d5db', background:'#f9fafb', color:'#6b7280', fontFamily:sans, fontSize:13, cursor:'pointer', marginBottom:10 }}>
                  + Add another method
                </button>
                {/* Split balance */}
                <div style={{ padding:'8px 12px', borderRadius:8, background: Math.abs(splitBalance) < 0.01 ? '#f0fdf4' : '#fef9c3', border:`1px solid ${Math.abs(splitBalance) < 0.01 ? '#bbf7d0' : '#fde68a'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontFamily:sans, fontSize:13 }}>
                    <span style={{ color:'#374151' }}>Split total</span>
                    <span style={{ fontWeight:700, color: Math.abs(splitBalance) < 0.01 ? '#16a34a' : '#d97706' }}>{sym}{splitTotal.toFixed(2)}</span>
                  </div>
                  {Math.abs(splitBalance) > 0.01 && (
                    <div style={{ display:'flex', justifyContent:'space-between', fontFamily:sans, fontSize:12, marginTop:3 }}>
                      <span style={{ color:'#d97706' }}>Remaining</span>
                      <span style={{ fontWeight:700, color:'#d97706' }}>{sym}{Math.abs(splitBalance).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Cash/UPI/Card/Cheque — received + change calculator */
              <div>
                <p style={{ fontFamily:sans, fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Change Calculator</p>
                <div style={{ marginBottom:8 }}>
                  <label style={{ fontFamily:sans, fontSize:12, color:'#6b7280', display:'block', marginBottom:4 }}>Amount Received</label>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontFamily:sans, fontSize:14, color:'#9ca3af' }}>{sym}</span>
                    <input
                      type="number" min="0" step="0.50" placeholder={total.toFixed(2)}
                      value={received}
                      onChange={e => setReceived(e.target.value)}
                      style={{ width:'100%', padding:'10px 10px 10px 28px', borderRadius:10, border:'1.5px solid #e5e7eb', fontFamily:sans, fontSize:16, color:'#111', boxSizing:'border-box' }}
                    />
                  </div>
                </div>

                {/* Quick amount buttons */}
                <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                  {[total, Math.ceil(total/10)*10, Math.ceil(total/50)*50, Math.ceil(total/100)*100].filter((v,i,a)=>a.indexOf(v)===i).map(amt => (
                    <button key={amt} onClick={() => setReceived(amt.toFixed(2))}
                      style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #e5e7eb', background:'#f9fafb', fontFamily:sans, fontSize:12, color:'#374151', cursor:'pointer', fontWeight:500 }}>
                      {sym}{amt.toFixed(0)}
                    </button>
                  ))}
                </div>

                {/* Change display */}
                <div style={{ padding:'10px 14px', borderRadius:10, background: change > 0 ? '#f0fdf4' : '#f9fafb', border:`1px solid ${change > 0 ? '#bbf7d0' : '#e5e7eb'}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontFamily:sans, fontSize:13, fontWeight:600, color:'#374151' }}>
                    {change > 0 ? 'Change to return' : 'Change'}
                  </span>
                  <span style={{ fontFamily:sans, fontSize:20, fontWeight:800, color: change > 0 ? '#16a34a' : '#9ca3af' }}>
                    {sym}{change.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIONS ── */}
        <div className="no-print flex-shrink-0" style={{ padding:'10px 12px 12px', background:'#fff', borderTop:'1px solid #e5e7eb' }}>
          <button onClick={handleMarkPaid} disabled={paying}
            style={{ width:'100%', padding:'12px', borderRadius:10, border:'none', background: paying ? '#9ca3af' : '#10b981', color:'#fff', fontWeight:700, fontSize:15, cursor: paying ? 'not-allowed' : 'pointer', fontFamily:sans, marginBottom:8 }}>
            {paying ? 'Processing…' : `Mark Paid · ${sym}${total.toFixed(2)}`}
          </button>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => window.print()} style={{ flex:1, padding:'9px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontWeight:500, fontSize:13, cursor:'pointer', fontFamily:sans }}>Print</button>
            <button onClick={onClose} style={{ flex:1, padding:'9px', borderRadius:8, border:'1px solid #e5e7eb', background:'#fff', color:'#374151', fontWeight:500, fontSize:13, cursor:'pointer', fontFamily:sans }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}