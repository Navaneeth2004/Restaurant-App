import Icon from 'components/ui/base/Icon';
import type { SortableItemProps } from 'hooks/sortable/useSortable';
import { FEATURE } from 'state/features/feature-keys';
import { useFeatures } from 'state/features/useFeatures';
import type { Table } from 'types/restaurant/tables';

const STATUS: Record<Table['status'], { cls: string; label: string }> = {
  occupied: { cls: 'text-brand-400 bg-brand-500/10 border-brand-500/20', label: 'Occupied' },
  waiting_bill: { cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Bill' },
  empty: { cls: 'text-zinc-500 bg-zinc-800/50 border-zinc-700/50', label: 'Empty' },
};
export { STATUS as TABLE_STATUS_STYLE };

interface Props {
  table: Table; props: SortableItemProps; dragging: boolean; over: boolean;
  onQr: (t: Table) => void; onEdit: (t: Table) => void; onDelete: (t: Table) => void;
}

export default function AdminTableCard({ table, props, dragging, over, onQr, onEdit, onDelete }: Props) {
  const { isOn } = useFeatures();
  const btn = 'w-7 h-7 rounded-lg flex items-center justify-center transition-colors';
  const s = STATUS[table.status];
  return (
    <div {...props} className={`rounded-xl border bg-surface-card select-none transition-colors ${dragging ? 'opacity-30' : ''} ${over ? 'border-brand-500/60 bg-brand-500/5' : 'border-surface-border hover:border-zinc-600'}`} style={{ ...props.style, borderRadius: '0.75rem' }}>
      <div className="p-3 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="w-10 h-10 rounded-xl bg-surface-raised border border-surface-border flex items-center justify-center font-mono font-bold text-sm text-white">{table.id}</div>
          <div className="flex gap-1">
            {isOn(FEATURE.kiosk) && <button type="button" aria-label={`QR code for ${table.label}`} className={`${btn} text-zinc-500 hover:text-brand-400 hover:bg-brand-500/10`} onClick={() => onQr(table)}><Icon name="qr" className="w-3.5 h-3.5" /></button>}
            <button type="button" aria-label={`Edit ${table.label}`} className={`${btn} text-zinc-500 hover:text-white hover:bg-surface-raised`} onClick={() => onEdit(table)}><Icon name="edit" className="w-3.5 h-3.5" /></button>
            <button type="button" aria-label={`Delete ${table.label}`} className={`${btn} text-red-500/40 hover:text-red-400 hover:bg-red-500/10`} onClick={() => onDelete(table)}><Icon name="trash" className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div><p className="text-white text-xs font-semibold leading-tight">{table.label}</p><p className="text-zinc-600 text-[10px] mt-0.5">{table.seats} seats</p></div>
        <span className={`self-start text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
      </div>
    </div>
  );
}