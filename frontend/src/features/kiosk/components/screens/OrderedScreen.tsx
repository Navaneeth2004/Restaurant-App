import Icon from 'components/ui/base/Icon';
import Spinner from 'components/ui/feedback/Spinner';
import { BillTotals } from 'lib/orders/bill';
import type { Order } from 'types/restaurant/orders';
import OrderRounds from '../parts/OrderRounds';
import TotalsCard from '../parts/TotalsCard';

interface Props {
  orders: ReadonlyArray<Order>; totals: BillTotals; taxPercent: string; sym: string; busy: boolean;
  onAddMore: () => void; onRequestBill: () => void;
}

export default function OrderedScreen({ orders, totals, taxPercent, sym, busy, onAddMore, onRequestBill }: Props) {
  const cooking = orders.some(o => o.status === 'active');
  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 pb-8">
        <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border mb-4 ${cooking ? 'bg-brand-500/10 border-brand-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
          <Icon name={cooking ? 'clock' : 'check'} className={`w-5 h-5 flex-shrink-0 ${cooking ? 'text-brand-400' : 'text-emerald-400'}`} />
          <div>
            <p className={`text-sm font-bold ${cooking ? 'text-brand-400' : 'text-emerald-400'}`}>{cooking ? 'Order in kitchen' : 'All items ready'}</p>
            <p className="text-zinc-500 text-xs">{cooking ? 'Your food is being prepared.' : 'Add more items or request the bill below.'}</p>
          </div>
        </div>
        <OrderRounds orders={orders} sym={sym} />
        <TotalsCard totals={totals} taxPercent={taxPercent} sym={sym} label="Total so far" />
      </div>
      <div className="flex-shrink-0 border-t border-surface-border p-4 pb-6 flex flex-col gap-2.5">
        <button type="button" className="btn w-full py-3" onClick={onAddMore}>Add More Items</button>
        <button type="button" className="btn btn-success w-full py-3" onClick={onRequestBill} disabled={busy}>{busy ? <Spinner className="w-4 h-4 border-emerald-400/40 border-t-emerald-400" /> : 'Request Bill'}</button>
      </div>
    </>
  );
}
