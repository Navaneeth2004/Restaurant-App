import React, { useState, useEffect, useCallback } from 'react';
import { getReportToday, getReportHistory, getRevenueChart } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import ExportTab from './reports/ExportTab';
import PaymentEditModal from '../components/PaymentEditModal';
import type { Order, ReportSummary, RevenueDay } from '../types';

const API_ORIGIN = process.env.REACT_APP_API_URL || window.location.origin;
type Section = 'analytics' | 'history' | 'export';

interface TableSession {
  sessionKey: string;
  tableId: string;
  tableLabel?: string;
  orders: Order[];
  totalAmount: number;
  startedAt: string;
  endedAt: string;
  allItems: { name: string; price: number; quantity: number; note: string }[];
  paymentMethod: string | null;
  paymentDetails: any;
  customerName: string | null;
  customerPhone: string | null;
}

/**
 * Groups orders into dining sessions.
 *
 * Key rule: once a table's orders are all 'closed', any subsequent order
 * for that table is ALWAYS a new session — regardless of time gap.
 * This prevents a post-billing dine from being lumped in as "round 2".
 *
 * Within a session, multiple rounds (active/delivered orders that were
 * open simultaneously) are merged together.
 */
function groupOrdersIntoSessions(orders: Order[]): TableSession[] {
  const sorted = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const sessions: TableSession[] = [];
  const sessionMap: Record<string, number> = {}; // session_id -> sessions index

  for (const order of sorted) {
    // Use session_id as the grouping key (one session_id = one customer sitting)
    const sessionId = (order as any).session_id;
    const key = sessionId || `legacy-${order.table_id}`; // fallback for old orders without session_id
    const existingIdx = sessionMap[key];

    if (existingIdx !== undefined) {
      // Merge into existing session
      const existing = sessions[existingIdx];
      existing.orders.push(order);
      existing.endedAt = order.created_at;
      existing.totalAmount += order.items.reduce((s, i) => s + i.price * i.quantity, 0);
      if ((order as any).payment_method) {
        existing.paymentMethod = (order as any).payment_method;
        existing.paymentDetails = (order as any).payment_details;
      }
      if ((order as any).customer_name) existing.customerName = (order as any).customer_name;
      if ((order as any).customer_phone) existing.customerPhone = (order as any).customer_phone;
      for (const item of order.items) {
        const itemKey = `${item.name}||${item.note || ''}||${item.price}`;
        const existingItem = existing.allItems.find(
          x => `${x.name}||${x.note || ''}||${x.price}` === itemKey
        );
        if (existingItem) {
          existingItem.quantity += item.quantity;
        } else {
          existing.allItems.push({ name: item.name, price: item.price, quantity: item.quantity, note: item.note || '' });
        }
      }
      continue;
    }

    // Start a new session
    const allItems = order.items.map(i => ({
      name: i.name, price: i.price, quantity: i.quantity, note: i.note || '',
    }));
    let parsedPayDetails: any = null;
    try {
      if ((order as any).payment_details) {
        parsedPayDetails = typeof (order as any).payment_details === 'string'
          ? JSON.parse((order as any).payment_details)
          : (order as any).payment_details;
      }
    } catch {}
    const session: TableSession = {
      sessionKey: sessionId || `legacy-${order.table_id}`,
      tableId: order.table_id,
      orders: [order],
      totalAmount: order.items.reduce((s, i) => s + i.price * i.quantity, 0),
      startedAt: order.created_at,
      endedAt: order.created_at,
      allItems,
      paymentMethod: (order as any).payment_method || null,
      paymentDetails: parsedPayDetails,
      customerName: (order as any).customer_name || null,
      customerPhone: (order as any).customer_phone || null,
    };
    sessionMap[key] = sessions.length;
    sessions.push(session);
  }

  return sessions.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

// ── Payment method badge ──────────────────────────────────────────────────
function PaymentBadge({ method }: { method: string | null }) {
  if (!method) return null;

  const config: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    cash: {
      label: 'Cash',
      color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)',
      icon: <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>,
    },
    upi: {
      label: 'UPI',
      color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.25)',
      icon: <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3" /></svg>,
    },
    card: {
      label: 'Card',
      color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)',
      icon: <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>,
    },
    cheque: {
      label: 'Cheque',
      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)',
      icon: <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12" /></svg>,
    },
    split: {
      label: 'Split',
      color: '#a855f7', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.25)',
      icon: <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>,
    },
  };

  const c = config[method.toLowerCase()] || {
    label: method.charAt(0).toUpperCase() + method.slice(1),
    color: '#71717a', bg: 'rgba(113,113,122,0.1)', border: 'rgba(113,113,122,0.25)',
    icon: null,
  };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 99,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.color, fontSize: 10, fontWeight: 700,
    }}>
      {c.icon}
      {c.label}
    </span>
  );
}

