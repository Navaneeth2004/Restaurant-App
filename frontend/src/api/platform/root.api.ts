import { buildUrl, request } from '../http';
import type {
  AuditRow, CreatedRestaurant, FeatureAdmin, NewRestaurantInput, RestaurantDetail, RestaurantPatch, RestaurantSummary, RootConfig, RootOverview,
  Subscription, SubscriptionInput, TicketDetail, TicketFilter, TicketRow,
} from 'types/office/root';
import type { TicketStatus } from 'types/office/support';

/** Root console (platform operator). Its own cookie; a 401 here fires `root-auth-lost` (see api/http.ts). */
const get = <T>(path: string, query?: Record<string, string>, signal?: AbortSignal) => request<T>(`/root${path}`, { scope: 'root', query, signal });
const send = <T>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', json?: unknown) => request<T>(`/root${path}`, { scope: 'root', method, json });

export const rootLogin = (phone: string, password: string) => send<{ phone: string }>('/login', 'POST', { phone, password });
export const rootLogout = () => send<{ success: boolean }>('/logout', 'POST');
export const rootMe = (signal?: AbortSignal) => get<{ phone: string }>('/me', undefined, signal);
export const rootConfig = (signal?: AbortSignal) => get<RootConfig>('/config', undefined, signal);
export const rootOverview = (signal?: AbortSignal) => get<RootOverview>('/overview', undefined, signal);
export const rootAudit = (signal?: AbortSignal) => get<AuditRow[]>('/audit', undefined, signal);

export const listRestaurants = (signal?: AbortSignal) => get<RestaurantSummary[]>('/restaurants', undefined, signal);
export const getRestaurant = (id: string, signal?: AbortSignal) => get<RestaurantDetail>(`/restaurants/${id}`, undefined, signal);
export const createRestaurant = (body: NewRestaurantInput) => send<CreatedRestaurant>('/restaurants', 'POST', body);
export const patchRestaurant = (id: string, body: RestaurantPatch) => send<RestaurantDetail>(`/restaurants/${id}`, 'PATCH', body);
export const suspendRestaurant = (id: string, reason: string) => send<{ success: boolean }>(`/restaurants/${id}/suspend`, 'POST', { reason });
export const activateRestaurant = (id: string) => send<{ success: boolean }>(`/restaurants/${id}/activate`, 'POST');
export const revokeRestaurantDevices = (id: string) => send<{ success: boolean; revoked: number }>(`/restaurants/${id}/revoke-devices`, 'POST');
/** Empty password = the server generates one and returns it (shown once). */
export const resetOwnerPassword = (id: string, password?: string) => send<{ success: boolean; temp_password: string | null }>(`/restaurants/${id}/owner-password`, 'POST', password ? { password } : {});
export const deleteRestaurant = (id: string, confirmName: string, password: string) => send<{ success: boolean }>(`/restaurants/${id}`, 'DELETE', { confirm_name: confirmName, password });

/** Subscriptions and feature switches: what each kind of customer may use. */
export const getFeatureAdmin = (signal?: AbortSignal) => get<FeatureAdmin>('/features', undefined, signal);
export const setFeatureSwitch = (feature: string, off: boolean, message: string) => send<{ success: boolean }>(`/features/${encodeURIComponent(feature)}`, 'PUT', { off, message });
export const listSubscriptions = (signal?: AbortSignal) => get<Subscription[]>('/subscriptions', undefined, signal);
export const createSubscription = (body: SubscriptionInput) => send<Subscription>('/subscriptions', 'POST', body);
export const updateSubscription = (slug: string, body: SubscriptionInput) => send<Subscription>(`/subscriptions/${encodeURIComponent(slug)}`, 'PUT', body);
export const deleteSubscription = (slug: string) => send<{ success: boolean }>(`/subscriptions/${encodeURIComponent(slug)}`, 'DELETE');

export const listTickets = (f: TicketFilter, signal?: AbortSignal) =>
  get<TicketRow[]>('/tickets', { ...(f.status !== 'all' ? { status: f.status } : {}), ...(f.severity ? { severity: f.severity } : {}), ...(f.q ? { q: f.q } : {}), ...(f.restaurant ? { restaurant: f.restaurant } : {}) }, signal);
export const getTicket = (id: number, signal?: AbortSignal) => get<TicketDetail>(`/tickets/${id}`, undefined, signal);
export const updateTicket = (id: number, body: { status: TicketStatus; root_note: string }) => send<{ success: boolean }>(`/tickets/${id}`, 'PATCH', body);
/** An <img> URL: the browser sends the root cookie itself. */
export const ticketScreenshotUrl = (id: number): string => buildUrl(`/root/tickets/${id}/screenshot`);
