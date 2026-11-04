import Icon from 'components/ui/base/Icon';
import { elapsedLabel, minutesSince } from 'lib/format/local-time';
import type { Addition } from '../hooks/kitchen-state';
import ItemLine from './ItemLine';

interface Props { addition: Addition; nowMs: number; onDismiss: (id: string) => void }

export default function AdditionCard({ addition, nowMs, onDismiss }: Props) {
  return (
    <div className="rounded-xl border border-amber-500/60 overflow-hidden flex flex-col animate-slide-up shadow-lg shadow-amber-500/10">
      <div className="px-4 py-3 flex items-center justify-between bg-amber-500">
        <div className="flex items-center gap-2.5">
          <span className="font-mono font-bold text-white text-2xl leading-none">{addition.tableId}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-100 bg-amber-600/40 px-1.5 py-0.5 rounded">+ Added Items</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-amber-600/60 text-amber-100 whitespace-nowrap">
            <Icon name="clock" className="w-3 h-3 flex-shrink-0" />{elapsedLabel(minutesSince(addition.createdAt, nowMs))}
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => onDismiss(addition.id)} className="w-6 h-6 rounded-full bg-amber-600/40 hover:bg-amber-600/70 flex items-center justify-center text-amber-100 transition-colors">
            <Icon name="x" className="w-3 h-3" strokeWidth={2.5} />
          </button>
        </div>
      </div>
      <div className="px-4 py-3 flex-1 space-y-2.5 bg-surface-card">
        <p className="text-[9px] font-bold uppercase tracking-widest text-amber-500/80 mb-1">New items only — existing order still in progress</p>
        {addition.additions.map((it, i) => <ItemLine key={it.id ?? i} item={it} qtyClass="text-amber-400" />)}
      </div>
      <div className="px-4 pb-4 pt-2 bg-surface-card border-t border-surface-border">
        <button type="button" onClick={() => onDismiss(addition.id)} className="w-full py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
          <Icon name="check" className="w-4 h-4" strokeWidth={2.5} /> Got it — making these now
        </button>
      </div>
    </div>
  );
}
