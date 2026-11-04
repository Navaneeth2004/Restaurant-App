import Icon from 'components/ui/base/Icon';
import Spinner from 'components/ui/feedback/Spinner';
import { elapsedLabel, minutesSince } from 'lib/format/local-time';
import type { Order } from 'types/restaurant/orders';
import ItemLine from './ItemLine';

interface Props { order: Order; nowMs: number; overdueMins: number; delivering: boolean; onDeliver: (id: string) => void }

export default function OrderCard({ order, nowMs, overdueMins, delivering, onDeliver }: Props) {
  const mins = minutesSince(order.created_at, nowMs);
  const urgent = mins > overdueMins;
  return (
    <div className={`rounded-xl border overflow-hidden flex flex-col animate-slide-up ${urgent ? 'border-red-500/60 shadow-lg shadow-red-500/10' : 'border-surface-border'}`}>
      <div className={`px-4 py-3 flex items-center justify-between ${urgent ? 'bg-red-500' : 'bg-brand-500'}`}>
        <div className="flex items-center gap-2.5">
          <span className="font-mono font-bold text-white text-2xl leading-none">{order.table_id}</span>
          {urgent && <span className="text-[9px] font-bold uppercase tracking-widest text-red-100 bg-red-600/40 px-1.5 py-0.5 rounded">Overdue</span>}
        </div>
        <div className={`flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${urgent ? 'bg-red-600/60 text-red-100' : 'bg-brand-600/60 text-brand-100'}`}>
          <Icon name="clock" className="w-3 h-3 flex-shrink-0" />{elapsedLabel(mins)}
        </div>
      </div>
      <div className="px-4 py-3 flex-1 space-y-2.5 bg-surface-card">
        {order.items.map(it => <ItemLine key={it.id ?? `${it.menu_item_id}-${it.note}`} item={it} qtyClass="text-brand-400" />)}
      </div>
      <div className="px-4 pb-4 pt-2 bg-surface-card border-t border-surface-border">
        <button type="button" onClick={() => onDeliver(order.id)} disabled={delivering}
          className="w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
          {delivering ? <><Spinner className="w-3.5 h-3.5 border-emerald-400/40 border-t-emerald-400" /> Updating…</> : <><Icon name="check" className="w-4 h-4" strokeWidth={2.5} /> Mark Delivered</>}
        </button>
      </div>
    </div>
  );
}
