import { request } from '../http';
import type { SubscriptionInfo } from 'types/core/subscription';

export const getSubscription = (signal?: AbortSignal) => request<SubscriptionInfo>('/auth/subscription', { signal });