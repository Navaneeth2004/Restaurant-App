import { useCallback } from 'react';
import { closeOrder } from 'api/restaurant/orders.api';
import { errorMessage } from 'api/errors';
import { useBusy } from 'hooks/async/useBusy';
import { useToast } from 'state/toast/useToast';
import type { Order, PaymentInput } from 'types/restaurant/orders';

/** Closes the visit. The server closes the whole table session through its LAST order id. Double submit is blocked. */
export function useCloseBill(orders: ReadonlyArray<Order>, onClosed: () => void) {
  const [busy, run] = useBusy();
  const toast = useToast();
  const close = useCallback((input: PaymentInput) => run(async () => {
    const id = orders[orders.length - 1]?.id;
    if (!id) { toast('No order to close', 'error'); return; }
    try {
      await closeOrder(id, input);
      toast('Order closed!', 'success');
      onClosed();
    } catch (e) { toast(errorMessage(e, 'Failed to close the order'), 'error'); }
  }), [orders, run, toast, onClosed]);
  return { busy, close };
}
