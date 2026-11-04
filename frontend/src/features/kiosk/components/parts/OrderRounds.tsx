import { formatMoney } from 'lib/format/money';
import type { Order } from 'types/restaurant/orders';

/** Every round the customer sent: "In kitchen" while cooking, "Ready" once the kitchen marked it done. */
export default function OrderRounds({ orders, sym }: { orders: ReadonlyArray<Order>; sym: string }) {
  return (
    <>
      {orders.map((o, i) => {
        const cooking = o.status === 'active';
        return (
          <section key={o.id} className="rounded-xl border border-surface-border bg-surface-card mb-3 overflow-hidden">
            <div className={`px-3.5 py-2.5 border-b border-surface-border flex items-center justify-between ${cooking ? 'bg-brand-500/10' : 'bg-surface-raised/50'}`}>
              <span className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${cooking ? 'text-brand-400' : 'text-emerald-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cooking ? 'bg-brand-500' : 'bg-emerald-400'}`} />
                {orders.length > 1 ? `Round ${i + 1} — ` : ''}{cooking ? 'In kitchen' : 'Ready'}
              </span>
              <span className="font-mono text-zinc-500 text-xs">{formatMoney(o.total, sym)}</span>
            </div>
            <ul className="px-3.5 py-1">
              {o.items.map((it, j) => (
                <li key={it.id ?? j} className="flex justify-between gap-4 py-2 border-b border-surface-border/60 last:border-0">
                  <div className="min-w-0">
                    <span className="text-white text-[13px]"><span className="font-mono font-bold text-brand-400">{it.quantity}×</span> {it.name}</span>
                    {it.note && <p className="text-zinc-600 text-[11px] italic mt-0.5">{it.note}</p>}
                  </div>
                  <span className="font-mono text-zinc-500 text-xs flex-shrink-0">{formatMoney(it.price * it.quantity, sym)}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}
