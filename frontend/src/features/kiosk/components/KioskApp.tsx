import { useCallback, useState } from 'react';
import ConfirmDialog from 'components/ui/base/ConfirmDialog';
import { addToCart, CartLine, changeQty, setNote } from 'lib/orders/cart';
import { billTotals, parseTaxPercent } from 'lib/orders/bill';
import { formatMoney, sumLines } from 'lib/format/money';
import { countQuantity } from 'lib/orders/order-items';
import type { KioskBoot } from '../hooks/useKioskBoot';
import { useKioskActions } from '../hooks/useKioskActions';
import { useKioskOrders } from '../hooks/useKioskOrders';
import { useKioskPageGuards } from '../hooks/useKioskPageGuards';
import CartBar from './parts/CartBar';
import KioskHeader from './parts/KioskHeader';
import BillScreen from './screens/BillScreen';
import MenuScreen from './screens/MenuScreen';
import MessageScreen from './screens/MessageScreen';
import OrderedScreen from './screens/OrderedScreen';

type View = 'menu' | 'ordered' | 'bill';
interface Ask { title: string; message: string; confirmLabel: string; run: () => void }

export default function KioskApp({ token, boot }: { token: string; boot: KioskBoot }) {
  const { ctx, menu } = boot;
  useKioskPageGuards();
  const live = useKioskOrders(token, ctx, boot.orders);
  const { orders } = live;
  const actions = useKioskActions({ token, sessionId: live.sessionId, accept: live.accept, refetch: live.refetch });

  // Not "bill" on load: the table also reads "waiting for bill" once the kitchen marks food ready,
  // so only a bill this customer asked for in this page counts.
  const [view, setView] = useState<View>(orders.length > 0 ? 'ordered' : 'menu');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);

  const sym = ctx.currency_symbol || '₹';
  const taxPct = parseTaxPercent(ctx.tax_percent);
  const totals = billTotals(orders.reduce((s, o) => s + o.total, 0), taxPct);
  const hasOrders = orders.length > 0;
  const cooking = orders.some(o => o.status === 'active');

  const add = useCallback((item: { id: number; name: string; price: number }) => { setCart(c => addToCart(c, item)); setCartOpen(true); }, []);

  const confirmOrder = (): void => {
    const lines = cart.map(l => `${l.quantity}× ${l.name}`).join(', ');
    setAsk({
      title: hasOrders ? 'Add to Order?' : 'Confirm Your Order', confirmLabel: hasOrders ? 'Add to Order' : 'Place Order',
      message: `Send ${countQuantity(cart)} item${countQuantity(cart) === 1 ? '' : 's'} (${formatMoney(sumLines(cart), sym)}) to the kitchen? ${lines}`,
      run: () => { void actions.placeOrder(cart).then(ok => { if (ok) { setCart([]); setCartOpen(false); setView('ordered'); } }); },
    });
  };
  const confirmBill = (): void => setAsk({
    title: 'Request the Bill?', confirmLabel: 'Request Bill',
    message: `Request the bill for ${formatMoney(totals.total, sym)}? Ask your waiter if you need to add more items afterwards.`,
    run: () => { void actions.requestBill().then(ok => { if (ok) setView('bill'); }); },
  });

  let body;
  if (live.ended) {
    body = <MessageScreen icon="check" tone="ok" title="Thank you!">Your bill has been settled. Hope to see you again!{ctx.bill_footer && <p className="text-zinc-600 text-xs mt-5">{ctx.bill_footer}</p>}</MessageScreen>;
  } else if (view === 'bill') {
    body = <BillScreen ctx={ctx} orders={orders} totals={totals} sym={sym} />;
  } else if (view === 'ordered' && hasOrders && cart.length === 0) {
    body = <OrderedScreen orders={orders} totals={totals} taxPercent={ctx.tax_percent} sym={sym} busy={actions.busy} onAddMore={() => setView('menu')} onRequestBill={confirmBill} />;
  } else {
    body = (
      <>
        <MenuScreen menu={menu} cart={cart} sym={sym} bottomPad={cart.length > 0} onAdd={add}
          banner={hasOrders ? { text: `${cooking ? 'Order in kitchen' : 'Order ready'} — tap to view`, amount: formatMoney(totals.total, sym), onClick: () => setView('ordered') } : undefined} />
        {cart.length > 0 && (
          <CartBar lines={cart} sym={sym} open={cartOpen} busy={actions.busy} hasOrders={hasOrders} onToggle={() => setCartOpen(o => !o)}
            onQty={(i, d) => setCart(c => changeQty(c, i, d))} onNote={(i, n) => setCart(c => setNote(c, i, n))} onPlace={confirmOrder} />
        )}
        {cart.length === 0 && hasOrders && (
          <div className="flex-shrink-0 border-t border-surface-border p-4 pb-6">
            <button type="button" className="btn btn-success w-full py-3" onClick={confirmBill} disabled={actions.busy}>Request Bill</button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="h-[100dvh] max-w-[480px] mx-auto flex flex-col overflow-hidden bg-surface">
      <KioskHeader ctx={ctx} />
      {body}
      {ask && <ConfirmDialog title={ask.title} message={ask.message} confirmLabel={ask.confirmLabel} onCancel={() => setAsk(null)} onConfirm={() => { const run = ask.run; setAsk(null); run(); }} />}
    </div>
  );
}
