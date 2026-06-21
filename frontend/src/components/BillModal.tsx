import React, { useState } from 'react';
import { useSettings }          from '../context/SettingsContext';
import { closeOrderWithPayment, directBillOrder } from '../services/api';
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
  cartItems?: { menu_item_id: number; name: string; price: number; quantity: number; note: string }[];
}

export default function BillModal({ orders, orderId, table, onClose, onClosed, isHistory = false, cartItems = [] }: Props) {
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

  // Merge cart items
  for (const item of cartItems) {
    const key = `${item.name}||${item.note || ''}||${item.price}`;
    const ex  = itemMap.get(key);
    if (ex) { ex.quantity += item.quantity; }
    else { itemMap.set(key, { name: item.name, price: item.price, quantity: item.quantity, note: item.note || '' }); }
  }

  const allItems = Array.from(itemMap.values());
  const subtotal = allItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax      = subtotal * taxPct;
  const total    = subtotal + tax;

  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const tableLabel = table?.label || `Table ${orders[0]?.table_id}`;

  const [activeTab,      setActiveTab]      = useState<'bill' | 'payment'>('bill');
  const [paymentVisited, setPaymentVisited] = useState(false);
  const [orderType,      setOrderType]      = useState<'dine_in' | 'parcel'>('dine_in');
  const [payMethod,      setPayMethod]      = useState('cash');
  const [received,       setReceived]       = useState('');
  const [splits,         setSplits]         = useState<SplitEntry[]>([
    { method: 'cash', amount: '' }, { method: 'upi', amount: '' },
  ]);
  const [customerName,  setCustomerName]  = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paying,        setPaying]        = useState(false);

  const [showPaymentWarn, setShowPaymentWarn] = useState(false);
  const [warnModal,       setWarnModal]       = useState(false);

  const splitTotal   = splits.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const splitBalance = total - splitTotal;

  const receivedNum = parseFloat(received) || 0;
  const amountPaid  = payMethod === 'split' ? splitTotal : (received ? receivedNum : total);

  const switchToPayment = () => { setActiveTab('payment'); setPaymentVisited(true); };

  const executePay = async () => {
    setPaying(true);
    setWarnModal(false);
    setShowPaymentWarn(false);
    try {
      // Commit unsent cart items as a direct-bill order first
      let closeId = orderId;
      if (cartItems.length > 0 && table) {
        const newOrder = await directBillOrder({ table_id: table.id, items: cartItems });
        // If there were no prior orders, use this new order's id to close
        if (orderId === 'cart-only') closeId = newOrder.id;
      }

      let paymentDetails: any = null;
      let changeAmt = 0;
      if (payMethod === 'split') {
        paymentDetails = splits
          .filter(s => parseFloat(s.amount) > 0)
          .map(s => ({ method: s.method, amount: parseFloat(s.amount) }));
      } else {
        changeAmt = payMethod === 'cash' ? Math.max(0, receivedNum - total) : 0;
        if (received) paymentDetails = { received: receivedNum, change: changeAmt };
      }
      await closeOrderWithPayment(closeId, {
        payment_method:  payMethod,
        payment_details: paymentDetails,
        change_amount:   changeAmt,
        customer_name:   customerName.trim()  || undefined,
        customer_phone:  customerPhone.trim() || undefined,
        amount_paid:     amountPaid,
        order_type:      orderType,
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
    } else {
      const diff = total - amountPaid;
      if (diff > total * WARN_THRESHOLD_PCT || diff > WARN_THRESHOLD_ABS) {
        if (diff > 0) { setWarnModal(true); return; }
      }
    }
    await executePay();
  };

  const warnDiff = payMethod === 'split' ? splitBalance : (total - amountPaid);

  return (
    <>
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

      {warnModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => setWarnModal(false)}>
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 w-full max-w-sm animate-slide-up shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white text-base mb-2">Large Payment Difference</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-5">
              {payMethod === 'split'
                ? <>The split total ({sym}{splitTotal.toFixed(2)}) is {sym}{Math.abs(warnDiff).toFixed(2)} less than the bill ({sym}{total.toFixed(2)}). Proceed?</>
                : <>The amount paid ({sym}{amountPaid.toFixed(2)}) is {sym}{Math.abs(warnDiff).toFixed(2)} less than the bill ({sym}{total.toFixed(2)}). This will be recorded and shown in History. Proceed?</>
              }
            </p>
            <div className="flex gap-3">
              <button className="btn flex-1" onClick={() => setWarnModal(false)}>Go Back</button>
              <button className="btn flex-1 btn-danger" onClick={executePay}>Mark Paid Anyway</button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col md:items-center md:justify-center md:p-4 overflow-hidden">
        <div className="bill-print-area flex flex-col bg-white w-full h-full md:h-auto md:max-w-sm md:rounded-2xl overflow-hidden shadow-2xl md:max-h-[92vh]">
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
          {!isHistory && activeTab === 'payment' && (
            <PaymentTab
              brand={brand}
              sym={sym}
              total={total}
              tableLabel={tableLabel}
              itemCount={allItems.reduce((s, i) => s + i.quantity, 0)}
              orderType={orderType}
              setOrderType={setOrderType}
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
                    Mark Paid &nbsp;·&nbsp; {sym}{amountPaid.toFixed(2)}
                  </>
                )}
              </button>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.print()}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: sans, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
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