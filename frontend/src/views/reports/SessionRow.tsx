/**
 * views/reports/SessionRow.tsx
 *
 * Expandable row for a single dining session in the history list.
 *
 * NEW (edited indicator): if the payment/details of a visit were changed via
 * "Edit Payment", the row shows an amber "Edited" badge and the expanded view
 * shows exactly when it was last edited (session.editedAt, from the
 * orders.edited_at column).
 *
 * NEW (delete record): a red Delete button. It ALWAYS asks for the admin PIN
 * (even if the Admin Lock setting is off), and the PIN is re-checked on the
 * server. Deleting removes the whole visit permanently from history, revenue
 * and GST reports.
 *
 * (All earlier fixes — kitchen-round count, parcel labels, customer GSTIN,
 * backdating, amount paid block — are unchanged.)
 */

import React, { useState } from 'react';
import PaymentBadge    from './PaymentBadge';
import ReprintBill     from './ReprintBill';
import PaymentEditModal from '../../components/PaymentEditModal';
import ConfirmModal    from '../../components/ConfirmModal';
import { PinModal }    from '../../components/admin/PinModal';
import { useToast }    from '../../context/ToastContext';
import { authedJson }  from '../../utils/authedFetch';
import { tableDisplayLabel } from '../../utils/sessions';
import type { TableSession } from '../../utils/sessions';

const API = process.env.REACT_APP_API_URL || window.location.origin;

interface Props {
  session: TableSession;
  sym:     string;
  taxPct:  number;
  brand:   string;
  /** Called after the visit was deleted on the server, with the removed order ids. */
  onDeleted?: (orderIds: string[]) => void;
}

function fmtEdited(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

function OrderTypeBadge({ type }: { type: 'dine_in' | 'parcel' | null }) {
  const resolved = type === 'parcel' ? 'parcel' : 'dine_in';
  const isParcel = resolved === 'parcel';
  return (
    <span
      className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
        isParcel
          ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25'
          : 'bg-zinc-700/30 text-zinc-400 border-zinc-600/40'
      }`}
    >
      {isParcel ? 'Parcel' : 'Dine In'}
    </span>
  );
}

function DiffBadge({ diff, sym }: { diff: number; sym: string }) {
  const short = diff < 0;
  return (
    <span
      className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
        short
          ? 'bg-red-500/15 text-red-400 border-red-500/25'
          : 'bg-blue-500/15 text-blue-400 border-blue-500/25'
      }`}
      title={short ? 'Paid less than bill' : 'Paid more than bill'}
    >
      {short ? 'Short' : 'Over'} {sym}{Math.abs(diff).toFixed(2)}
    </span>
  );
}

