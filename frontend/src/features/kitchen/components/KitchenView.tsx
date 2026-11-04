import { useCallback } from 'react';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import Icon from 'components/ui/base/Icon';
import { DEFAULT_OVERDUE_MINS } from 'config/constants';
import { useNow } from 'hooks/time/useNow';
import { minutesSince } from 'lib/format/local-time';
import { useSettings } from 'state/settings/useSettings';
import { useDeliver } from '../hooks/useDeliver';
import { useKitchenOrders } from '../hooks/useKitchenOrders';
import AdditionCard from './AdditionCard';
import CancellationCard from './CancellationCard';
import KitchenHeader from './KitchenHeader';
import OrderCard from './OrderCard';

export default function KitchenView() {
  const { orders, additions, cancellations, loading, error, reload, dispatch } = useKitchenOrders();
  const settings = useSettings();
  const nowMs = useNow(15_000);
  const overdueMins = Number.parseInt(settings.kitchen_overdue_mins ?? '', 10) || DEFAULT_OVERDUE_MINS;

  const delivered = useCallback((orderId: string) => dispatch({ type: 'delivered', orderId }), [dispatch]);
  const { deliveringId, deliver } = useDeliver(delivered);

  const overdue = orders.filter(o => minutesSince(o.created_at, nowMs) > overdueMins).length;
  const empty = orders.length === 0 && additions.length === 0 && cancellations.length === 0;

  if (loading && orders.length === 0 && !error) return <PageSpinner />;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <KitchenHeader active={orders.length} additions={additions.length} cancellations={cancellations.length} overdue={overdue} nowMs={nowMs} />
      <div className="flex-1 overflow-y-auto p-4">
        {error ? <div className="mb-4"><ErrorNotice error={error} onRetry={reload} fallback="Could not load orders" /></div> : null}
        {empty && !error ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-500">
              <Icon name="check" className="w-9 h-9" strokeWidth={1.5} />
            </div>
            <p className="font-bold text-white text-lg">All caught up</p>
            <p className="text-zinc-500 text-sm mt-1">No active orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {cancellations.map(c => <CancellationCard key={c.id} cancellation={c} onDismiss={id => dispatch({ type: 'dismiss-cancellation', id })} />)}
            {additions.map(a => <AdditionCard key={a.id} addition={a} nowMs={nowMs} onDismiss={id => dispatch({ type: 'dismiss-addition', id })} />)}
            {orders.map(o => <OrderCard key={o.id} order={o} nowMs={nowMs} overdueMins={overdueMins} delivering={deliveringId === o.id} onDeliver={id => { void deliver(id); }} />)}
          </div>
        )}
      </div>
    </div>
  );
}
