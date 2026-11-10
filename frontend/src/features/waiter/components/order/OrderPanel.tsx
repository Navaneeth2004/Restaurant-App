import Icon from 'components/ui/base/Icon';
import { isParcelTable } from 'lib/input/ids';
import { elapsedLabel, minutesSince } from 'lib/format/local-time';
import Spinner from 'components/ui/feedback/Spinner';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import { useSettings } from 'state/settings/useSettings';
import type { WaiterState } from '../../hooks/useWaiter';
import ActionButtons from './ActionButtons';
import CartList from './CartList';
import OrderRounds from './OrderRounds';
import TotalsBar from './TotalsBar';

/** Green under 30 minutes, amber under an hour, red after that. */
function seatedTone(mins: number): string {
  if (mins < 30) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
  if (mins < 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
  return 'text-red-400 bg-red-500/10 border-red-500/25';
}

export default function OrderPanel({ w }: { w: WaiterState }) {
  const sym = useSettings().currency_symbol || '₹';
  const { table, rounds, carts, actions, orders } = w;
  const hasCart = carts.cart.length > 0;
  const ready = !rounds.active && (rounds.kitchen.length > 0 || rounds.direct.length > 0);

  if (!table) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 px-4">
        <div className="w-10 h-10 rounded-xl border border-surface-border flex items-center justify-center mb-2"><Icon name="cart" className="w-5 h-5 text-zinc-700" strokeWidth={1.5} /></div>
        <p className="text-xs text-center">Select a table or create a parcel slot</p>
      </div>
    );
  }
  const heading = rounds.active ? 'Adding to Current Round' : orders.orders.length > 0 ? `Round ${rounds.kitchen.length + 1} — New Order` : 'New Order';
  const seated = table.status !== 'empty' && table.occupied_since ? minutesSince(table.occupied_since, w.nowMs) : null;
  return (
    <>
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between gap-2 flex-shrink-0">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-white truncate">{isParcelTable(table) ? table.label : `Order — ${table.label}`}</p>
          {seated !== null && (
            <span className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full border ${seatedTone(seated)}`}>
              <Icon name="clock" className="w-2.5 h-2.5" />{isParcelTable(table) ? 'Waiting' : 'Seated'} {elapsedLabel(seated)}
            </span>
          )}
        </div>
        {orders.orders.length > 0 && (
          <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border flex-shrink-0 ${ready ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25' : 'text-brand-400 bg-brand-500/15 border-brand-500/25'}`}>{ready ? 'Ready' : 'Active'}</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {orders.error && orders.orders.length === 0 ? <div className="p-3"><ErrorNotice error={orders.error} onRetry={orders.reload} fallback="Could not load this table's orders" /></div> : null}
        {orders.loading && orders.orders.length === 0 && !orders.error && <div className="flex justify-center py-6"><Spinner className="w-5 h-5 border-zinc-700 border-t-brand-500" /></div>}
        <OrderRounds rounds={rounds} sym={sym} hasCart={hasCart} onCancelItem={actions.cancelItem} onCancelRound={actions.cancelRound} />
        <CartList cart={carts.cart} sym={sym} heading={heading} onQty={carts.changeQty} onNote={carts.setNote} />
        {!hasCart && !orders.loading && orders.orders.length === 0 && !orders.error && <p className="text-xs text-center text-zinc-600 py-8">Tap menu items to add</p>}
      </div>
      <TotalsBar rounds={rounds} sym={sym} cartTotal={w.cartTotal} hasCart={hasCart} grandTotal={w.grandTotal} />
      <ActionButtons busy={actions.busy} hasCart={hasCart} hasTable hasBillable={hasCart || orders.orders.length > 0} hasActiveRound={rounds.active !== null}
        onSend={() => { void actions.sendToKitchen(); }} onBill={() => { void w.openBill(); }} onClear={carts.clear} />
    </>
  );
}