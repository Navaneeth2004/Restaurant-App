import Icon from 'components/ui/base/Icon';
import { formatMoney } from 'lib/format/money';
import type { OrderItem } from 'types/restaurant/orders';

interface Props {
  items: ReadonlyArray<OrderItem>; sym: string; muted?: boolean;
  onCancelItem?: (itemId: number) => void;
}

export default function RoundItems({ items, sym, muted = false, onCancelItem }: Props) {
  return (
    <>
      {items.map((item, i) => (
        <div key={item.id ?? `${item.menu_item_id}-${i}`} className="flex items-center justify-between py-1 gap-2">
          <div className="flex-1 min-w-0">
            <span className={`${muted ? 'text-zinc-400' : 'text-zinc-300'} text-xs font-medium`}>
              <span className={`${muted ? 'text-zinc-500' : 'text-brand-400'} font-bold`}>{item.quantity}×</span> {item.name}
            </span>
            {item.note && <div className="text-zinc-600 text-[10px] italic truncate">{item.note}</div>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-mono text-zinc-500 text-xs">{formatMoney(item.price * item.quantity, sym)}</span>
            {onCancelItem && item.id !== undefined && (
              <button type="button" aria-label={`Remove ${item.name}`} onClick={() => { if (item.id !== undefined) onCancelItem(item.id); }}
                className="w-5 h-5 rounded flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <Icon name="x" className="w-3 h-3" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
