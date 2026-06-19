/**
 * components/bill/BillItems.tsx
 *
 * Scrollable item list with per-item price, subtotal, tax, total, and bill footer.
 */

import React from 'react';

const sans = 'system-ui,-apple-system,sans-serif';

interface Item {
  name:     string;
  price:    number;
  quantity: number;
  note:     string;
}

interface Props {
  items:      Item[];
  subtotal:   number;
  tax:        number;
  total:      number;
  sym:        string;
  brand:      string;
  taxPercent: string | number;
  billFooter?: string;
}

export default function BillItems({
  items,
  subtotal,
  tax,
  total,
  sym,
  brand,
  taxPercent,
  billFooter,
}: Props) {
  return (
    <div className="bill-scroll flex-1 overflow-y-auto" style={{ background: '#fff' }}>
      <div style={{ padding: '14px 18px 0' }}>
        <div style={{ borderTop: '1.5px dashed #e5e5e5', marginBottom: 10 }} />
        {items.map((item, i) => (
          <div
            key={i}
            style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
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

      <div style={{ padding: '0 18px 14px' }}>
        <div style={{ borderTop: '1.5px dashed #e5e5e5', margin: '4px 0 10px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5, color: '#888', fontFamily: sans }}>
          <span>Subtotal</span>
          <span style={{ fontWeight: 600 }}>{sym}{subtotal.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: '#888', fontFamily: sans }}>
          <span>Tax ({taxPercent}%)</span>
          <span style={{ fontWeight: 600 }}>{sym}{tax.toFixed(2)}</span>
        </div>

        <div style={{ borderTop: '1.5px dashed #e5e5e5', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#111', fontFamily: sans }}>TOTAL</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: brand, fontFamily: sans }}>
            {sym}{total.toFixed(2)}
          </span>
        </div>

        {billFooter && (
          <>
            <div style={{ borderTop: '1.5px dashed #e5e5e5', margin: '10px 0 6px' }} />
            <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', fontStyle: 'italic', fontFamily: sans }}>
              {billFooter}
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', fontSize: 9, color: '#e0e0e0', letterSpacing: 4, marginTop: 8 }}>
          |||||  ||||||  |||||  ||||||  ||||
        </div>
      </div>
    </div>
  );
}