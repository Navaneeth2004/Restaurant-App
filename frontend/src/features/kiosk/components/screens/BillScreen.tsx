import Icon from 'components/ui/base/Icon';
import { BillTotals } from 'lib/orders/bill';
import { formatMoney } from 'lib/format/money';
import { mergeItems } from 'lib/orders/order-items';
import type { KioskContext } from 'types/restaurant/kiosk';
import type { Order } from 'types/restaurant/orders';
import TotalsCard from '../parts/TotalsCard';

interface Props { ctx: KioskContext; orders: ReadonlyArray<Order>; totals: BillTotals; sym: string }

/** After "Request bill": the whole visit on one page while the waiter comes. */
export default function BillScreen({ ctx, orders, totals, sym }: Props) {
  const items = mergeItems(orders.flatMap(o => o.items));
  return (
    <div className="flex-1 overflow-y-auto p-4 pb-8">
      <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-brand-500/10 border border-brand-500/30 mb-4">
        <Icon name="info" className="w-5 h-5 text-brand-400 flex-shrink-0" />
        <div><p className="text-brand-400 text-sm font-bold">Bill requested</p><p className="text-zinc-500 text-xs">Your waiter will be with you shortly.</p></div>
      </div>
      <ul className="rounded-xl border border-surface-border bg-surface-card px-4 py-1 mb-3">
        {items.map(it => (
          <li key={`${it.name}|${it.note}|${it.price}`} className="flex justify-between gap-4 py-2.5 border-b border-surface-border/60 last:border-0">
            <div className="min-w-0">
              <span className="text-white text-[13px]"><span className="font-mono font-bold text-brand-400">{it.quantity}×</span> {it.name}</span>
              {it.note && <p className="text-zinc-600 text-[11px] italic mt-0.5">{it.note}</p>}
            </div>
            <span className="font-mono text-zinc-500 text-[13px] flex-shrink-0">{formatMoney(it.price * it.quantity, sym)}</span>
          </li>
        ))}
      </ul>
      <TotalsCard totals={totals} taxPercent={ctx.tax_percent} sym={sym} label="Total" />
      {ctx.bill_footer && <p className="text-center text-zinc-600 text-xs mt-4">{ctx.bill_footer}</p>}
    </div>
  );
}
