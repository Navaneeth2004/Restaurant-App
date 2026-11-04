import { API_ORIGIN } from 'config/env';
import Icon from 'components/ui/base/Icon';
import { formatMoney } from 'lib/format/money';
import { itemQuantity, CartLine } from 'lib/orders/cart';
import type { MenuItem } from 'types/restaurant/catalog';

interface Props { items: ReadonlyArray<MenuItem>; cart: ReadonlyArray<CartLine>; sym: string; onAdd: (item: MenuItem) => void }

export default function KioskMenu({ items, cart, sym, onAdd }: Props) {
  if (items.length === 0) return <p className="text-center text-zinc-600 py-10 text-sm">No items in this category</p>;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map(item => {
        const qty = itemQuantity(cart, item.id);
        return (
          <button key={item.id} type="button" onClick={() => onAdd(item)}
            className={`rounded-xl border overflow-hidden text-left transition-colors ${qty > 0 ? 'border-brand-500/60 bg-brand-500/10' : 'border-surface-border bg-surface-card'}`}>
            <div className="relative w-full bg-surface-raised" style={{ paddingTop: '62%' }}>
              {item.image_path
                ? <img src={`${API_ORIGIN}${item.image_path}`} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
                : <div className="absolute inset-0 flex items-center justify-center text-zinc-700"><Icon name="image" className="w-6 h-6" strokeWidth={1} /></div>}
              {qty > 0 && <span className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1 rounded-full bg-brand-500 text-white text-[11px] font-bold font-mono flex items-center justify-center">{qty}</span>}
            </div>
            <div className="p-2.5">
              <p className="text-white text-xs font-semibold leading-snug">{item.name}</p>
              {item.description && <p className="text-zinc-600 text-[10px] mt-0.5 line-clamp-2">{item.description}</p>}
              <p className="font-mono font-bold text-brand-400 text-[13px] mt-1">{formatMoney(item.price, sym)}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
