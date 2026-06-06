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
      const existing = itemMap.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        itemMap.set(key, { name: item.name, price: item.price, quantity: item.quantity, note: item.note || '' });
      }
    }
  }
  const allItems = Array.from(itemMap.values());

  const subtotal  = allItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax       = subtotal * taxPct;
  const total     = subtotal + tax;
  const now       = new Date();
  const dateStr   = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr   = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const handleMarkPaid = async () => {
    try {
      await closeOrder(orderId);
      toast('Table cleared — enjoy!', 'success');
      onClosed();
    } catch {
      toast('Failed to close order', 'error');
    }
  };

  const sans = 'system-ui, -apple-system, sans-serif';

  return (
    <div
      className="bill-modal-overlay fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3"
      onClick={onClose}
    >
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body * { visibility: hidden !important; }
          .bill-print-area, .bill-print-area * { visibility: visible !important; }
          .bill-print-area {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 72mm !important; max-width: 72mm !important;
            border-radius: 0 !important; box-shadow: none !important;
            max-height: none !important; overflow: visible !important;
          }
          .bill-scroll { overflow: visible !important; max-height: none !important; }
          .no-print { display: none !important; }
          .bill-header {
            background: #fff !important;
            color: #111 !important;
          }
          .bill-header * {
            color: #111 !important;
            background: transparent !important;
          }
        }
      `}</style>

      {/* Outer shell — fixed height with flex column so header+footer are sticky */}
      <div
        className="bill-print-area flex flex-col bg-white w-full max-w-[320px] rounded-2xl overflow-hidden shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── HEADER (fixed, never scrolls) ── */}
        <div
          className="bill-header flex-shrink-0"
          style={{ background: brand, padding: '16px 20px 14px', textAlign: 'center' }}
        >
          {logoUrl && (
            <img
              src={`${API_BASE}${logoUrl}`}
              alt="logo"
              style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', marginBottom: 8, display: 'inline-block' }}
            />
          )}
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', fontFamily: sans, letterSpacing: 0.2 }}>
            {settings.restaurant_name || 'Restaurant'}
          </div>
          {settings.address && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontFamily: sans }}>{settings.address}</div>
          )}
          {(settings as any).phone && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: sans }}>{(settings as any).phone}</div>
          )}
          <div style={{
            display: 'inline-block', marginTop: 7,
            background: 'rgba(0,0,0,0.18)', borderRadius: 20,
            padding: '2px 10px', fontSize: 11, color: '#fff', fontFamily: sans,
          }}>
            {dateStr} · {timeStr}
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div
          className="bill-scroll flex-1 overflow-y-auto"
          style={{ padding: '14px 18px', background: '#fff' }}
        >
          {/* Table row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 14, color: '#111' }}>
              {table?.label || `Table ${orders[0]?.table_id}`}
            </span>
            <span style={{ fontFamily: sans, fontSize: 11, color: '#999' }}>
              {allItems.reduce((s, i) => s + i.quantity, 0)} items
            </span>
          </div>

          <Dash />

          {/* Items list */}
          <div style={{ margin: '10px 0' }}>
            {allItems.map((item, i) => (
              <div key={i} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#111' }}>
                  <span style={{ flex: 1, paddingRight: 8, fontFamily: sans, fontWeight: 600 }}>
                    <span style={{ color: brand, fontWeight: 700 }}>{item.quantity}×</span> {item.name}
                  </span>
                  <span style={{ whiteSpace: 'nowrap', fontFamily: sans, fontWeight: 600, color: '#111' }}>
                    {sym}{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#bbb', paddingLeft: 2, fontFamily: sans }}>
                  @ {sym}{item.price.toFixed(2)} each
                </div>
                {item.note && (
                  <div style={{ fontSize: 11, color: '#888', paddingLeft: 2, fontStyle: 'italic', fontFamily: sans }}>
                    ↳ {item.note}
                  </div>
                )}
              </div>
            ))}
          </div>

          <Dash />

          {/* Subtotal + tax */}
          <div style={{ margin: '8px 0 4px' }}>
            <Row label="Subtotal" value={`${sym}${subtotal.toFixed(2)}`} sans={sans} />
            <Row label={`Tax (${settings.tax_percent || 5}%)`} value={`${sym}${tax.toFixed(2)}`} sans={sans} />
          </div>

          <Dash />

          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0 4px', fontFamily: sans }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>TOTAL</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: brand }}>{sym}{total.toFixed(2)}</span>
          </div>

          <Dash />

          {settings.bill_footer && (
            <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', margin: '10px 0 4px', fontFamily: sans, fontStyle: 'italic' }}>
              {settings.bill_footer}
            </div>
          )}

          <div style={{ textAlign: 'center', fontSize: 9, color: '#e0e0e0', letterSpacing: 4, marginTop: 6 }}>
            |||||  ||||||  |||||  ||||||  ||||
          </div>
        </div>

        {/* ── ACTIONS (fixed at bottom, never scrolls) ── */}
        <div className="no-print flex-shrink-0" style={{ padding: '12px 16px 16px', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
          <button
            onClick={handleMarkPaid}
            style={{
              width: '100%', padding: '12px', borderRadius: 12, border: 'none',
              background: '#10b981', color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', fontFamily: sans, marginBottom: 8,
            }}
          >
            ✓  Mark Paid &amp; Clear Table
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.print()} style={{
              flex: 1, padding: '9px', borderRadius: 10, border: '1px solid #e5e7eb',
              background: '#fff', color: '#374151', fontWeight: 500, fontSize: 13,
              cursor: 'pointer', fontFamily: sans,
            }}>
              🖨️ Print
            </button>
            <button onClick={onClose} style={{
              flex: 1, padding: '9px', borderRadius: 10, border: '1px solid #e5e7eb',
              background: '#fff', color: '#374151', fontWeight: 500, fontSize: 13,
              cursor: 'pointer', fontFamily: sans,
            }}>
              Close
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 10, color: '#ccc', margin: '6px 0 0', fontFamily: sans }}>
            For thermal printer: set paper size to <strong>80mm</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

function Dash() {
  return <div style={{ borderTop: '1px dashed #e5e5e5', margin: '6px 0' }} />;
}

function Row({ label, value, sans }: { label: string; value: string; sans: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: '#666', fontFamily: sans }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}