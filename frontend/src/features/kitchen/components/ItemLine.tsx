import Icon from 'components/ui/base/Icon';
import type { OrderItem } from 'types/restaurant/orders';

interface Props { item: OrderItem; qtyClass: string; struck?: boolean }

export default function ItemLine({ item, qtyClass, struck = false }: Props) {
  const strike = struck ? 'line-through opacity-75' : '';
  return (
    <div className="flex items-start gap-2.5">
      <span className={`font-mono font-bold text-lg leading-none w-8 flex-shrink-0 ${qtyClass} ${struck ? 'line-through' : ''}`}>{item.quantity}×</span>
      <div className="flex-1 min-w-0">
        <p className={`text-white text-sm font-semibold leading-snug ${strike}`}>{item.name}</p>
        {item.note && (
          <p className={`${struck ? 'text-red-400/60' : 'text-amber-400/80'} text-xs mt-0.5 flex items-center gap-1`}>
            {!struck && <Icon name="alert" className="w-3 h-3 flex-shrink-0" />}
            {item.note}
          </p>
        )}
      </div>
    </div>
  );
}
