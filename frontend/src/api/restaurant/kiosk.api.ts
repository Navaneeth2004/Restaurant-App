import { request } from '../http';
import type { KioskContext, KioskMenu } from 'types/restaurant/kiosk';
import type { NewOrderItem, Order } from 'types/restaurant/orders';

const base = (token: string) => `/kiosk/${encodeURIComponent(token)}`;
const pub = { scope: 'public' } as const;

export const getKioskContext = (token: string, signal?: AbortSignal) => request<KioskContext>(base(token), { ...pub, signal });
export const getKioskMenu = (token: string, signal?: AbortSignal) => request<KioskMenu>(`${base(token)}/menu`, { ...pub, signal });
export const getKioskOrders = (token: string, signal?: AbortSignal) => request<Order[]>(`${base(token)}/orders`, { ...pub, signal });
export const placeKioskOrder = (token: string, items: NewOrderItem[], clientSessionId: string | null) =>
  request<Order>(`${base(token)}/order`, { ...pub, method: 'POST', json: { items, client_session_id: clientSessionId } });
export const requestKioskBill = (token: string, clientSessionId: string | null) =>
  request<void>(`${base(token)}/bill`, { ...pub, method: 'POST', json: { client_session_id: clientSessionId } });
