import Icon from 'components/ui/base/Icon';
import type { Cancellation } from '../hooks/kitchen-state';
import ItemLine from './ItemLine';

export default function CancellationCard({ cancellation, onDismiss }: { cancellation: Cancellation; onDismiss: (id: string) => void }) {
  const round = cancellation.type === 'round';
  return (
    <div className="rounded-xl border border-red-500/70 overflow-hidden flex flex-col animate-slide-up shadow-lg shadow-red-500/15">
      <div className="px-4 py-3 flex items-center justify-between bg-red-600">
        <div className="flex items-center gap-2.5">
          <span className="font-mono font-bold text-white text-2xl leading-none">{cancellation.tableId}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-red-100 bg-red-700/50 px-1.5 py-0.5 rounded">{round ? 'Round Cancelled' : 'Item Removed'}</span>
        </div>
        <button type="button" aria-label="Dismiss" onClick={() => onDismiss(cancellation.id)} className="w-6 h-6 rounded-full bg-red-700/40 hover:bg-red-700/70 flex items-center justify-center text-red-100 transition-colors">
          <Icon name="x" className="w-3 h-3" strokeWidth={2.5} />
        </button>
      </div>
      <div className="px-4 py-3 flex-1 space-y-2.5 bg-surface-card">
        <p className="text-[9px] font-bold uppercase tracking-widest text-red-400/80 mb-1">{round ? 'Stop making — entire round cancelled' : 'Stop making — this item was removed'}</p>
        {cancellation.items.map((it, i) => <ItemLine key={it.id ?? i} item={it} qtyClass="text-red-400" struck />)}
      </div>
      <div className="px-4 pb-4 pt-2 bg-surface-card border-t border-surface-border">
        <button type="button" onClick={() => onDismiss(cancellation.id)} className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
          <Icon name="check" className="w-4 h-4" strokeWidth={2.5} /> Understood
        </button>
      </div>
    </div>
  );
}
