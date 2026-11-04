import Icon from 'components/ui/base/Icon';
import Toggle from 'components/ui/base/Toggle';
import { API_ORIGIN } from 'config/env';
import type { SortableItemProps } from 'hooks/sortable/useSortable';
import { formatMoney } from 'lib/format/money';
import type { MenuItem } from 'types/restaurant/catalog';

interface Props {
  item: MenuItem; sym: string; props: SortableItemProps; dragging: boolean; over: boolean; busy: boolean;
  onToggle: (i: MenuItem) => void; onEdit: (i: MenuItem) => void; onDelete: (i: MenuItem) => void;
}

export default function MenuItemCard({ item, sym, props, dragging, over, busy, onToggle, onEdit, onDelete }: Props) {
  const btn = 'w-7 h-7 rounded-lg flex items-center justify-center transition-colors';
  return (
    <div {...props} className={`rounded-xl border bg-surface-card overflow-hidden transition-colors select-none ${item.available ? '' : 'opacity-60'} ${dragging ? 'border-brand-500/40' : over ? 'border-brand-500' : 'border-surface-border hover:border-zinc-600'}`} style={{ ...props.style, borderRadius: '0.75rem' }}>
      <div className="relative h-36 bg-surface-raised">
        {item.image_path ? <img src={`${API_ORIGIN}${item.image_path}`} alt={item.name} className="w-full h-full object-cover pointer-events-none" /> : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-700"><Icon name="image" className="w-6 h-6" strokeWidth={1} /><span className="text-xs">No image</span></div>)}
        {!item.available && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] font-bold text-white uppercase tracking-widest bg-red-500/80 px-2 py-0.5 rounded-full">Sold Out</span>
          </div>)}
        <div className="absolute top-2 right-2"><Toggle enabled={Boolean(item.available)} label={`${item.name} available`} onChange={() => { if (!busy) onToggle(item); }} /></div>
      </div>
      <div className="p-3 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{item.name}</p>
          {item.description && <p className="text-zinc-500 text-xs mt-0.5 truncate">{item.description}</p>}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="font-mono text-brand-400 text-sm font-semibold">{formatMoney(item.price, sym)}</span>
            <span className="text-zinc-600 text-[10px]">·</span><span className="text-zinc-600 text-[10px]">{item.category_name}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button type="button" aria-label={`Edit ${item.name}`} className={`${btn} text-zinc-500 hover:text-white hover:bg-surface-raised`} onClick={() => onEdit(item)}><Icon name="edit" className="w-3.5 h-3.5" /></button>
          <button type="button" aria-label={`Delete ${item.name}`} className={`${btn} text-red-500/40 hover:text-red-400 hover:bg-red-500/10`} onClick={() => onDelete(item)}><Icon name="trash" className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
