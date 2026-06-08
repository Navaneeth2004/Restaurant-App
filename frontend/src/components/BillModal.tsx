import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { closeOrder } from '../services/api';
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

export default function BillModal({ orders, orderId, table, onClose, onClosed }: Props) {
  const settings = useSettings();
  const toast    = useToast();
  const sym      = settings.currency_symbol || '₹';
  const taxPct   = parseFloat(settings.tax_percent || '5') / 100;
  const brand    = (settings.brand_color as string) || '#f97316';
  const logoUrl  = (settings as any).logo_url as string | undefined;

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
  const now      = new Date();
  const dateStr  = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr  = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const handleMarkPaid = async () => {
    try { await closeOrder(orderId); toast('Table cleared!', 'success'); onClosed(); }
    catch { toast('Failed to close order', 'error'); }
  };

  const sans = 'system-ui, -apple-system, sans-serif';

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
          .bill-header { background: #fff !important; color: #111 !important; }
          .bill-header * { color: #111 !important; background: transparent !important; }
        }
      `}</style>

      <div
        className="bill-print-area flex flex-col bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl"
        style={{ height: 'min(88dvh, 88vh)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER — compact, fixed */}
        <div
          className="bill-header flex-shrink-0"
          style={{ background: brand, padding: '10px 16px 10px', textAlign: 'center' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {logoUrl && (
              <img src={`${API_BASE}${logoUrl}`} alt="logo"
                style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: sans, lineHeight: 1.2 }}>
                {settings.restaurant_name || 'Restaurant'}
              </div>
              {settings.address && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontFamily: sans, lineHeight: 1.2 }}>{settings.address}</div>
              )}
            </div>
          </div>
          <div style={{
            display: 'inline-block', marginTop: 6,
            background: 'rgba(0,0,0,0.2)', borderRadius: 20,
            padding: '2px 10px', fontSize: 11, color: '#fff', fontFamily: sans,
          }}>
            {table?.label || `Table ${orders[0]?.table_id}`} · {dateStr} · {timeStr}
          </div>
        </div>

        {/* SCROLLABLE ITEMS */}
        <div className="bill-scroll flex-1 overflow-y-auto" style={{ padding: '10px 14px', background: '#fff' }}>
          <div style={{ borderTop: '1px dashed #e5e5e5', margin: '0 0 8px' }} />

          {allItems.map((item, i) => (
            <div key={i} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#111' }}>
                <span style={{ flex: 1, paddingRight: 8, fontFamily: sans, fontWeight: 600 }}>
                  <span style={{ color: brand, fontWeight: 700 }}>{item.quantity}×</span> {item.name}
                </span>
                <span style={{ whiteSpace: 'nowrap', fontFamily: sans, fontWeight: 600 }}>
                  {sym}{(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#bbb', paddingLeft: 2, fontFamily: sans }}>
                @ {sym}{item.price.toFixed(2)} each
              </div>
              {item.note && (
                <div style={{ fontSize: 10, color: '#888', paddingLeft: 2, fontStyle: 'italic', fontFamily: sans }}>↳ {item.note}</div>
              )}
            </div>
          ))}

          <div style={{ borderTop: '1px dashed #e5e5e5', margin: '6px 0 4px' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3, color: '#666', fontFamily: sans }}>
            <span>Subtotal</span><span>{sym}{subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3, color: '#666', fontFamily: sans }}>
            <span>Tax ({settings.tax_percent || 5}%)</span><span>{sym}{tax.toFixed(2)}</span>
          </div>

          <div style={{ borderTop: '1px dashed #e5e5e5', margin: '4px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0 4px', fontFamily: sans }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>TOTAL</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: brand }}>{sym}{total.toFixed(2)}</span>
          </div>

          {settings.bill_footer && (
            <>
              <div style={{ borderTop: '1px dashed #e5e5e5', margin: '4px 0' }} />
              <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', margin: '6px 0 2px', fontFamily: sans, fontStyle: 'italic' }}>
                {settings.bill_footer}
              </div>
            </>
          )}
        </div>

        {/* ACTIONS — fixed at bottom, always visible */}
        <div className="no-print flex-shrink-0"
          style={{ padding: '10px 12px 12px', background: '#fff', borderTop: '1px solid #e5e7eb' }}>
          <button onClick={handleMarkPaid} style={{
            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
            background: '#10b981', color: '#fff', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', fontFamily: sans, marginBottom: 8,
          }}>
            Mark Paid &amp; Clear Table
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.print()} style={{
              flex: 1, padding: '9px', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', color: '#374151', fontWeight: 500, fontSize: 13,
              cursor: 'pointer', fontFamily: sans,
            }}>Print</button>
            <button onClick={onClose} style={{
              flex: 1, padding: '9px', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', color: '#374151', fontWeight: 500, fontSize: 13,
              cursor: 'pointer', fontFamily: sans,
            }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}