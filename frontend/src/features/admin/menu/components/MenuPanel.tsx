import { useState } from 'react';
import ConfirmDialog from 'components/ui/base/ConfirmDialog';
import EmptyState from 'components/ui/feedback/EmptyState';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { useSortable } from 'hooks/sortable/useSortable';
import { useConfirmAction } from 'hooks/async/useConfirmAction';
import { useMediaQuery } from 'hooks/browser/useMediaQuery';
import { useSettings } from 'state/settings/useSettings';
import type { MenuItem } from 'types/restaurant/catalog';
import { useAdminMenu } from '../hooks/useAdminMenu';
import MenuItemCard from './MenuItemCard';
import MenuItemModal from './MenuItemModal';

const idOf = (i: MenuItem): number => i.id;
type Dialog = { item?: MenuItem } | null;

export default function MenuPanel() {
  const m = useAdminMenu();
  const sym = useSettings().currency_symbol || '₹';
  const [dialog, setDialog] = useState<Dialog>(null);
  const coarse = useMediaQuery('(pointer: coarse)');
  const confirm = useConfirmAction();
  const { getItemProps, draggingId, overId } = useSortable({ items: m.shown, getId: idOf, onReorder: next => { void m.onReorder(next); } });

  const ask = (item: MenuItem): void => confirm.ask({
    title: 'Delete Menu Item', message: `Delete "${item.name}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true,
    action: async () => { await m.remove(item.id); },
  });
  const pill = (active: boolean): string => `flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${active ? 'bg-brand-500 text-white border-brand-600' : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'}`;

  return (
    <div>
      {confirm.dialog && <ConfirmDialog {...confirm.dialog} />}
      {dialog && <MenuItemModal item={dialog.item} categories={m.categories} busy={m.busy} onClose={() => setDialog(null)}
        onSave={fd => { void m.save(fd, dialog.item?.id).then(ok => { if (ok) setDialog(null); }); }} />}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-base">Menu Items</h3>
            <span className="text-xs font-semibold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">{m.items.length}</span>
          </div>
          <button type="button" className="btn btn-brand btn-sm" onClick={() => setDialog({})} disabled={m.categories.length === 0} title={m.categories.length === 0 ? 'Add a category first' : undefined}>+ Add Item</button>
        </div>
        <p className="text-zinc-600 text-[10px] mb-2">{coarse ? 'Long-press and drag to reorder' : 'Drag to reorder'}</p>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button type="button" className={pill(m.filter === 'all')} onClick={() => m.setFilter('all')}>All ({m.items.length})</button>
          {m.categories.map(c => <button key={c.id} type="button" className={pill(m.filter === c.id)} onClick={() => m.setFilter(c.id)}>{c.name} ({m.items.filter(i => i.category_id === c.id).length})</button>)}
        </div>
      </div>
      {m.loading && <PageSpinner />}
      <ErrorNotice error={m.error} onRetry={m.reload} fallback="Could not load the menu" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {m.shown.map(item => (
          <MenuItemCard key={item.id} item={item} sym={sym} props={getItemProps(item.id)} busy={m.busy} dragging={draggingId === item.id} over={overId === item.id && draggingId !== item.id}
            onToggle={i => { void m.toggle(i); }} onEdit={i => setDialog({ item: i })} onDelete={ask} />
        ))}
      </div>
      {!m.loading && !m.error && m.shown.length === 0 && <EmptyState title="No items" hint={m.categories.length === 0 ? 'Create a category first, then add items.' : undefined} />}
    </div>
  );
}
