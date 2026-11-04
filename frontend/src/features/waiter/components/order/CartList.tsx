import { formatMoney } from 'lib/format/money';
import type { CartLine } from 'lib/orders/cart';

interface Props {
  cart: ReadonlyArray<CartLine>; sym: string; heading: string;
  onQty: (index: number, delta: number) => void; onNote: (index: number, note: string) => void;
}

export default function CartList({ cart, sym, heading, onQty, onNote }: Props) {
  if (cart.length === 0) return null;
  const step = 'w-6 h-6 rounded-lg bg-surface-raised border border-surface-border text-zinc-400 hover:text-white flex items-center justify-center text-sm';
  return (
    <div className="divide-y divide-surface-border">
      <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-brand-400">{heading}</span>
      </div>
      {cart.map((item, idx) => (
        <div key={`${item.menu_item_id}-${idx}`} className="px-3 py-2.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold">{item.name}</p>
              <p className="font-mono text-brand-400 text-xs mt-0.5">{formatMoney(item.price * item.quantity, sym)}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button type="button" aria-label={`Fewer ${item.name}`} className={step} onClick={() => onQty(idx, -1)}>−</button>
              <span className="font-mono text-white text-xs w-4 text-center">{item.quantity}</span>
              <button type="button" aria-label={`More ${item.name}`} className={step} onClick={() => onQty(idx, 1)}>+</button>
            </div>
          </div>
          <input aria-label={`Note for ${item.name}`} placeholder="Note, e.g. no onions" value={item.note} onChange={e => onNote(idx, e.target.value)}
            className="mt-1.5 w-full bg-surface-raised border border-surface-border rounded-lg px-2 py-1 text-[11px] text-zinc-300 placeholder-zinc-600 outline-none focus:border-brand-500/50" />
        </div>
      ))}
    </div>
  );
}
