import { useCallback } from 'react';
import { getKioskContext, getKioskMenu, getKioskOrders } from 'api/restaurant/kiosk.api';
import { useAsync } from 'hooks/async/useAsync';
import type { KioskContext, KioskMenu } from 'types/restaurant/kiosk';
import type { Order } from 'types/restaurant/orders';

export interface KioskBoot { ctx: KioskContext; menu: KioskMenu; orders: Order[] }

/** First load of the customer page: the table, its menu and any rounds already ordered. */
export function useKioskBoot(token: string) {
  const load = useCallback(async (signal: AbortSignal): Promise<KioskBoot> => {
    const [ctx, menu, orders] = await Promise.all([getKioskContext(token, signal), getKioskMenu(token, signal), getKioskOrders(token, signal)]);
    return { ctx, menu, orders };
  }, [token]);
  return useAsync(load);
}