export default function SessionRow({ session, sym, taxPct, brand, onDeleted }: Props) {
  const toast = useToast();

  const [expanded,        setExpanded]        = useState(false);
  const [showBill,        setShowBill]        = useState(false);
  const [showPaymentEdit, setShowPaymentEdit] = useState(false);
  const [paymentMethod,   setPaymentMethod]   = useState<string | null>(session.paymentMethod);
  const [paymentDetails,  setPaymentDetails]  = useState<any>(session.paymentDetails);
  const [amountPaid, setAmountPaid] = useState<number | null>(session.amountPaid ?? null);
  const [orderType, setOrderType] = useState<'dine_in' | 'parcel' | null>(session.orderType ?? null);
  const [customerGstin, setCustomerGstin] = useState<string | null>(session.customerGstin ?? null);
  const [startedAt, setStartedAt] = useState<string>(session.startedAt);

  // NEW: when this visit was last edited (null = never edited)
  const [editedAt, setEditedAt] = useState<string | null>(session.editedAt ?? null);

  // NEW: delete flow
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pinOpen,       setPinOpen]       = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [gone,          setGone]          = useState(false);

  const tax       = session.totalAmount * taxPct;
  const billTotal = session.totalAmount + tax;
  const paidTotal = amountPaid != null ? amountPaid : billTotal;
  const paidDiff  = paidTotal - billTotal;
  const hasDiff   = Math.abs(paidDiff) >= 0.01;

  const date = new Date(startedAt);
  const displayLabel = tableDisplayLabel(session.tableId);

  const kitchenRounds = session.kitchenRounds ?? [];
  const isMultiRound  = kitchenRounds.length > 1;
  const hasDirectBill = session.orders.length > kitchenRounds.length;

  const orderIds     = session.orders.map(o => o.id);
  const itemCount    = session.allItems.reduce((s, i) => s + i.quantity, 0);

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

  const verifyAdminPin = async (pin: string): Promise<boolean> => {
    try {
      const data = await authedJson(`${API}/api/staff/check-pin`, {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      return data.valid === true;
    } catch { return false; }
  };

  const doDelete = async (pin: string) => {
    setPinOpen(false);
    setDeleting(true);
    try {
      const r = await authedJson<{ deleted_ids?: string[] }>(`${API}/api/orders/delete-records`, {
        method: 'POST',
        body: JSON.stringify({ order_ids: orderIds, pin }),
      });
      toast('Record deleted', 'success');
      setGone(true);
      onDeleted?.(r.deleted_ids && r.deleted_ids.length ? r.deleted_ids : orderIds);
    } catch (e: any) {
      toast(e.message || 'Delete failed', 'error');
      setDeleting(false);
    }
  };

  if (gone) return null;

  return (
    <>
      {showBill && (
        <ReprintBill
          session={{ ...session, paymentMethod, paymentDetails, customerGstin, startedAt }}
          onClose={() => setShowBill(false)}
        />
      )}
      {showPaymentEdit && (
        <PaymentEditModal
          orderIds={orderIds}
          currentMethod={paymentMethod}
          currentAmountPaid={amountPaid}
          currentPaymentDetails={paymentDetails}
          currentOrderType={orderType}
          currentCustomerGstin={customerGstin}
          currentCreatedAt={startedAt}
          total={session.totalAmount}
          onClose={() => setShowPaymentEdit(false)}
          onSaved={(newMethod, newDetails, newAmountPaid, newOrderType, newGstin, newCreatedAt) => {
            setPaymentMethod(newMethod);
            setPaymentDetails(newDetails ?? null);
            if (typeof newAmountPaid === 'number') setAmountPaid(newAmountPaid);
            if (newOrderType) setOrderType(newOrderType);
            if (newGstin) setCustomerGstin(newGstin);
            if (newCreatedAt) setStartedAt(newCreatedAt);
            // The server stamps edited_at on save; mirror it locally right away.
            setEditedAt(new Date().toISOString());
            setShowPaymentEdit(false);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete this record?"
          message={`${displayLabel} · ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${sym}${billTotal.toFixed(2)}. It will be permanently removed from history, revenue and GST reports and cannot be restored. A record of the deletion is kept in Reports → Deleted.`}
          confirmLabel="Continue"
          danger
          onConfirm={() => { setConfirmDelete(false); setPinOpen(true); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {pinOpen && (
        <PinModal
          title="Admin PIN Required"
          subtitle="Enter the admin PIN to delete this record"
          verifyFn={verifyAdminPin}
          onSuccess={doDelete}
          onCancel={() => setPinOpen(false)}
        />
      )}

      <div className={`rounded-xl border border-surface-border bg-surface-card overflow-hidden hover:border-zinc-600 transition-colors ${deleting ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* ── Summary row ── */}
        <button
          className="w-full px-3.5 sm:px-4 py-3 text-left flex items-start gap-3"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface-raised border border-surface-border flex items-center justify-center font-mono font-bold text-sm text-white mt-0.5">
            {session.tableId}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className="text-white text-sm font-semibold">{displayLabel}</span>
              <OrderTypeBadge type={orderType} />
              {isMultiRound && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/25 whitespace-nowrap">
                  {kitchenRounds.length} rounds
                </span>
              )}
              {hasDirectBill && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-zinc-700/30 text-zinc-400 border border-zinc-600/40 whitespace-nowrap">
                  + direct bill
                </span>
              )}
              {paymentMethod && <PaymentBadge method={paymentMethod} />}
              {hasDiff && <DiffBadge diff={paidDiff} sym={sym} />}
              {editedAt && (
                <span
                  className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border whitespace-nowrap bg-amber-500/10 text-amber-400 border-amber-500/30"
                  title={`Edited ${fmtEdited(editedAt)}`}
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                  Edited
                </span>
              )}
            </div>

            {session.customerName && (
              <div className="text-zinc-400 text-xs truncate mb-0.5">
                {session.customerName}
                {session.customerPhone && <span className="text-zinc-600"> · {session.customerPhone}</span>}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
              <span>
                {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
              <span className="text-zinc-700">·</span>
              <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="flex-shrink-0 flex items-start gap-2 pl-1">
            <div className="text-right leading-tight">
              {hasDiff ? (
                <>
                  <div className="font-mono text-zinc-500 text-[10px] line-through">{sym}{billTotal.toFixed(2)}</div>
                  <div className={`font-mono font-bold text-sm ${paidDiff < 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    {sym}{paidTotal.toFixed(2)}
                  </div>
                </>
              ) : (
                <div className="font-mono font-bold text-white text-sm pt-0.5">{sym}{billTotal.toFixed(2)}</div>
              )}
            </div>
            <svg
              className={`w-4 h-4 text-zinc-500 transition-transform flex-shrink-0 mt-1 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* ── Expanded detail ── */}
        {expanded && (
          <div className="border-t border-surface-border">
            {/* Edited notice */}
            {editedAt && (
              <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 text-xs">
                <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                <span className="text-amber-400 font-semibold">This record was edited</span>
                <span className="text-zinc-400">{fmtEdited(editedAt)}</span>
              </div>
            )}

            {/* Customer info */}
            {(session.customerName || session.customerPhone || customerGstin) && (
              <div className="px-4 pt-3 pb-3 border-b border-surface-border/60">
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1.5">Customer</p>
                <div className="flex items-center gap-3 flex-wrap">
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
                  {customerGstin && (
                    <span className="flex items-center gap-1.5 text-xs text-indigo-300 font-mono">
                      <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12" /></svg>
                      {customerGstin}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Items */}
            <div className="px-4 pt-3.5 pb-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-2.5">Items Ordered</p>
              <div className="divide-y divide-surface-border/50">
                {session.allItems.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <span className="text-white text-xs font-medium">
                        <span style={{ color: brand }} className="font-bold">{item.quantity}×</span> {item.name}
                      </span>
                      {item.note && (
                        <div className="text-zinc-600 text-[10px] italic ml-4 mt-0.5">↳ {item.note}</div>
                      )}
                    </div>
                    <span className="font-mono text-zinc-400 text-xs flex-shrink-0 pt-0.5">
                      {sym}{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="mx-4 mb-3.5 rounded-lg bg-surface-raised/60 border border-surface-border/60 overflow-hidden">
              <div className="px-3.5 py-3 space-y-1">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Subtotal</span>
                  <span className="font-mono">{sym}{session.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Tax</span>
                  <span className="font-mono">{sym}{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-surface-border/60">
                  <span>Bill Total</span>
                  <span className="font-mono">{sym}{billTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className={`px-3.5 py-2.5 border-t flex items-center justify-between gap-2 ${
                hasDiff
                  ? (paidDiff < 0 ? 'bg-red-500/8 border-red-500/15' : 'bg-blue-500/10 border-blue-500/15')
                  : 'bg-emerald-500/8 border-emerald-500/15'
              }`}>
                <div>
                  <span className={`text-sm font-bold ${hasDiff ? (paidDiff < 0 ? 'text-red-400' : 'text-blue-400') : 'text-emerald-400'}`}>
                    Amount Paid
                  </span>
                  {hasDiff && (
                    <p className={`text-[10px] mt-0.5 ${paidDiff < 0 ? 'text-red-400/70' : 'text-blue-400/70'}`}>
                      {paidDiff < 0 ? 'Short by' : 'Overpaid by'} {sym}{Math.abs(paidDiff).toFixed(2)}
                    </p>
                  )}
                </div>
                <span className={`font-mono font-bold text-base ${hasDiff ? (paidDiff < 0 ? 'text-red-400' : 'text-blue-400') : 'text-emerald-400'}`}>
                  {sym}{paidTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Order type + payment method */}
            <div className="px-4 pb-3.5 space-y-2.5">
              <div className="flex justify-between items-center text-xs text-zinc-500">
                <span>Order type</span>
                <OrderTypeBadge type={orderType} />
              </div>

              {paymentMethod && (
                <div>
                  <div className="flex justify-between items-center text-xs text-zinc-500 mb-1.5">
                    <span>Payment method</span>
                    <PaymentBadge method={paymentMethod} />
                  </div>
                  {paymentMethod === 'split' && splitEntries.length > 0 && (
                    <div className="space-y-1 pl-2 mt-1.5">
                      {splitEntries.map((e, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <PaymentBadge method={e.method} />
                          <span className="font-mono text-zinc-400">{sym}{Number(e.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Kitchen rounds */}
            {kitchenRounds.length > 0 && (
              <div className="px-4 pb-3.5 pt-3 border-t border-surface-border/60">
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
                  {kitchenRounds.length > 1 ? 'Kitchen Rounds' : 'Kitchen Round'}
                </p>
                <div className="space-y-1">
                  {kitchenRounds.map((order, i) => {
                    const roundTotal = order.items.reduce((s, it) => s + it.price * it.quantity, 0);
                    return (
                      <div key={order.id} className="flex justify-between text-xs text-zinc-500">
                        <span>Round {i + 1} — {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                        <span className="font-mono">{sym}{roundTotal.toFixed(2)}</span>
                      </div>
                    );
                  })}
                  {hasDirectBill && (
                    <div className="flex justify-between text-xs text-zinc-600 pt-1 border-t border-surface-border/40 mt-1">
                      <span>Billed directly (no kitchen round)</span>
                      <span className="font-mono">
                        {sym}{(session.totalAmount - kitchenRounds.reduce((s, o) => s + o.items.reduce((ss, it) => ss + it.price * it.quantity, 0), 0)).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="px-4 py-3 border-t border-surface-border/60 flex gap-2 flex-wrap">
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
              <button
                onClick={() => setConfirmDelete(true)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}