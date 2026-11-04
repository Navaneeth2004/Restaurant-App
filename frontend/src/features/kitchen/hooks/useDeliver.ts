import { useCallback, useState } from 'react';
import { deliverOrder } from 'api/restaurant/orders.api';
import { errorMessage } from 'api/errors';
import { useToast } from 'state/toast/useToast';
import { useIsMounted } from 'hooks/time/useIsMounted';

/** Marks one order delivered. A single id is tracked, so two different orders can't be double-fired from the same card. */
export function useDeliver(onDelivered: (orderId: string) => void) {
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const toast = useToast();
  const mounted = useIsMounted();

  const deliver = useCallback(async (orderId: string) => {
    if (deliveringId) return;
    setDeliveringId(orderId);
    try {
      await deliverOrder(orderId);
      onDelivered(orderId);
      toast('Order delivered', 'success');
    } catch (e) {
      toast(errorMessage(e, 'Could not mark delivered'), 'error');
    } finally {
      if (mounted()) setDeliveringId(null);
    }
  }, [deliveringId, onDelivered, toast, mounted]);

  return { deliveringId, deliver };
}
