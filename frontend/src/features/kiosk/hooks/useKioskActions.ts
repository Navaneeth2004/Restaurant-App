import { useCallback } from 'react';
import { placeKioskOrder, requestKioskBill } from 'api/restaurant/kiosk.api';
import { errorMessage, isApiError } from 'api/errors';
import { useBusy } from 'hooks/async/useBusy';
import { useTimeouts } from 'hooks/time/useTimeouts';
import { useToast } from 'state/toast/useToast';
import type { NewOrderItem, Order } from 'types/restaurant/orders';

interface Args {
  token: string;
  sessionId: () => string | null;
  accept: (order: Order) => void;
  refetch: () => Promise<Order[]>;
}

const RELOAD_DELAY_MS = 1200;

/** The two things a customer can do. Both resolve true on success, never run twice at once. */
export function useKioskActions({ token, sessionId, accept, refetch }: Args) {
  const toast = useToast();
  const later = useTimeouts();
  const [busy, run] = useBusy();

  const guard = useCallback(async (fn: () => Promise<void>, failure: string): Promise<boolean> => {
    const done = await run(async () => {
      try { await fn(); return true; }
      catch (e) {
        if (isApiError(e) && e.sessionChanged) {
          toast('This table has changed — refreshing…', 'info');
          later(() => window.location.reload(), RELOAD_DELAY_MS);
        } else toast(errorMessage(e, failure), 'error');
        return false;
      }
    });
    return done === true;
  }, [run, toast, later]);

  const placeOrder = useCallback((items: NewOrderItem[]) => guard(async () => {
    accept(await placeKioskOrder(token, items, sessionId()));
    await refetch();
    toast('Order sent to the kitchen', 'success');
  }, 'Failed to place the order'), [guard, token, sessionId, accept, refetch, toast]);

  const requestBill = useCallback(() => guard(async () => {
    await requestKioskBill(token, sessionId());
    await refetch();
  }, 'Failed to request the bill'), [guard, token, sessionId, refetch]);

  return { busy, placeOrder, requestBill };
}
