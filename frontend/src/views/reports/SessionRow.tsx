/**
 * views/reports/SessionRow.tsx
 *
 * Expandable row for a single dining session in the history list.
 * Extracted from ReportsView.tsx.
 */

import React, { useState } from 'react';
import PaymentBadge    from './PaymentBadge';
import ReprintBill     from './ReprintBill';
import PaymentEditModal from '../../components/PaymentEditModal';
import type { TableSession } from '../../utils/sessions';

interface Props {
  session: TableSession;
  sym:     string;
  taxPct:  number;
  brand:   string;
}

export default function SessionRow({ session, sym, taxPct, brand }: Props) {
  const [expanded,        setExpanded]        = useState(false);
  const [showBill,        setShowBill]        = useState(false);
  const [showPaymentEdit, setShowPaymentEdit] = useState(false);
  const [paymentMethod,   setPaymentMethod]   = useState<string | null>(session.paymentMethod);
  const [paymentDetails,  setPaymentDetails]  = useState<any>(session.paymentDetails);

  const tax          = session.totalAmount * taxPct;
  const total        = session.totalAmount + tax;
  const date         = new Date(session.startedAt);
  const isMultiRound = session.orders.length > 1;
  const orderIds     = session.orders.map(o => o.id);

  let splitEntries: { method: string; amount: number }[] = [];
  if (paymentMethod === 'split' && paymentDetails) {
    try {
      splitEntries = Array.isArray(paymentDetails)
        ? paymentDetails
        : typeof paymentDetails === 'string'
          ? JSON.parse(paymentDetails)
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
        {/* Summary row */}
        <button
          className="w-full px-4 py-3 text-left flex items-center gap-3"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface-raised border border-surface-border flex items-center justify-center font-mono font-bold text-sm text-white">
            {session.tableId}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-white text-sm font-semibold">Table {session.tableId}</span>
              {isMultiRound && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/25">
                  {session.orders.length} rounds
                </span>
              )}
              {paymentMethod && <PaymentBadge method={paymentMethod} />}
            </div>
            {session.customerName && (
              <div className="text-zinc-400 text-xs truncate mt-0.5">
                {session.customerName}
                {session.customerPhone && <span className="text-zinc-600"> · {session.customerPhone}</span>}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-zinc-500 text-xs">
                {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {', '}
                {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
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

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t border-surface-border bg-surface-raised/50">
            {/* Customer info */}
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

            {/* Items */}
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

            {/* Totals */}
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

            {/* Rounds breakdown */}
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

            {/* Action buttons */}
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