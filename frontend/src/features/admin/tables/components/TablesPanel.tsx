import { useState } from 'react';
import Icon from 'components/ui/base/Icon';
import ConfirmDialog from 'components/ui/base/ConfirmDialog';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { useSortable } from 'hooks/sortable/useSortable';
import { useConfirmAction } from 'hooks/async/useConfirmAction';
import { useMediaQuery } from 'hooks/browser/useMediaQuery';
import TableQrModal from 'features/qr/components/TableQrModal';
import type { Table } from 'types/restaurant/tables';
import { useAdminTables } from '../hooks/useAdminTables';
import AdminTableCard, { TABLE_STATUS_STYLE } from './AdminTableCard';
import TableFormModal from './TableFormModal';

const idOf = (t: Table): string => t.id;
type Dialog = { kind: 'add' } | { kind: 'edit'; table: Table } | null;

export default function TablesPanel() {
  const t = useAdminTables();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [qr, setQr] = useState<Table | null>(null);
  const coarse = useMediaQuery('(pointer: coarse)');
  const confirm = useConfirmAction();
  const { getItemProps, draggingId, overId } = useSortable({ items: t.tables, getId: idOf, onReorder: next => { void t.onReorder(next); } });

  const ask = (table: Table): void => confirm.ask({
    title: 'Delete Table',
    message: `Delete "${table.label}"? A table with order history is archived: it disappears from this list but its past orders stay in reports.`,
    confirmLabel: 'Delete', danger: true, action: async () => { await t.remove(table.id); },
  });
  const save = async (f: { label: string; seats: number }): Promise<void> => {
    const ok = dialog?.kind === 'edit' ? await t.edit(dialog.table.id, f) : await t.add(f);
    if (ok) setDialog(null);
  };
  const counts = (['occupied', 'waiting_bill', 'empty'] as const).map(k => ({ k, n: t.tables.filter(x => x.status === k).length })).filter(c => c.n > 0);

  return (
    <div>
      {confirm.dialog && <ConfirmDialog {...confirm.dialog} />}
      {qr && <TableQrModal table={qr} onClose={() => setQr(null)} />}
      {dialog && <TableFormModal table={dialog.kind === 'edit' ? dialog.table : undefined} defaultLabel={t.nextLabel} busy={t.busy} onSave={f => { void save(f); }} onClose={() => setDialog(null)} />}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-base">Tables</h3>
            <span className="text-xs font-semibold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">{t.tables.length} total</span>
          </div>
          <button type="button" className="btn btn-brand btn-sm" onClick={() => setDialog({ kind: 'add' })}>+ Add Table</button>
        </div>
        <p className="text-zinc-600 text-[10px] mb-2">{coarse ? 'Long-press and drag to reorder · tap QR to get the customer ordering link' : 'Drag to reorder · click QR to get the customer ordering link'}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {counts.map(c => <span key={c.k} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TABLE_STATUS_STYLE[c.k].cls}`}>{c.n} {TABLE_STATUS_STYLE[c.k].label}</span>)}
        </div>
      </div>
      {t.loading && <PageSpinner />}
      <ErrorNotice error={t.error} onRetry={t.reload} fallback="Could not load tables" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {t.tables.map(table => (
          <AdminTableCard key={table.id} table={table} props={getItemProps(table.id)} dragging={draggingId === table.id} over={overId === table.id && draggingId !== table.id}
            onQr={setQr} onEdit={x => setDialog({ kind: 'edit', table: x })} onDelete={ask} />
        ))}
        <button type="button" onClick={() => setDialog({ kind: 'add' })} className="rounded-xl border-2 border-dashed border-surface-border hover:border-brand-500/40 p-4 flex flex-col items-center justify-center gap-2 text-zinc-600 hover:text-zinc-400 transition-all min-h-[120px]">
          <Icon name="plus" className="w-6 h-6" strokeWidth={1.5} /><span className="text-xs">Add Table</span>
        </button>
      </div>
    </div>
  );
}
