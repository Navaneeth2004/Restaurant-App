/**
 * views/reports/ReprintBill.tsx
 *
 * Full-screen bill preview / print modal used from order history.
 * Extracted from ReportsView.tsx.
 *
 * FIX: this is rendered from deep inside the Reports tab's own scrolling
 * container (ReportsView -> HistoryTab -> SessionRow -> ReprintBill). On
 * mobile, `position: fixed` is supposed to anchor to the viewport, but if
 * the ReportsView only renders `flex flex-col h-full` and the History tab
 * scroll container introduces its own block formatting context, some mobile
 * browsers (and especially when content above adds a transform/overflow
 * ancestor) end up confining the "fixed" modal's perceived 100% width/height
 * to that scroll container's content box instead of the visual viewport —
 * which is exactly the "summary panel covers most of the bill" look in the
 * report. Portaling straight to document.body guarantees the modal escapes
 * every ancestor and always covers the true viewport, matching how
 * AdminBackup's FactoryResetModal already solves this same class of bug.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { useSettings } from '../../context/SettingsContext';
import type { TableSession } from '../../utils/sessions';

const API_ORIGIN = process.env.REACT_APP_API_URL || window.location.origin;

interface Props {
  session: TableSession;
  onClose: () => void;
}

export default function ReprintBill({ session, onClose }: Props) {
  const settings = useSettings();
  const sym      = settings.currency_symbol || '₹';
  const taxPct   = parseFloat(settings.tax_percent || '5') / 100;
  const brand    = (settings.brand_color as string) || '#f97316';
  const logoUrl  = (settings as any).logo_url as string | undefined;
  const sans     = 'system-ui, -apple-system, sans-serif';

  const subtotal = session.allItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax      = subtotal * taxPct;
  const total    = subtotal + tax;
  const date     = new Date(session.startedAt);
  const dateStr  = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr  = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex flex-col h-full md:items-center md:justify-center md:p-3">
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          * { -webkit-print-color-adjust: economy !important; print-color-adjust: economy !important; }
          body * { visibility: hidden !important; }
          .bill-print-area, .bill-print-area * { visibility: visible !important; }
          .bill-print-area {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100% !important; max-width: 100% !important;
            border-radius: 0 !important; box-shadow: none !important;
            max-height: none !important; overflow: visible !important;
            background: #ffffff !important; padding: 4mm 4mm 6mm !important;
          }
          .bill-scroll { overflow: visible !important; max-height: none !important; }
          .no-print { display: none !important; }
          .bill-header { background: #ffffff !important; background-color: #ffffff !important; background-image: none !important; padding: 8px 0 10px !important; }
          .bill-header * { color: #111111 !important; background: transparent !important; }
          .bill-print-area div, .bill-print-area span, .bill-print-area p { color: #111111 !important; }
          body { background: white !important; }
        }
      `}</style>

       <div className="bill-print-area flex flex-col bg-white w-full flex-1 min-h-0 md:flex-none md:h-auto md:max-w-[320px] md:rounded-2xl md:max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bill-header flex-shrink-0" style={{ background: brand, padding: '16px 20px 14px', textAlign: 'center' }}>
          {logoUrl && (
            <img src={`${API_ORIGIN}${logoUrl}`} alt="logo"
              style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', marginBottom: 8, display: 'inline-block' }} />
          )}
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', fontFamily: sans }}>
            {settings.restaurant_name || 'Restaurant'}
          </div>
          {settings.address && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontFamily: sans }}>{settings.address}</div>
          )}
          {(settings as any).phone && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: sans }}>{(settings as any).phone}</div>
          )}
          <div style={{ display: 'inline-block', marginTop: 7, background: 'rgba(0,0,0,0.18)', borderRadius: 20, padding: '2px 10px', fontSize: 11, color: '#fff', fontFamily: sans }}>
            {dateStr} · {timeStr}
          </div>
        </div>

        {/* Items */}
        <div className="bill-scroll flex-1 overflow-y-auto" style={{ padding: '14px 18px', background: '#fff' }}>
          <div style={{ borderTop: '1px dashed #e5e5e5', margin: '6px 0' }} />
          <div style={{ margin: '10px 0' }}>
            {session.allItems.map((item, i) => (
              <div key={i} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#111' }}>
                  <span style={{ flex: 1, paddingRight: 8, fontFamily: sans, fontWeight: 600 }}>
                    <span style={{ color: brand, fontWeight: 700 }}>{item.quantity}×</span> {item.name}
                  </span>
                  <span style={{ whiteSpace: 'nowrap', fontFamily: sans, fontWeight: 600 }}>
                    {sym}{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#bbb', paddingLeft: 2, fontFamily: sans }}>
                  @ {sym}{item.price.toFixed(2)} each
                </div>
                {item.note && (
                  <div style={{ fontSize: 11, color: '#888', paddingLeft: 2, fontStyle: 'italic', fontFamily: sans }}>↳ {item.note}</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px dashed #e5e5e5', margin: '6px 0' }} />
          <div style={{ margin: '8px 0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: '#666', fontFamily: sans }}>
              <span>Subtotal</span><span>{sym}{subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, color: '#666', fontFamily: sans }}>
              <span>Tax ({settings.tax_percent || 5}%)</span><span>{sym}{tax.toFixed(2)}</span>
            </div>
          </div>
          <div style={{ borderTop: '1px dashed #e5e5e5', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0 4px', fontFamily: sans }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#111' }}>TOTAL</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: brand }}>{sym}{total.toFixed(2)}</span>
          </div>
          <div style={{ borderTop: '1px dashed #e5e5e5', margin: '6px 0' }} />
          {settings.bill_footer && (
            <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', margin: '10px 0 4px', fontFamily: sans, fontStyle: 'italic' }}>
              {settings.bill_footer}
            </div>
          )}
          <div style={{ textAlign: 'center', fontSize: 9, color: '#e0e0e0', letterSpacing: 4, marginTop: 6 }}>
            |||||  ||||||  |||||  ||||||  ||||
          </div>
        </div>

        {/* Actions */}
        <div className="no-print flex-shrink-0" style={{ padding: '12px 16px 16px', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.print()} style={{
              flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb',
              background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: sans,
            }}>
              Print Bill
            </button>
            <button onClick={onClose} style={{
              flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb',
              background: '#fff', color: '#374151', fontWeight: 500, fontSize: 13, cursor: 'pointer', fontFamily: sans,
            }}>
              Close
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 10, color: '#ccc', margin: '6px 0 0', fontFamily: sans }}>
            For thermal printer: set paper size to <strong>80mm</strong>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}