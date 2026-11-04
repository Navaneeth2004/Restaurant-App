import { useState } from 'react';
import Icon from 'components/ui/base/Icon';
import type { SortableItemProps } from 'hooks/sortable/useSortable';
import type { Category } from 'types/restaurant/catalog';

interface Props {
  category: Category; count: number; props: SortableItemProps; dragging: boolean; over: boolean; busy: boolean;
  onRename: (id: number, name: string) => Promise<boolean>; onDelete: (c: Category) => void;
}

export default function CategoryRow({ category, count, props, dragging, over, busy, onRename, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(category.name);
  const save = async (): Promise<void> => { if (value.trim() && await onRename(category.id, value.trim())) setEditing(false); };
  const icon = 'w-7 h-7 rounded-lg flex items-center justify-center transition-colors';

  return (
    <div {...props} className={`rounded-xl border bg-surface-card px-4 py-3 flex items-center gap-3 transition-colors select-none ${dragging ? 'opacity-30' : ''} ${over ? 'border-brand-500/60 bg-brand-500/5' : 'border-surface-border hover:border-zinc-600'}`} style={{ ...props.style, borderRadius: '0.75rem' }}>
      <span className="flex-shrink-0 text-zinc-600" aria-hidden="true"><Icon name="grip" className="w-4 h-4" /></span>
      {editing ? (
        <>
          <input aria-label="Category name" className="input flex-1 py-1.5 text-sm" value={value} maxLength={60} autoFocus onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false); }} />
          <button type="button" className="btn btn-brand btn-sm" disabled={busy} onClick={() => { void save(); }}>Save</button>
          <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button>
        </>
      ) : (
        <>
          <span className="flex-1 text-white text-sm font-medium">{category.name}</span>
          <span className="text-zinc-600 text-xs font-mono">{count} items</span>
          <button type="button" aria-label={`Rename ${category.name}`} className={`${icon} text-zinc-500 hover:text-white hover:bg-surface-raised`} onClick={() => { setValue(category.name); setEditing(true); }}><Icon name="edit" className="w-3.5 h-3.5" /></button>
          <button type="button" aria-label={`Delete ${category.name}`} className={`${icon} text-red-500/50 hover:text-red-400 hover:bg-red-500/10`} onClick={() => onDelete(category)}><Icon name="trash" className="w-3.5 h-3.5" /></button>
        </>
      )}
    </div>
  );
}
