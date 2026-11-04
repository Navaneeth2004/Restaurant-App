import { useState } from 'react';
import Icon from 'components/ui/base/Icon';
import { formatDateTime } from 'lib/format/local-time';
import { formatMoney } from 'lib/format/money';
import type { DeletedRecord } from 'types/restaurant/orders';
import PaymentBadge from '../../components/PaymentBadge';

const Pill = ({ children, cls }: { children: string; cls: string }) => <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${cls}`}>{children}</span>;

export default function DeletedRow({ record: r, sym }: { record: DeletedRecord; sym: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)} className="w-full px-4 py-3 text-left flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mt-0.5 text-red-400"><Icon name="trash" className="w-4 h-4" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="text-white text-sm font-semibold">{r.table_label || r.table_id}</span>
            {r.order_type === 'parcel' && <Pill cls="bg-indigo-500/15 text-indigo-400 border-indigo-500/25">Parcel</Pill>}
            {r.was_edited ? <Pill cls="bg-amber-500/10 text-amber-400 border-amber-500/30">Was edited</Pill> : null}
            <PaymentBadge method={r.payment_method} />
          </div>
          <p className="text-zinc-400 text-xs">Deleted {formatDateTime(r.deleted_at)}{r.deleted_by && <> by <span className="text-zinc-200 font-medium">{r.deleted_by}</span></>}</p>
          <p className="text-zinc-600 text-[11px] mt-0.5">Visit was on {formatDateTime(r.visit_at)}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="font-mono font-bold text-sm text-white">{formatMoney(r.bill_total, sym)}</div>
          <Icon name="chevronDown" className={`w-4 h-4 text-zinc-500 ml-auto mt-1 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="border-t border-surface-border px-4 py-3 space-y-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Items that were on the bill</p>
            <ul className="divide-y divide-surface-border/50">
              {r.items.map((it, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                  <div className="min-w-0"><span className="text-white text-xs font-medium"><span className="text-brand-400 font-bold">{it.quantity}×</span> {it.name}</span>
                    {it.note && <div className="text-zinc-600 text-[10px] italic ml-4">↳ {it.note}</div>}</div>
                  <span className="font-mono text-zinc-400 text-xs flex-shrink-0">{formatMoney(it.price * it.quantity, sym)}</span>
                </li>
              ))}
            </ul>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <dt className="text-zinc-500">Subtotal</dt><dd className="text-right font-mono text-zinc-300">{formatMoney(r.subtotal, sym)}</dd>
            <dt className="text-zinc-500">Bill total (incl. tax)</dt><dd className="text-right font-mono text-zinc-300">{formatMoney(r.bill_total, sym)}</dd>
            <dt className="text-zinc-500">Amount paid</dt><dd className="text-right font-mono text-zinc-300">{r.amount_paid != null ? formatMoney(r.amount_paid, sym) : '—'}</dd>
            {r.customer_name && <><dt className="text-zinc-500">Customer</dt><dd className="text-right text-zinc-300">{r.customer_name}{r.customer_phone ? ` · ${r.customer_phone}` : ''}</dd></>}
            {r.customer_gstin && <><dt className="text-zinc-500">Customer GSTIN</dt><dd className="text-right font-mono text-indigo-300">{r.customer_gstin}</dd></>}
            {r.edited_at && <><dt className="text-zinc-500">Last edited</dt><dd className="text-right text-amber-400">{formatDateTime(r.edited_at)}</dd></>}
            <dt className="text-zinc-500">Rounds / orders</dt><dd className="text-right text-zinc-300">{r.order_count}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
