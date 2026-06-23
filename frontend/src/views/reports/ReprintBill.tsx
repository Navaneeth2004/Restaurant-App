/**
 * views/reports/ReprintBill.tsx
 *
 * Redesigned to match BillModal (waiter side) exactly:
 * - Same header (BillHeader component)
 * - Same items table (BillItems component)
 * - Same footer buttons
 * - Portaled to document.body to escape scroll containers
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { useSettings } from '../../context/SettingsContext';
import BillHeader from '../../components/bill/BillHeader';
import BillItems  from '../../components/bill/BillItems';
import type { TableSession } from '../../utils/sessions';

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

  const subtotal = session.allItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax      = subtotal * taxPct;
  const total    = subtotal + tax;

  const date    = new Date(session.startedAt);
  const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const tableLabel = `Table ${session.tableId}`;

  // Resolve payment details for display
  let paymentDetails = session.paymentDetails;
  if (typeof paymentDetails === 'string') {
    try { paymentDetails = JSON.parse(paymentDetails); } catch { paymentDetails = null; }
  }

  const customerGstin = (session as any).customerGstin as string | undefined;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex flex-col md:items-center md:justify-center md:p-4 overflow-hidden"
      onClick={onClose}
    >
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

      <div
        className="bill-print-area flex flex-col bg-white w-full h-full md:h-auto md:max-w-sm md:rounded-2xl overflow-hidden shadow-2xl md:max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header — identical to BillModal */}
        <BillHeader
          restaurantName={settings.restaurant_name}
          address={(settings as any).address}
          phone={(settings as any).phone}
          logoUrl={logoUrl}
          brand={brand}
          tableLabel={tableLabel}
          dateStr={dateStr}
          timeStr={timeStr}
        />

        {/* Items — identical to BillModal */}
        <div className="bill-scroll flex-1 overflow-y-auto">
          <BillItems
            items={session.allItems}
            subtotal={subtotal}
            tax={tax}
            total={total}
            sym={sym}
            brand={brand}
            taxPercent={settings.tax_percent || 5}
            billFooter={(settings as any).bill_footer}
            customerGstin={customerGstin}
            customerName={session.customerName || undefined}
            customerPhone={session.customerPhone || undefined}
          />
        </div>

        {/* Footer — identical to BillModal */}
        <div
          className="no-print flex-shrink-0"
          style={{ padding: '12px 16px 16px', background: '#fff', borderTop: '1.5px solid #f3f4f6' }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => window.print()}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                border: '1.5px solid #e5e7eb', background: '#fff',
                color: '#374151', fontWeight: 600, fontSize: 13,
                cursor: 'pointer', fontFamily: 'system-ui,-apple-system,sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
              </svg>
              Print Bill
            </button>
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '10px', borderRadius: 10,
                border: '1.5px solid #e5e7eb', background: '#fff',
                color: '#374151', fontWeight: 500, fontSize: 13,
                cursor: 'pointer', fontFamily: 'system-ui,-apple-system,sans-serif',
              }}
            >
              Close
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 10, color: '#ccc', margin: '6px 0 0', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
            For thermal printer: set paper size to <strong>80mm</strong>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}