/**
 * views/waiter/TableButton.tsx
 *
 * One table / parcel card in the Waiter screen (used by both the desktop sidebar and the phone list).
 *
 * LAYOUT FIX: the elapsed-time pill now sits in the TOP-RIGHT corner of the card (where the status dot
 * used to be) and the status badge sits alone on the bottom row — so a long time such as "3h 51m"
 * can never be pushed onto a second line. Empty tables still show the little status dot.
 *
 * It lives in its own file (it used to be defined inside WaiterView, which made React rebuild every card
 * on each render).
 */
import React from 'react';
import TableTimer from '../../components/TableTimer';
import type { Table } from '../../types';

const isParcel = (id: string) => /^P\d+$/.test(id);

interface Props {
  table: Table;
  mobile?: boolean;
  selected: boolean;
  onSelect: (t: Table) => void;
  onRemoveParcel: (t: Table) => void;
  onShowQr: (t: Table) => void;
}

export default function TableButton({ table, mobile = false, selected, onSelect, onRemoveParcel, onShowQr }: Props) {
  const parcel   = isParcel(table.id);
  const occupied = !!table.occupied_since && table.status !== 'empty';

  const statusClass = parcel
    ? table.status === 'waiting_bill'
      ? 'border-emerald-500/60 bg-emerald-500/8'
      : table.status === 'occupied'
        ? 'border-indigo-500/60 bg-indigo-500/8'
        : 'border-indigo-500/30 bg-indigo-500/5'
    : table.status === 'occupied'     ? 'border-brand-500/60 bg-brand-500/8'
    : table.status === 'waiting_bill' ? 'border-emerald-500/60 bg-emerald-500/8'
    : 'border-surface-border hover:border-zinc-600';

  const selectedRing = selected ? 'ring-2 ring-brand-500 ring-offset-1 ring-offset-surface-card' : '';

  const dotColor = parcel
    ? table.status === 'waiting_bill' ? 'bg-emerald-400'
      : table.status === 'occupied'  ? 'bg-indigo-400' : 'bg-indigo-800'
    : table.status === 'occupied'     ? 'bg-brand-400'
    : table.status === 'waiting_bill' ? 'bg-emerald-400' : 'bg-zinc-800';

  const badge = parcel
    ? table.status === 'waiting_bill'
      ? { text: 'Bill',   cls: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25' }
      : { text: 'Parcel', cls: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/25' }
    : table.status === 'occupied'
      ? { text: 'Active', cls: 'text-brand-400 bg-brand-500/15 border-brand-500/25' }
      : table.status === 'waiting_bill'
        ? { text: 'Bill',  cls: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25' }
        : { text: 'Empty', cls: 'text-zinc-700 bg-transparent border-zinc-700/40' };

  return (
    <div className="relative group">
      <button
        onClick={() => onSelect(table)}
        className={`w-full rounded-2xl border text-left transition-all cursor-pointer select-none flex flex-col ${
          mobile ? 'p-4 active:scale-95' : 'p-3.5 duration-150'
        } ${statusClass} ${selectedRing}`}
        style={{ minHeight: 108 }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className={`font-mono font-bold leading-none ${mobile ? 'text-2xl' : 'text-xl'} ${parcel ? 'text-indigo-300' : 'text-white'}`}>
              {table.id}
            </div>
            <div className="text-zinc-400 text-xs mt-1.5 truncate leading-snug">{table.label}</div>
          </div>
          <div className="flex-shrink-0">
            {occupied
              ? <TableTimer since={table.occupied_since as string} compact />
              : <span className={`block w-2.5 h-2.5 rounded-full mt-1 ${dotColor}`} />}
          </div>
        </div>

        <div className="mt-auto pt-3">
          <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.text}</span>
        </div>
      </button>

      {/* Parcel slot actions: bottom-right, so they never cover the timer. Always faintly visible on touch screens. */}
      {parcel && (
        <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onShowQr(table); }}
            title="Show QR code"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-500 bg-surface-card/80 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
            </svg>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onRemoveParcel(table); }}
            title="Remove parcel slot"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-zinc-500 bg-surface-card/80 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}