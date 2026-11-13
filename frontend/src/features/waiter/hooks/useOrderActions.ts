import { useCallback, useRef } from 'react';
import { cancelOrder, cancelOrderItem, deliverOrder, directBill, listTableOrders, submitOrder } from 'api/restaurant/orders.api';
import { errorMessage } from 'api/errors';
import { useBusy } from 'hooks/async/useBusy';
import type { ConfirmRequest } from 'hooks/async/useConfirmAction';
import type { CartLine } from 'lib/orders/cart';
import { useToast } from 'state/toast/useToast';
import type { Order } from 'types/restaurant/orders';
import type { Table } from 'types/restaurant/tables';

interface Args {
  table: Table | null;
  cart: ReadonlyArray<CartLine>;
  hasActiveRound: boolean;
  clearCart: () => void;
  refresh: () => void;
  ask: (r: ConfirmRequest) => void;
  onSent: () => void;
}

/** crypto.randomUUID needs a secure context; restaurants often run on plain http inside the LAN. */
const newId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

export function useOrderActions({ table, cart, hasActiveRound, clearCart, refresh, ask, onSent }: Args) {
  const [busy, run] = useBusy();
  const toast = useToast();
  const attempt = useRef<{ sig: string; id: string } | null>(null);

  /** The same cart keeps the same request id until it succeeded, so a retry after a timeout is applied only once. */
  const requestIdFor = (lines: ReadonlyArray<CartLine>): string => {
    const sig = JSON.stringify(lines);
    if (!attempt.current || attempt.current.sig !== sig) attempt.current = { sig, id: newId() };
    return attempt.current.id;
  };

  /** Sends ONLY this device's new items; the server merges them into the table's order. */
  const sendToKitchen = useCallback(() => {
    if (!table || cart.length === 0) { toast('Add items first', 'error'); return Promise.resolve(); }
    return run(async () => {
      try {
        const id = requestIdFor(cart);
        await submitOrder(table.id, cart, id);
        attempt.current = null;
        clearCart();
        toast(`Order sent for ${table.label}`, 'success');
        onSent();
      } catch (e) { toast(errorMessage(e, 'Could not send the order'), 'error'); }
      refresh();
    });
  }, [table, cart, run, clearCart, toast, onSent, refresh]);

  /**
   * Gets the table ready to bill: sends unsent items, delivers a round that is still in the kitchen, then returns
   * the fresh order list for the bill (null if a step failed — whatever did succeed stays on the server and is reloaded).
   */
  const prepareBill = useCallback((): Promise<Order[] | null> => {
    if (!table) return Promise.resolve(null);
    return run(async (): Promise<Order[] | null> => {
      try {
        if (cart.length > 0) {
          const id = requestIdFor(cart);
          await (hasActiveRound ? submitOrder(table.id, cart, id) : directBill(table.id, cart, id));
          attempt.current = null;
          clearCart();
        }
        let orders = await listTableOrders(table.id);
        const stillActive = orders.find(o => o.status === 'active');
        if (stillActive) { await deliverOrder(stillActive.id); orders = await listTableOrders(table.id); }
        return orders.length > 0 ? orders : null;
      } catch (e) {
        toast(errorMessage(e, 'Failed to prepare the bill'), 'error');
        return null;
      } finally { refresh(); }
    }).then(result => result ?? null);
  }, [table, cart, hasActiveRound, run, clearCart, toast, refresh]);

  const cancelItem = useCallback((orderId: string, itemId: number) => ask({
    title: 'Remove Item',
    message: 'This item will be removed and the bill total updated. If it was already sent to the kitchen, they will be notified.',
    confirmLabel: 'Remove Item', danger: true, failureText: 'Could not remove the item',
    action: async () => { await cancelOrderItem(orderId, itemId); toast('Item removed', 'success'); refresh(); },
  }), [ask, toast, refresh]);

  const cancelRound = useCallback((orderId: string) => ask({
    title: 'Cancel Entire Round',
    message: 'All items in this round will be cancelled and removed from the bill.',
    confirmLabel: 'Cancel Round', danger: true, failureText: 'Could not cancel the round',
    action: async () => { await cancelOrder(orderId); toast('Round cancelled', 'success'); refresh(); },
  }), [ask, toast, refresh]);

  return { busy, sendToKitchen, prepareBill, cancelItem, cancelRound };
}
