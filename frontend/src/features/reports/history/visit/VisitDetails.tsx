import { ReactNode } from 'react';
import { formatDateTime, formatTime } from 'lib/format/local-time';
import { formatMoney, round2 } from 'lib/format/money';
import type { Visit } from 'lib/orders/visits';
import PaymentBadge from '../../components/PaymentBadge';
import { OrderTypeBadge } from './VisitBadges';

const Label = ({ children }: { children: ReactNode }) => <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-2">{children}</p>;

/** Everything about a visit that is not in its summary line. Money is the server's per-order totals at the visit's own tax rate. */
export default function VisitDetails({ visit: v, sym }: { visit: Visit; sym: string }) {
  const diff = round2(v.amountPaid - v.total);
  const off = Math.abs(diff) >= 0.01;
  const tone = !off ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-blue-400';
  const rounds = v.kitchenRounds;
  const direct = round2(v.subtotal - rounds.reduce((s, o) => s + (o.total || 0), 0));

  return (
    <div className="border-t border-surface-border">
      {v.editedAt && <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs"><span className="text-amber-400 font-semibold">This record was edited</span> <span className="text-zinc-400">{formatDateTime(v.editedAt)}</span></div>}

      {(v.customerName || v.customerPhone || v.customerGstin) && (
        <div className="px-4 py-3 border-b border-surface-border/60">
          <Label>Customer</Label>
          <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-300">
            {v.customerName && <span>{v.customerName}</span>}{v.customerPhone && <span>{v.customerPhone}</span>}
            {v.customerGstin && <span className="font-mono text-indigo-300">{v.customerGstin}</span>}
          </div>
        </div>
      )}

      <div className="px-4 pt-3.5 pb-3">
        <Label>Items Ordered</Label>
        <ul className="divide-y divide-surface-border/50">
          {v.items.map(i => (
            <li key={`${i.name}|${i.note}|${i.price}`} className="flex items-start justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
              <div className="flex-1 min-w-0"><span className="text-white text-xs font-medium"><span className="text-brand-400 font-bold">{i.quantity}×</span> {i.name}</span>
                {i.note && <div className="text-zinc-600 text-[10px] italic ml-4 mt-0.5">↳ {i.note}</div>}</div>
              <span className="font-mono text-zinc-400 text-xs flex-shrink-0 pt-0.5">{formatMoney(i.price * i.quantity, sym)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-4 mb-3.5 rounded-lg bg-surface-raised/60 border border-surface-border/60 overflow-hidden">
        <div className="px-3.5 py-3 space-y-1">
          <div className="flex justify-between text-xs text-zinc-500"><span>Subtotal</span><span className="font-mono">{formatMoney(v.subtotal, sym)}</span></div>
          <div className="flex justify-between text-xs text-zinc-500"><span>Tax ({v.rate}%{v.rateRecorded ? '' : ', rate not recorded — current rate'})</span><span className="font-mono">{formatMoney(v.tax, sym)}</span></div>
          <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-surface-border/60"><span>Bill Total</span><span className="font-mono">{formatMoney(v.total, sym)}</span></div>
        </div>
        <div className="px-3.5 py-2.5 border-t border-surface-border/60 flex items-center justify-between gap-2">
          <div><span className={`text-sm font-bold ${tone}`}>Amount Paid</span>
            {off && <p className={`text-[10px] mt-0.5 ${tone}`}>{diff < 0 ? 'Short by' : 'Overpaid by'} {formatMoney(Math.abs(diff), sym)}</p>}</div>
          <span className={`font-mono font-bold text-base ${tone}`}>{formatMoney(v.amountPaid, sym)}</span>
        </div>
      </div>

      <div className="px-4 pb-3.5 space-y-2.5">
        <div className="flex justify-between items-center text-xs text-zinc-500"><span>Order type</span><OrderTypeBadge type={v.orderType} /></div>
        {v.paymentMethod && (
          <div>
            <div className="flex justify-between items-center text-xs text-zinc-500"><span>Payment method</span><PaymentBadge method={v.paymentMethod} /></div>
            {v.split.length > 0 && <div className="space-y-1 pl-2 mt-1.5">{v.split.map((e, i) => <div key={i} className="flex items-center justify-between text-xs"><PaymentBadge method={e.method} /><span className="font-mono text-zinc-400">{formatMoney(e.amount, sym)}</span></div>)}</div>}
          </div>
        )}
      </div>

      {rounds.length > 0 && (
        <div className="px-4 pb-3.5 pt-3 border-t border-surface-border/60">
          <Label>{rounds.length > 1 ? 'Kitchen Rounds' : 'Kitchen Round'}</Label>
          <div className="space-y-1">
            {rounds.map((o, i) => <div key={o.id} className="flex justify-between text-xs text-zinc-500"><span>Round {i + 1} — {formatTime(o.created_at)}</span><span className="font-mono">{formatMoney(o.total, sym)}</span></div>)}
            {v.orders.length > rounds.length && <div className="flex justify-between text-xs text-zinc-600 pt-1 border-t border-surface-border/40 mt-1"><span>Billed directly (no kitchen round)</span><span className="font-mono">{formatMoney(direct, sym)}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
}
