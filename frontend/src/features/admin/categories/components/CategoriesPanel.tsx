import { useState } from 'react';
import ConfirmDialog from 'components/ui/base/ConfirmDialog';
import EmptyState from 'components/ui/feedback/EmptyState';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { useSortable } from 'hooks/sortable/useSortable';
import { useConfirmAction } from 'hooks/async/useConfirmAction';
import { useMediaQuery } from 'hooks/browser/useMediaQuery';
import type { Category } from 'types/restaurant/catalog';
import { useCategories } from '../hooks/useCategories';
import CategoryRow from './CategoryRow';

const idOf = (c: Category): number => c.id;

export default function CategoriesPanel() {
  const c = useCategories();
  const [name, setName] = useState('');
  const coarse = useMediaQuery('(pointer: coarse)');
  const confirm = useConfirmAction();
  const { getItemProps, draggingId, overId } = useSortable({ items: c.categories, getId: idOf, onReorder: next => { void c.onReorder(next); } });

  const ask = (cat: Category): void => confirm.ask({
    title: 'Delete Category', message: `Delete "${cat.name}"? This cannot be undone. Categories with menu items cannot be deleted.`,
    confirmLabel: 'Delete', danger: true, action: async () => { await c.remove(cat.id); },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {confirm.dialog && <ConfirmDialog {...confirm.dialog} />}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="font-bold text-white text-sm">Menu Categories</h3>
          <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">{c.categories.length}</span>
        </div>
        <form className="rounded-xl border border-surface-border bg-surface-card p-4 mb-4" onSubmit={e => { e.preventDefault(); if (name.trim()) void c.add(name.trim()).then(ok => { if (ok) setName(''); }); }}>
          <h4 className="text-zinc-400 text-xs font-semibold mb-3">Add New Category</h4>
          <div className="flex gap-2">
            <input aria-label="New category name" className="input flex-1" placeholder="e.g. Specials, Combos…" maxLength={60} value={name} onChange={e => setName(e.target.value)} />
            <button type="submit" className="btn btn-brand flex-shrink-0" disabled={c.busy || !name.trim()}>Add</button>
          </div>
        </form>
        <p className="text-zinc-600 text-xs mb-1">Tip: categories cannot be deleted while they contain items. Names must be unique.</p>
        <p className="text-zinc-600 text-[10px]">{coarse ? 'Long-press and drag to reorder' : 'Drag to reorder'}</p>
      </div>
      <div className="space-y-2">
        {c.loading && <PageSpinner />}
        <ErrorNotice error={c.error} onRetry={c.reload} fallback="Could not load categories" />
        {c.categories.map(cat => (
          <CategoryRow key={cat.id} category={cat} count={c.counts.get(cat.id) ?? 0} props={getItemProps(cat.id)} busy={c.busy}
            dragging={draggingId === cat.id} over={overId === cat.id && draggingId !== cat.id} onRename={c.rename} onDelete={ask} />
        ))}
        {!c.loading && !c.error && c.categories.length === 0 && <EmptyState title="No categories yet" />}
      </div>
    </div>
  );
}
