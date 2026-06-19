import React, { useState } from 'react';
import { useSettings }          from '../context/SettingsContext';
import { closeOrderWithPayment } from '../services/api';
import { useToast }              from '../context/ToastContext';
import BillHeader  from './bill/BillHeader';
import BillItems   from './bill/BillItems';
import PaymentTab, {
  SplitEntry,
  WARN_THRESHOLD_PCT,
  WARN_THRESHOLD_ABS,
} from './bill/PaymentTab';
import type { Order, Table } from '../types';

const API_BASE = process.env.REACT_APP_API_URL || window.location.origin;
const sans = 'system-ui,-apple-system,sans-serif';

interface Props {
  orders:     Order[];
  orderId:    string;
  table:      Table | null;
  onClose:    () => void;
  onClosed:   () => void;
  isHistory?: boolean;
}

export default function BillModal({ orders, orderId, table, onClose, onClosed, isHistory = false }: Props) {
  const settings = useSettings();
  const toast    = useToast();
  const sym      = settings.currency_symbol || '₹';
  const taxPct   = parseFloat(settings.tax_percent || '5') / 100;
  const brand    = (settings.brand_color as string) || '#f97316';
  const logoUrl  = (settings as any).logo_url as string | undefined;

  // Merge items from all orders in this session
  const itemMap = new Map<string, { name: string; price: number; quantity: number; note: string }>();
  for (const order of orders) {
    for (const item of order.items) {
      const key = `${item.name}||${item.note || ''}||${item.price}`;
      const ex  = itemMap.get(key);
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
  const tableLabel = table?.label || `Table ${orders[0]?.table_id}`;

  // Tab + payment state
  const [activeTab,      setActiveTab]      = useState<'bill' | 'payment'>('bill');
  const [paymentVisited, setPaymentVisited] = useState(false);
  const [payMethod,      setPayMethod]      = useState('cash');
  const [received,       setReceived]       = useState('');
  const [splits,         setSplits]         = useState<SplitEntry[]>([
    { method: 'cash', amount: '' }, { method: 'upi', amount: '' },
  ]);
  const [customerName,  setCustomerName]  = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paying,        setPaying]        = useState(false);

  // Warning modal state
  const [showPaymentWarn, setShowPaymentWarn] = useState(false);
  const [warnModal,       setWarnModal]       = useState(false);

  const splitTotal   = splits.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const splitBalance = total - splitTotal;

  const switchToPayment = () => { setActiveTab('payment'); setPaymentVisited(true); };

  const executePay = async () => {
    setPaying(true);
    setWarnModal(false);
    setShowPaymentWarn(false);
    try {
      let paymentDetails: any = null;
      let changeAmt = 0;
      if (payMethod === 'split') {
        paymentDetails = splits
          .filter(s => parseFloat(s.amount) > 0)
          .map(s => ({ method: s.method, amount: parseFloat(s.amount) }));
      } else {
        const receivedNum = parseFloat(received) || 0;
        changeAmt = Math.max(0, receivedNum - total);
        if (received) paymentDetails = { received: receivedNum, change: changeAmt };
      }
      await closeOrderWithPayment(orderId, {
        payment_method:  payMethod,
        payment_details: paymentDetails,
        change_amount:   changeAmt,
        customer_name:   customerName.trim()  || undefined,
        customer_phone:  customerPhone.trim() || undefined,
      } as any);
      toast('Table cleared!', 'success');
      onClosed();
    } catch (err: any) {
      toast(err?.response?.data?.error || 'Failed to close order', 'error');
    } finally {
      setPaying(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!paymentVisited) { setShowPaymentWarn(true); return; }
    if (payMethod === 'split') {
      const diff = Math.abs(splitBalance);
      if ((diff > total * WARN_THRESHOLD_PCT || diff > WARN_THRESHOLD_ABS) && splitBalance > 0) {
        setWarnModal(true);
        return;
      }
    }
    await executePay();
  };

  return (
    <>
      {/* ── Payment not visited warning ── */}
      {showPaymentWarn && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => setShowPaymentWarn(false)}>
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 w-full max-w-sm animate-slide-up shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">No payment method selected</h3>
                <p className="text-zinc-400 text-xs leading-relaxed mt-1">
                  You haven't chosen a payment method yet. Would you like to add payment details, or mark as paid with default (cash)?
                </p>
                <p className="text-zinc-600 text-xs mt-2">
                  You can always update payment details later in the History tab.
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-col">
              <button className="btn btn-brand w-full text-sm"
                onClick={() => { setShowPaymentWarn(false); switchToPayment(); }}>
                Add payment details
              </button>
              <button className="btn w-full text-sm"
                onClick={() => { setShowPaymentWarn(false); executePay(); }}>
                Mark paid (cash)
              </button>
              <button className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors py-1"
                onClick={() => setShowPaymentWarn(false)}>
                Go back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Large split difference warning ── */}
      {warnModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => setWarnModal(false)}>
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 w-full max-w-sm animate-slide-up shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white text-base mb-2">Large Payment Difference</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-5">
              The split total ({sym}{splitTotal.toFixed(2)}) is {sym}{Math.abs(splitBalance).toFixed(2)} less than the bill ({sym}{total.toFixed(2)}). Proceed?
            </p>
            <div className="flex gap-3">
              <button className="btn flex-1" onClick={() => setWarnModal(false)}>Go Back</button>
              <button className="btn flex-1 btn-danger" onClick={executePay}>Mark Paid Anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main modal ── */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col md:items-center md:justify-center md:p-4 overflow-hidden"
        onClick={onClose}>
        <style>{`
          @media print {
            @page { size: 80mm auto; margin: 0; }
            * { -webkit-print-color-adjust: economy !important; print-color-adjust: economy !important; color-adjust: economy !important; }
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
            .bill-header * { color: #111111 !important; background: transparent !important; background-color: transparent !important; background-image: none !important; }
            .bill-header-pill { background: transparent !important; border: 1px solid #aaaaaa !important; color: #444444 !important; }
            .bill-header-pill svg { display: none !important; }
            .bill-print-area div, .bill-print-area span, .bill-print-area p { color: #111111 !important; }
            body { background: white !important; }
          }
        `}</style>

        <div
          className="bill-print-area flex flex-col bg-white w-full h-full md:h-auto md:max-w-sm md:rounded-2xl overflow-hidden shadow-2xl md:max-h-[92vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
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

          {/* Tabs (no-print) */}
          {!isHistory && (
            <div className="no-print flex-shrink-0 flex bg-white border-b border-gray-100">
              {[
                { key: 'bill',    label: 'Bill' },
                { key: 'payment', label: paymentVisited ? 'Payment ✓' : 'Payment' },
              ].map(tab => (
                <button key={tab.key}
                  onClick={() => tab.key === 'payment' ? switchToPayment() : setActiveTab('bill')}
                  style={{
                    flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 700, fontFamily: sans,
                    borderBottom: activeTab === tab.key ? `2.5px solid ${brand}` : '2.5px solid transparent',
                    color: activeTab === tab.key ? brand : '#9ca3af',
                    background: 'white', border: 'none', cursor: 'pointer', letterSpacing: '0.01em',
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Bill tab */}
          {activeTab === 'bill' && (
            <BillItems
              items={allItems}
              subtotal={subtotal}
              tax={tax}
              total={total}
              sym={sym}
              brand={brand}
              taxPercent={settings.tax_percent || 5}
              billFooter={(settings as any).bill_footer}
            />
          )}

          {/* Payment tab */}
          {!isHistory && activeTab === 'payment' && (
            <PaymentTab
              brand={brand}
              sym={sym}
              total={total}
              tableLabel={tableLabel}
              itemCount={allItems.reduce((s, i) => s + i.quantity, 0)}
              payMethod={payMethod}
              setPayMethod={setPayMethod}
              received={received}
              setReceived={setReceived}
              splits={splits}
              setSplits={setSplits}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
            />
          )}

          {/* Action buttons */}
          <div className="no-print flex-shrink-0"
            style={{ padding: '12px 16px 16px', background: '#fff', borderTop: '1.5px solid #f3f4f6' }}>
            {!isHistory && (
              <button onClick={handleMarkPaid} disabled={paying}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12,
                  background: paying ? '#9ca3af' : '#10b981',
                  border: 'none', color: '#fff', fontWeight: 800, fontSize: 15,
                  cursor: paying ? 'not-allowed' : 'pointer', fontFamily: sans,
                  marginBottom: 10, letterSpacing: '0.01em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                {paying ? (
                  <>
                    <span style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                    Processing…
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Mark Paid &nbsp;·&nbsp; {sym}{total.toFixed(2)}
                  </>
                )}
              </button>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.print()}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: sans, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
                Print Bill
              </button>
              <button onClick={onClose}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 500, fontSize: 13, cursor: 'pointer', fontFamily: sans }}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}