import Icon from 'components/ui/base/Icon';
import Spinner from 'components/ui/feedback/Spinner';
import { CartLine } from 'lib/orders/cart';
import { formatMoney, sumLines } from 'lib/format/money';
import { countQuantity } from 'lib/orders/order-items';

interface Props {
  lines: ReadonlyArray<CartLine>; sym: string; open: boolean; busy: boolean; hasOrders: boolean;
  onToggle: () => void; onQty: (index: number, delta: number) => void; onNote: (index: number, note: string) => void; onPlace: () => void;
}

const stepper = 'w-7 h-7 rounded-lg bg-surface-raised border border-surface-border text-zinc-400 flex items-center justify-center';

export default function CartBar({ lines, sym, open, busy, hasOrders, onToggle, onQty, onNote, onPlace }: Props) {
  return (
    <div className="flex-shrink-0 border-t-2 border-brand-500 bg-surface-card shadow-[0_-6px_32px_rgba(0,0,0,.35)]">
      {open && (
        <div className="max-h-48 overflow-y-auto border-b border-surface-border">
          {lines.map((l, i) => (
            <div key={`${l.menu_item_id}-${i}`} className="px-4 py-2 border-b border-surface-border/60 last:border-0">
              <div className="flex items-center gap-2">
                <button type="button" aria-label={`Remove one ${l.name}`} className={stepper} onClick={() => onQty(i, -1)}><Icon name={l.quantity === 1 ? 'x' : 'minus'} className="w-3 h-3" strokeWidth={2.5} /></button>
                <span className="font-mono font-bold text-white text-xs w-4 text-center">{l.quantity}</span>
                <button type="button" aria-label={`Add one ${l.name}`} className={stepper} onClick={() => onQty(i, 1)}><Icon name="plus" className="w-3 h-3" strokeWidth={2.5} /></button>
                <span className="flex-1 text-white text-xs leading-snug">{l.name}</span>
                <span className="font-mono text-zinc-500 text-[11px]">{formatMoney(l.price * l.quantity, sym)}</span>
              </div>
              <input className="input mt-1.5 py-1 text-[11px]" placeholder="Note (optional)" maxLength={200} value={l.note} onChange={e => onNote(i, e.target.value)} />
            </div>
          ))}
        </div>
      )}
      <div className="flex items-stretch">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex-1 min-w-0 flex items-center gap-2.5 px-4 py-3 text-left">
          <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-brand-500 text-white text-[11px] font-extrabold font-mono flex items-center justify-center">{countQuantity(lines)}</span>
          <span className="flex-1 min-w-0 truncate text-zinc-400 text-xs">{lines.map(l => l.name).join(', ')}</span>
          <Icon name="chevronDown" className={`w-3 h-3 text-zinc-600 transition-transform ${open ? '' : 'rotate-180'}`} />
          <span className="font-mono font-extrabold text-brand-400 text-sm">{formatMoney(sumLines(lines), sym)}</span>
        </button>
        <button type="button" onClick={onPlace} disabled={busy} className="px-5 bg-brand-500 text-white text-[13px] font-extrabold flex items-center gap-2 whitespace-nowrap disabled:opacity-60">
          {busy ? <Spinner /> : hasOrders ? 'Add to Order' : 'Place Order'}
        </button>
      </div>
    </div>
  );
}
