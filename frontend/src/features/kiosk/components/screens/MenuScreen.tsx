import { useMemo, useState } from 'react';
import { CartLine } from 'lib/orders/cart';
import type { KioskMenu } from 'types/restaurant/kiosk';
import type { MenuItem } from 'types/restaurant/catalog';
import KioskMenuGrid from '../parts/KioskMenu';

interface Props { menu: KioskMenu; cart: ReadonlyArray<CartLine>; sym: string; bottomPad: boolean; banner?: { text: string; amount: string; onClick: () => void }; onAdd: (item: MenuItem) => void }

export default function MenuScreen({ menu, cart, sym, bottomPad, banner, onAdd }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const catId = picked ?? menu.categories[0]?.id ?? null;
  const items = useMemo(() => menu.items.filter(i => i.category_id === catId), [menu.items, catId]);
  return (
    <>
      <nav aria-label="Categories" className="flex-shrink-0 flex gap-2 overflow-x-auto no-scrollbar px-4 py-2.5 border-b border-surface-border">
        {menu.categories.map(c => (
          <button key={c.id} type="button" onClick={() => setPicked(c.id)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full border text-[13px] font-semibold whitespace-nowrap ${catId === c.id ? 'bg-brand-500 border-brand-600 text-white' : 'border-surface-border text-zinc-500'}`}>
            {c.name}
          </button>
        ))}
      </nav>
      {banner && (
        <button type="button" onClick={banner.onClick} className="flex-shrink-0 w-full px-4 py-2 bg-brand-500/10 border-b border-brand-500/25 flex justify-between text-xs font-semibold text-brand-400">
          <span>{banner.text}</span><span className="font-mono font-bold">{banner.amount}</span>
        </button>
      )}
      <div className={`flex-1 overflow-y-auto min-h-0 p-3 ${bottomPad ? 'pb-4' : ''}`}><KioskMenuGrid items={items} cart={cart} sym={sym} onAdd={onAdd} /></div>
    </>
  );
}
