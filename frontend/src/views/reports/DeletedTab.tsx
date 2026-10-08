/**
 * views/reports/DeletedTab.tsx
 *
 * Audit log of every visit that was permanently deleted from History.
 * Each entry keeps a snapshot (items, totals, payment, customer) taken at the
 * moment of deletion, plus WHEN it was deleted and BY WHICH ADMIN (identified
 * by the PIN that was entered). Entries are read-only and cannot be removed
 * from the app.
 */

import React, { useCallback, useEffect, useState } from 'react';
import PaymentBadge from './PaymentBadge';
import { authedJson } from '../../utils/authedFetch';

const API = process.env.REACT_APP_API_URL || window.location.origin;

interface DeletedItem { name: string; price: number; quantity: number; note: string }
interface DeletedRecord {
  id: number;
  deleted_at: string;
  deleted_by: string | null;
  table_id: string;
  table_label: string | null;
  visit_at: string | null;
  order_count: number;
  subtotal: number;
  bill_total: number;
  amount_paid: number | null;
  payment_method: string | null;
  order_type: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_gstin: string | null;
  was_edited: number;
  edited_at: string | null;
  items: DeletedItem[];
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

export default function DeletedTab({ sym }: { sym: string }) {
  const [rows,   setRows]   = useState<DeletedRecord[] | null>(null);
  const [error,  setError]  = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setRows(await authedJson<DeletedRecord[]>(`${API}/api/orders/log/deleted`));
    } catch (e: any) {
      setError(e.message || 'Could not load the deleted-records log.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalRemoved = (rows ?? []).reduce((s, r) => s + r.bill_total, 0);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-bold text-white text-sm">Deleted Records</h3>
          <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed max-w-xl">
            Every visit deleted from History is logged here with what it contained, when it was deleted and by which admin.
            This list is read-only.
          </p>
        </div>
        <button onClick={load} className="btn btn-sm flex-shrink-0">Refresh</button>
      </div>

      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
      {rows === null && !error && <p className="text-zinc-600 text-xs py-4">Loading…</p>}

      {rows && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
          <p className="text-sm font-medium">Nothing has been deleted</p>
          <p className="text-xs mt-1">Deleted visits will appear here.</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center text-xs font-semibold text-zinc-300 bg-surface-raised border border-surface-border px-2.5 py-1 rounded-full">
              {rows.length} deleted
            </span>
            <span className="inline-flex items-center text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-2.5 py-1 rounded-full font-mono">
              {sym}{totalRemoved.toFixed(2)} removed
            </span>
          </div>

          <div className="space-y-2">
            {rows.map(r => {
              const open = openId === r.id;
              const label = r.table_label || r.table_id;
              return (
                <div key={r.id} className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
                  <button
                    onClick={() => setOpenId(o => o === r.id ? null : r.id)}
                    className="w-full px-4 py-3 text-left flex items-start gap-3"
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mt-0.5">
                      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-white text-sm font-semibold">{label}</span>
                        {r.order_type === 'parcel' && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">Parcel</span>
                        )}
                        {r.was_edited ? (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">Was edited</span>
                        ) : null}
                        {r.payment_method && <PaymentBadge method={r.payment_method} />}
                      </div>
                      <p className="text-zinc-400 text-xs">
                        Deleted {fmt(r.deleted_at)}{r.deleted_by ? <> by <span className="text-zinc-200 font-medium">{r.deleted_by}</span></> : null}
                      </p>
                      <p className="text-zinc-600 text-[11px] mt-0.5">Visit was on {fmt(r.visit_at)}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="font-mono font-bold text-sm text-white">{sym}{r.bill_total.toFixed(2)}</div>
                      <svg className={`w-4 h-4 text-zinc-500 ml-auto mt-1 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-surface-border px-4 py-3 space-y-3">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Items that were on the bill</p>
                        <div className="divide-y divide-surface-border/50">
                          {r.items.map((it, i) => (
                            <div key={i} className="flex items-start justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                              <div className="min-w-0">
                                <span className="text-white text-xs font-medium">
                                  <span className="text-brand-400 font-bold">{it.quantity}×</span> {it.name}
                                </span>
                                {it.note && <div className="text-zinc-600 text-[10px] italic ml-4">↳ {it.note}</div>}
                              </div>
                              <span className="font-mono text-zinc-400 text-xs flex-shrink-0">{sym}{(it.price * it.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                        <span className="text-zinc-500">Subtotal</span>
                        <span className="text-right font-mono text-zinc-300">{sym}{r.subtotal.toFixed(2)}</span>
                        <span className="text-zinc-500">Bill total (incl. tax)</span>
                        <span className="text-right font-mono text-zinc-300">{sym}{r.bill_total.toFixed(2)}</span>
                        <span className="text-zinc-500">Amount paid</span>
                        <span className="text-right font-mono text-zinc-300">{r.amount_paid != null ? `${sym}${r.amount_paid.toFixed(2)}` : '—'}</span>
                        {r.customer_name && (<><span className="text-zinc-500">Customer</span><span className="text-right text-zinc-300">{r.customer_name}{r.customer_phone ? ` · ${r.customer_phone}` : ''}</span></>)}
                        {r.customer_gstin && (<><span className="text-zinc-500">Customer GSTIN</span><span className="text-right font-mono text-indigo-300">{r.customer_gstin}</span></>)}
                        {r.edited_at && (<><span className="text-zinc-500">Last edited</span><span className="text-right text-amber-400">{fmt(r.edited_at)}</span></>)}
                        <span className="text-zinc-500">Rounds / orders</span>
                        <span className="text-right text-zinc-300">{r.order_count}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}