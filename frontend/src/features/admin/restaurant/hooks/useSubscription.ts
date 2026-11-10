import { useCallback } from 'react';
import { getSubscription } from 'api/access/subscription.api';
import { useAsync } from 'hooks/async/useAsync';

export function useSubscription() {
  const load = useCallback((s: AbortSignal) => getSubscription(s), []);
  return useAsync(load);
}