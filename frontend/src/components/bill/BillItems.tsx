/**
 * components/bill/BillItems.tsx
 * Bill items list + totals section.
 * Shows customer GSTIN on the printed bill when present (B2B invoice).
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
  items:          Item[];
  subtotal:       number;
  tax:            number;
  total:          number;
  sym:            string;
  brand:          string;
  taxPercent:     string | number;
  billFooter?:    string;
  customerGstin?: string;  // shown on bill for B2B invoices
  customerName?:  string;
  customerPhone?: string;
}

export default function BillItems({
  items, subtotal, tax, total,
  sym, brand, taxPercent, billFooter,
  customerGstin, customerName, customerPhone,
}: Props) {
  return (
    <div
      className="bill-items-area flex-1 overflow-y-auto"
      style={{ padding: '0 18px 16px', background: '#fff' }}
    >
      {/* Customer GSTIN — shown on bill only for B2B invoices */}
      {customerGstin && (
        <div style={{
          margin: '8px 0 12px',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1.5px solid #e0e7ff',
          background: '#eef2ff',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6366f1', marginBottom: 3, fontFamily: sans }}>
            B2B Tax Invoice
          </div>
          <div style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: '#312e81', fontWeight: 700, letterSpacing: '0.05em' }}>
            GSTIN: {customerGstin}
          </div>
          {customerName && (
            <div style={{ fontSize: 11, fontFamily: sans, color: '#4338ca', marginTop: 1 }}>
              {customerName}{customerPhone ? ` · ${customerPhone}` : ''}
            </div>
          )}
        </div>
      )}

      {/* Items list */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: sans }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #f3f4f6' }}>
            <th style={{ textAlign: 'left', padding: '8px 0 6px', color: '#9ca3af', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Item
            </th>
            <th style={{ textAlign: 'center', padding: '8px 0 6px', color: '#9ca3af', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', width: 36 }}>
              Qty
            </th>
            <th style={{ textAlign: 'right', padding: '8px 0 6px 4px', color: '#9ca3af', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Price
            </th>
            <th style={{ textAlign: 'right', padding: '8px 0 6px', color: '#9ca3af', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
              <td style={{ padding: '7px 6px 7px 0', verticalAlign: 'top' }}>
                <div style={{ color: '#111827', fontWeight: 500 }}>{item.name}</div>
                {item.note && (
                  <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 1, fontStyle: 'italic' }}>
                    {item.note}
                  </div>
                )}
              </td>
              <td style={{ padding: '7px 4px', textAlign: 'center', color: '#6b7280', fontWeight: 500, verticalAlign: 'top' }}>
                {item.quantity}
              </td>
              <td style={{ padding: '7px 4px', textAlign: 'right', color: '#6b7280', verticalAlign: 'top' }}>
                {sym}{item.price.toFixed(2)}
              </td>
              <td style={{ padding: '7px 0 7px 4px', textAlign: 'right', color: '#111827', fontWeight: 600, verticalAlign: 'top' }}>
                {sym}{(item.price * item.quantity).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ borderTop: '1.5px solid #f3f4f6', marginTop: 4, paddingTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontFamily: sans }}>
          <span style={{ color: '#6b7280', fontSize: 13 }}>Subtotal</span>
          <span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>{sym}{subtotal.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontFamily: sans }}>
          <span style={{ color: '#6b7280', fontSize: 13 }}>
            GST ({taxPercent}%)
            {customerGstin && (
              <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>
                CGST {Number(taxPercent) / 2}% + SGST {Number(taxPercent) / 2}%
              </span>
            )}
          </span>
          <span style={{ color: '#374151', fontSize: 13, fontWeight: 500 }}>{sym}{tax.toFixed(2)}</span>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 12px', marginTop: 8,
          borderRadius: 10, background: brand + '12',
          border: `1.5px solid ${brand}30`,
          fontFamily: sans,
        }}>
          <span style={{ color: brand, fontWeight: 700, fontSize: 15 }}>Total</span>
          <span style={{ color: brand, fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px' }}>
            {sym}{total.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Bill footer */}
      {billFooter && (
        <p style={{
          textAlign: 'center', color: '#9ca3af', fontSize: 11,
          marginTop: 16, fontFamily: sans, lineHeight: 1.5,
          padding: '10px 0', borderTop: '1px dashed #e5e7eb',
        }}>
          {billFooter}
        </p>
      )}

      {/* B2B note for GST */}
      {customerGstin && (
        <p style={{
          textAlign: 'center', color: '#a5b4fc', fontSize: 9,
          marginTop: 8, fontFamily: sans, letterSpacing: '0.02em',
        }}>
          Tax Invoice issued under GST · SAC applicable
        </p>
      )}
    </div>
  );
}