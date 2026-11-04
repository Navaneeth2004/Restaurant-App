import EmptyState from 'components/ui/feedback/EmptyState';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import { itemQuantity } from 'lib/orders/cart';
import { useSettings } from 'state/settings/useSettings';
import type { WaiterState } from '../../hooks/useWaiter';
import MenuCard from './MenuCard';

interface Props { w: WaiterState; stepper: boolean; cols: string }

export default function MenuGrid({ w, stepper, cols }: Props) {
  const sym = useSettings().currency_symbol || '₹';
  const { items, loading, error, reload } = w.menu;
  const shown = items.filter(m => m.category_id === w.categoryId);
  return (
    <>
      {error && items.length === 0 ? <ErrorNotice error={error} onRetry={reload} fallback="Could not load the menu" /> : null}
      {!loading && !error && shown.length === 0 && <EmptyState title="No items in this category" />}
      <div className={`grid ${cols} gap-3`}>
        {shown.map(item => (
          <MenuCard key={item.id} item={item} sym={sym} stepper={stepper} qty={itemQuantity(w.carts.cart, item.id)}
            canOrder={!!item.available && !!w.table} onAdd={w.carts.add} onDecrease={w.carts.decrease} />
        ))}
      </div>
    </>
  );
}
