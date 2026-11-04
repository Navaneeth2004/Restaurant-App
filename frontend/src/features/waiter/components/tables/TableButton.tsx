import Icon from 'components/ui/base/Icon';
import { isParcelTable } from 'lib/input/ids';
import type { Table } from 'types/restaurant/tables';
import TableTimer from './TableTimer';

interface Props {
  table: Table; mobile: boolean; selected: boolean; nowMs: number;
  onSelect: (t: Table) => void; onRemoveParcel: (t: Table) => void; onShowQr: (t: Table) => void;
}

const BADGES = {
  bill: { text: 'Bill', cls: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25' },
  parcel: { text: 'Parcel', cls: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/25' },
  active: { text: 'Active', cls: 'text-brand-400 bg-brand-500/15 border-brand-500/25' },
  empty: { text: 'Empty', cls: 'text-zinc-700 bg-transparent border-zinc-700/40' },
} as const;

function look(t: Table, parcel: boolean) {
  const bill = t.status === 'waiting_bill';
  const busy = t.status === 'occupied';
  if (parcel) {
    return {
      frame: bill ? 'border-emerald-500/60 bg-emerald-500/8' : busy ? 'border-indigo-500/60 bg-indigo-500/8' : 'border-indigo-500/30 bg-indigo-500/5',
      dot: bill ? 'bg-emerald-400' : busy ? 'bg-indigo-400' : 'bg-indigo-800',
      badge: bill ? BADGES.bill : BADGES.parcel,
    };
  }
  return {
    frame: busy ? 'border-brand-500/60 bg-brand-500/8' : bill ? 'border-emerald-500/60 bg-emerald-500/8' : 'border-surface-border hover:border-zinc-600',
    dot: busy ? 'bg-brand-400' : bill ? 'bg-emerald-400' : 'bg-zinc-800',
    badge: busy ? BADGES.active : bill ? BADGES.bill : BADGES.empty,
  };
}

export default function TableButton({ table, mobile, selected, nowMs, onSelect, onRemoveParcel, onShowQr }: Props) {
  const parcel = isParcelTable(table);
  const occupied = !!table.occupied_since && table.status !== 'empty';
  const v = look(table, parcel);
  const small = 'w-6 h-6 rounded-lg flex items-center justify-center text-zinc-500 bg-surface-card/80 transition-colors';

  return (
    <div className="relative group">
      <button type="button" onClick={() => onSelect(table)} style={{ minHeight: 108 }} aria-pressed={selected}
        className={`w-full rounded-2xl border text-left transition-all cursor-pointer select-none flex flex-col ${mobile ? 'p-4 active:scale-95' : 'p-3.5 duration-150'} ${v.frame} ${selected ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-surface-card' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className={`font-mono font-bold leading-none ${mobile ? 'text-2xl' : 'text-xl'} ${parcel ? 'text-indigo-300' : 'text-white'}`}>{table.id}</div>
            <div className="text-zinc-400 text-xs mt-1.5 truncate leading-snug">{table.label}</div>
          </div>
          <div className="flex-shrink-0">
            {occupied && table.occupied_since ? <TableTimer since={table.occupied_since} nowMs={nowMs} /> : <span className={`block w-2.5 h-2.5 rounded-full mt-1 ${v.dot}`} />}
          </div>
        </div>
        <div className="mt-auto pt-3">
          <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${v.badge.cls}`}>{v.badge.text}</span>
        </div>
      </button>
      {parcel && (
        <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button type="button" aria-label="Show QR code" onClick={() => onShowQr(table)} className={`${small} hover:text-indigo-400 hover:bg-indigo-500/10`}><Icon name="qr" className="w-3.5 h-3.5" /></button>
          <button type="button" aria-label="Remove parcel slot" onClick={() => onRemoveParcel(table)} className={`${small} hover:text-red-400 hover:bg-red-500/10`}><Icon name="x" className="w-3.5 h-3.5" strokeWidth={2.5} /></button>
        </div>
      )}
    </div>
  );
}