// ── Inline Bill Print Component ───────────────────────────────────────────
interface ReprintBillProps {
  session: TableSession;
  onClose: () => void;
}

function ReprintBill({ session, onClose }: ReprintBillProps) {
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

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3"
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
          .bill-header { background: #fff !important; color: #111 !important; }
          .bill-header * { color: #111 !important; background: transparent !important; }
        }
      `}</style>

      <div
        className="bill-print-area flex flex-col bg-white w-full max-w-[320px] rounded-2xl overflow-hidden shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
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

        <div className="no-print flex-shrink-0" style={{ padding: '12px 16px 16px', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.print()} style={{
              flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb',
              background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13,
              cursor: 'pointer', fontFamily: sans,
            }}>
              Print Bill
            </button>
            <button onClick={onClose} style={{
              flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb',
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

// ── Session row component ─────────────────────────────────────────────────
function SessionRow({ session, sym, taxPct, brand }: {
  session: TableSession;
  sym: string;
  taxPct: number;
  brand: string;
}) {
  const [expanded,        setExpanded]        = useState(false);
  const [showBill,        setShowBill]        = useState(false);
  const [showPaymentEdit, setShowPaymentEdit] = useState(false);
  const [paymentMethod,   setPaymentMethod]   = useState<string | null>(session.paymentMethod);
  const [paymentDetails,  setPaymentDetails]  = useState<any>(session.paymentDetails);

  const tax   = session.totalAmount * taxPct;
  const total = session.totalAmount + tax;
  const date  = new Date(session.startedAt);
  const isMultiRound = session.orders.length > 1;
  const orderIds = session.orders.map(o => o.id);

  let splitEntries: { method: string; amount: number }[] = [];
  if (paymentMethod === 'split' && paymentDetails) {
    try {
      splitEntries = Array.isArray(paymentDetails) ? paymentDetails
        : typeof paymentDetails === 'string' ? JSON.parse(paymentDetails)
        : [];
    } catch {}
  }

  return (
    <>
      {showBill && (
        <ReprintBill
          session={{ ...session, paymentMethod, paymentDetails }}
          onClose={() => setShowBill(false)}
        />
      )}
      {showPaymentEdit && (
        <PaymentEditModal
          orderIds={orderIds}
          currentMethod={paymentMethod}
          total={session.totalAmount}
          onClose={() => setShowPaymentEdit(false)}
          onSaved={(newMethod, newDetails) => {
            setPaymentMethod(newMethod);
            setPaymentDetails(newDetails || null);
            setShowPaymentEdit(false);
          }}
        />
      )}

      <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden hover:border-zinc-600 transition-colors">
        <button
          className="w-full px-4 py-3 text-left flex items-center gap-3"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface-raised border border-surface-border flex items-center justify-center font-mono font-bold text-sm text-white">
            {session.tableId}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white text-sm font-semibold">Table {session.tableId}</span>
              {session.customerName && (
                <span className="text-zinc-400 text-xs font-medium truncate max-w-[120px]" title={session.customerName}>
                  {session.customerName}
                  {session.customerPhone && <span className="text-zinc-600"> · {session.customerPhone}</span>}
                </span>
              )}
              {isMultiRound && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/25">
                  {session.orders.length} rounds
                </span>
              )}
              {paymentMethod && <PaymentBadge method={paymentMethod} />}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-zinc-500 text-xs">
                {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-zinc-700 text-xs">·</span>
              <span className="text-zinc-500 text-xs">
                {session.allItems.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="font-mono font-bold text-white text-sm">{sym}{total.toFixed(2)}</span>
            <svg
              className={`w-4 h-4 text-zinc-500 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expanded && (
          <div className="border-t border-surface-border bg-surface-raised/50">
            {(session.customerName || session.customerPhone) && (
              <div className="px-4 pt-3 pb-2 border-b border-surface-border/50">
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1.5">Customer</p>
                <div className="flex items-center gap-3">
                  {session.customerName && (
                    <span className="flex items-center gap-1.5 text-xs text-zinc-300">
                      <svg className="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                      {session.customerName}
                    </span>
                  )}
                  {session.customerPhone && (
                    <span className="flex items-center gap-1.5 text-xs text-zinc-300">
                      <svg className="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                      {session.customerPhone}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="px-4 pt-3 pb-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Items Ordered</p>
              <div className="space-y-2">
                {session.allItems.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-white text-xs font-medium">
                        <span style={{ color: brand }} className="font-bold">{item.quantity}×</span> {item.name}
                      </span>
                      {item.note && (
                        <div className="text-zinc-600 text-[10px] italic ml-4">↳ {item.note}</div>
                      )}
                    </div>
                    <span className="font-mono text-zinc-400 text-xs flex-shrink-0">
                      {sym}{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 py-2 border-t border-surface-border/50 space-y-1">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Subtotal</span>
                <span className="font-mono">{sym}{session.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Tax</span>
                <span className="font-mono">{sym}{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-surface-border/50">
                <span>Total</span>
                <span className="font-mono">{sym}{total.toFixed(2)}</span>
              </div>
              {paymentMethod && (
                <div className="pt-1 border-t border-surface-border/50">
                  <div className="flex justify-between text-xs text-zinc-500 mb-1">
                    <span>Payment method</span>
                    <PaymentBadge method={paymentMethod} />
                  </div>
                  {paymentMethod === 'split' && splitEntries.length > 0 && (
                    <div className="mt-1.5 space-y-1 pl-2">
                      {splitEntries.map((e, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <PaymentBadge method={e.method} />
                          <span className="font-mono text-zinc-400">{sym}{e.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isMultiRound && (
              <div className="px-4 py-2 border-t border-surface-border/50">
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Rounds</p>
                {session.orders.map((order, i) => {
                  const roundTotal = order.items.reduce((s, it) => s + it.price * it.quantity, 0);
                  return (
                    <div key={order.id} className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Round {i + 1} — {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                      <span className="font-mono">{sym}{roundTotal.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="px-4 py-3 border-t border-surface-border/50 flex gap-2 flex-wrap">
              <button
                onClick={() => setShowBill(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/25 text-brand-400 text-xs font-semibold hover:bg-brand-500/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
                Print Bill
              </button>
              <button
                onClick={() => setShowPaymentEdit(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-raised border border-surface-border text-zinc-400 text-xs font-semibold hover:text-white hover:border-zinc-500 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                {paymentMethod ? 'Edit Payment' : 'Add Payment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main ReportsView ───────────────────────────────────────────────────────
export default function ReportsView() {
  const [section,  setSection]  = useState<Section>('analytics');
  const [summary,  setSummary]  = useState<ReportSummary | null>(null);
  const [history,  setHistory]  = useState<Order[]>([]);
  const [chart,    setChart]    = useState<RevenueDay[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const settings = useSettings();
  const sym    = settings.currency_symbol || '₹';
  const taxPct = parseFloat(settings.tax_percent || '5') / 100;
  const brand  = (settings.brand_color as string) || '#f97316';

  const loadAnalytics = useCallback(async () => {
    try { const [s, c] = await Promise.all([getReportToday(), getRevenueChart()]); setSummary(s); setChart(c); }
    catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const p: Record<string, string> = {};
      if (dateFrom) p.from = dateFrom;
      if (dateTo)   p.to   = dateTo;
      setHistory(await getReportHistory(p));
    } catch {}
  }, [dateFrom, dateTo]);

  useEffect(() => { loadAnalytics(); }, []);
  useEffect(() => { if (section === 'history') loadHistory(); }, [section]);

  const sessions  = groupOrdersIntoSessions(history);
  const maxRev    = chart.length ? Math.max(...chart.map(d => d.revenue), 0.01) : 0.01;
  const maxOrders = chart.length ? Math.max(...chart.map(d => d.orders), 1) : 1;
  const totalRev  = chart.reduce((s, d) => s + d.revenue, 0);
  const avgRev    = chart.length ? totalRev / chart.length : 0;
  const histTotal = sessions.reduce((s, sess) => s + sess.totalAmount * (1 + taxPct), 0);

  const paymentBreakdown = (summary as any)?.paymentBreakdown as { payment_method: string; count: number; total: number }[] | undefined;

  const bestDay    = chart.reduce((best, d) => d.revenue > (best?.revenue ?? 0) ? d : best, chart[0] ?? null);
  const worstDay   = chart.filter(d => d.revenue > 0).reduce((worst, d) => d.revenue < (worst?.revenue ?? Infinity) ? d : worst, null as RevenueDay | null);
  const totalOrdersChart = chart.reduce((s, d) => s + d.orders, 0);
  const activeDays = chart.filter(d => d.orders > 0).length;
  const avgOrdersPerActiveDay = activeDays > 0 ? (totalOrdersChart / activeDays) : 0;

  const revenueGrowth = (() => {
    if (chart.length < 2) return null;
    const half = Math.floor(chart.length / 2);
    const first = chart.slice(0, half).reduce((s, d) => s + d.revenue, 0);
    const second = chart.slice(half).reduce((s, d) => s + d.revenue, 0);
    if (first === 0) return null;
    return ((second - first) / first) * 100;
  })();

  const RevenueChart = () => (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-sm">Daily Revenue</h3>
          <p className="text-zinc-500 text-xs mt-0.5">Last 30 days</p>
        </div>
        <div className="text-right ml-4 flex-shrink-0">
          <p className="font-mono font-bold text-white text-sm sm:text-base leading-tight">{sym}{totalRev.toFixed(2)}</p>
          <p className="text-zinc-600 text-[10px] mt-0.5 whitespace-nowrap">avg {sym}{avgRev.toFixed(2)}/day</p>
        </div>
      </div>
      {chart.length === 0 ? (
        <div className="h-28 flex items-center justify-center text-zinc-700 text-sm">No data yet</div>
      ) : (
        <>
          <div style={{ height: 100, position: 'relative' }}>
            <div className="absolute inset-0 flex items-end gap-px">
              {chart.map((d, i) => {
                const barH   = Math.max(2, Math.round((d.revenue / maxRev) * 96));
                const isToday = i === chart.length - 1;
                return (
                  <div key={i} className="flex-1 flex items-end group" style={{ height: '96px' }}
                    title={`${d.day}: ${sym}${d.revenue.toFixed(2)} · ${d.orders} orders`}>
                    <div className="w-full rounded-t-sm transition-opacity"
                      style={{ height: `${barH}px`, backgroundColor: isToday ? '#f97316' : '#f9731660', opacity: isToday ? 1 : 0.7 }} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between mt-2 text-[9px] font-mono text-zinc-600">
            <span>{chart[0]?.day?.slice(5)}</span>
            <span>{chart[Math.floor(chart.length / 2)]?.day?.slice(5)}</span>
            <span className="text-brand-500 font-bold">Today</span>
          </div>
        </>
      )}
    </div>
  );

  const OrderVolumeChart = () => (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-sm">Order Volume</h3>
          <p className="text-zinc-500 text-xs mt-0.5">Orders per day — last 30 days</p>
        </div>
        <span className="font-mono text-zinc-400 text-sm ml-4 flex-shrink-0">{totalOrdersChart} total</span>
      </div>
      {chart.length === 0 ? (
        <div className="h-16 flex items-center justify-center text-zinc-700 text-sm">No data yet</div>
      ) : (
        <>
          <div style={{ height: 64, position: 'relative' }}>
            <div className="absolute inset-0 flex items-end gap-px">
              {chart.map((d, i) => {
                const barH    = Math.max(2, Math.round((d.orders / maxOrders) * 60));
                const isToday = i === chart.length - 1;
                return (
                  <div key={i} className="flex-1 flex items-end" style={{ height: '60px' }}
                    title={`${d.day}: ${d.orders} orders`}>
                    <div className="w-full rounded-t-sm"
                      style={{ height: `${barH}px`, backgroundColor: isToday ? '#6366f1' : '#6366f150' }} />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between mt-2 text-[9px] font-mono text-zinc-600">
            <span>{chart[0]?.day?.slice(5)}</span>
            <span>{chart[Math.floor(chart.length / 2)]?.day?.slice(5)}</span>
            <span className="text-indigo-400 font-bold">Today</span>
          </div>
        </>
      )}
    </div>
  );

  const InsightsPanel = () => (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
      <h3 className="font-bold text-white text-sm mb-1">30-Day Insights</h3>
      <p className="text-zinc-600 text-xs mb-4">Trends and patterns from the last month</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-lg bg-surface-raised border border-surface-border p-3">
          <p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1 font-semibold">Best Day</p>
          {bestDay ? (
            <>
              <p className="font-mono font-bold text-emerald-400 text-base">{sym}{bestDay.revenue.toFixed(2)}</p>
              <p className="text-zinc-500 text-[10px] mt-0.5">{new Date(bestDay.day + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
            </>
          ) : <p className="text-zinc-700 text-xs">No data</p>}
        </div>
        <div className="rounded-lg bg-surface-raised border border-surface-border p-3">
          <p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1 font-semibold">Active Days</p>
          <p className="font-mono font-bold text-white text-base">{activeDays}<span className="text-zinc-600 text-xs font-normal"> / 30</span></p>
          <p className="text-zinc-500 text-[10px] mt-0.5">{Math.round((activeDays / 30) * 100)}% of the month</p>
        </div>
        <div className="rounded-lg bg-surface-raised border border-surface-border p-3">
          <p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1 font-semibold">Avg Orders/Day</p>
          <p className="font-mono font-bold text-white text-base">{avgOrdersPerActiveDay.toFixed(1)}</p>
          <p className="text-zinc-500 text-[10px] mt-0.5">on active days</p>
        </div>
        <div className="rounded-lg bg-surface-raised border border-surface-border p-3">
          <p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1 font-semibold">15-Day Trend</p>
          {revenueGrowth !== null ? (
            <>
              <p className={`font-mono font-bold text-base ${revenueGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}%
              </p>
              <p className="text-zinc-500 text-[10px] mt-0.5">vs prior 15 days</p>
            </>
          ) : <p className="text-zinc-700 text-xs">Insufficient data</p>}
        </div>
        <div className="rounded-lg bg-surface-raised border border-surface-border p-3">
          <p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1 font-semibold">30-Day Avg Order</p>
          <p className="font-mono font-bold text-white text-base">
            {totalOrdersChart > 0 ? `${sym}${(totalRev / totalOrdersChart).toFixed(2)}` : '—'}
          </p>
          <p className="text-zinc-500 text-[10px] mt-0.5">across {totalOrdersChart} orders</p>
        </div>
        <div className="rounded-lg bg-surface-raised border border-surface-border p-3">
          <p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1 font-semibold">Quietest Day</p>
          {worstDay ? (
            <>
              <p className="font-mono font-bold text-amber-400 text-base">{sym}{worstDay.revenue.toFixed(2)}</p>
              <p className="text-zinc-500 text-[10px] mt-0.5">{new Date(worstDay.day + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
            </>
          ) : <p className="text-zinc-700 text-xs">No data</p>}
        </div>
        <div className="rounded-lg bg-surface-raised border border-surface-border p-3">
          <p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1 font-semibold">Total Revenue</p>
          <p className="font-mono font-bold text-brand-400 text-base">{sym}{totalRev.toFixed(2)}</p>
          <p className="text-zinc-500 text-[10px] mt-0.5">last 30 days</p>
        </div>
        <div className="rounded-lg bg-surface-raised border border-surface-border p-3">
          <p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1 font-semibold">Best Streak</p>
          {(() => {
            let best = 0, cur = 0;
            chart.forEach(d => { if (d.orders > 0) { cur++; best = Math.max(best, cur); } else cur = 0; });
            return best > 0
              ? <><p className="font-mono font-bold text-white text-base">{best} days</p><p className="text-zinc-500 text-[10px] mt-0.5">consecutive active days</p></>
              : <p className="text-zinc-700 text-xs">No data</p>;
          })()}
        </div>
        <div className="rounded-lg bg-surface-raised border border-surface-border p-3">
          <p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1 font-semibold">Est. Tax Collected</p>
          <p className="font-mono font-bold text-white text-base">
            {totalRev > 0 ? `${sym}${(totalRev * parseFloat(settings.tax_percent || '5') / 100).toFixed(2)}` : '—'}
          </p>
          <p className="text-zinc-500 text-[10px] mt-0.5">{settings.tax_percent || 5}% on {sym}{totalRev.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );

  const BestDaysPanel = () => {
    // Aggregate revenue and orders by day-of-week from the 30-day chart
    const dowMap: Record<number, { revenue: number; orders: number; days: number }> = {};
    for (let i = 0; i < 7; i++) dowMap[i] = { revenue: 0, orders: 0, days: 0 };
    chart.forEach(d => {
      const dow = new Date(d.day + 'T12:00:00').getDay(); // 0=Sun, 1=Mon...
      dowMap[dow].revenue += d.revenue;
      dowMap[dow].orders  += d.orders;
      dowMap[dow].days    += 1;
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const maxAvgRev = Math.max(
      ...Object.values(dowMap).map(d => d.days > 0 ? d.revenue / d.days : 0),
      0.01
    );

    return (
      <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
        <h3 className="font-bold text-white text-sm mb-1">Best Days of the Week</h3>
        <p className="text-zinc-600 text-xs mb-4">Average daily revenue by weekday — last 30 days</p>
        <div className="space-y-3">
          {Array.from({ length: 7 }, (_, i) => {
            const d   = dowMap[i];
            const avg = d.days > 0 ? d.revenue / d.days : 0;
            const pct = maxAvgRev > 0 ? (avg / maxAvgRev) * 100 : 0;
            const isToday = new Date().getDay() === i;
            return (
              <div key={i}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className={`text-xs font-semibold ${isToday ? 'text-brand-400' : 'text-zinc-400'}`}>
                    {dayNames[i]}{isToday ? ' ·today' : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-xs">{d.orders} orders</span>
                    <span className="font-mono text-white text-sm font-bold">
                      {avg > 0 ? `${sym}${avg.toFixed(2)}` : '—'}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(pct, d.orders > 0 ? 2 : 0)}%`,
                      backgroundColor: isToday ? 'var(--brand, #f97316)' : '#6366f1',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {totalOrdersChart === 0 && (
          <p className="text-zinc-600 text-xs mt-3">No data yet — check back after a few days of orders</p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-surface-border bg-surface-card/50">
        <h2 className="font-bold text-white text-sm">Reports</h2>
        <span className="text-zinc-500 text-xs hidden sm:block">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <div className="ml-auto flex items-center gap-1 bg-surface-raised border border-surface-border rounded-lg p-0.5">
          {([
            { key: 'analytics', label: 'Analytics' },
            { key: 'history',   label: 'History' },
            { key: 'export',    label: 'Export' },
          ] as { key: Section; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setSection(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${section === key ? 'bg-brand-500 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {section === 'analytics' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Today's Revenue", value: `${sym}${summary?.revenue.toFixed(2) ?? "0.00"}`, sub: 'from completed orders', accent: true },
              { label: 'Orders Completed', value: String(summary?.ordersCount ?? 0), sub: 'closed today' },
              { label: 'Active Now',       value: String(summary?.activeOrders ?? 0), sub: 'in kitchen or table' },
              { label: 'Tables Occupied',  value: String(summary?.occupiedTables ?? 0), sub: 'currently in use' },
            ].map((stat, i) => (
              <div key={i} className="rounded-xl border border-surface-border bg-surface-card p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">{stat.label}</p>
                <p className={`font-mono font-bold text-2xl xl:text-3xl leading-tight break-all ${stat.accent ? 'text-brand-400' : 'text-white'}`}>
                  {stat.value}
                </p>
                <p className="text-zinc-600 text-xs mt-2">{stat.sub}</p>
              </div>
            ))}
          </div>
          <RevenueChart />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InsightsPanel />
            <BestDaysPanel />
          </div>
          <OrderVolumeChart />
        </div>
      )}

      {section === 'history' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 py-2 flex-wrap">
              <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" /></svg>
              <input type="date" className="bg-transparent text-sm text-white outline-none w-32" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <span className="text-zinc-600 text-xs">—</span>
              <input type="date" className="bg-transparent text-sm text-white outline-none w-32" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <button className="btn btn-brand btn-sm" onClick={loadHistory}>Search</button>
            {(dateFrom || dateTo) && <button className="btn btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>}
            {sessions.length > 0 && (
              <div className="ml-auto flex items-center gap-3">
                <span className="text-zinc-500 text-sm">{sessions.length} visits</span>
                <span className="font-mono font-bold text-white text-sm">{sym}{histTotal.toFixed(2)}</span>
              </div>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
              <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
              <p className="text-sm font-medium">No orders found</p>
              <p className="text-xs mt-1">Click Search to load all history</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="px-1 mb-3">
                <p className="text-zinc-600 text-xs">Click any row to expand. Expand to edit payment or print bill.</p>
              </div>
              {sessions.map(session => (
                <SessionRow
                  key={session.sessionKey}
                  session={session}
                  sym={sym}
                  taxPct={taxPct}
                  brand={brand}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'export' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <ExportTab />
        </div>
      )}
    </div>
  );
}