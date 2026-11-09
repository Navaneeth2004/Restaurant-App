import { useCallback } from 'react';
import { createSubscription, deleteSubscription, listSubscriptions, rootConfig, updateSubscription } from 'api/platform/root.api';
import { useAsync } from 'hooks/async/useAsync';
import { useToastAction } from 'hooks/async/useToastAction';
import type { SubscriptionInput } from 'types/office/root';

/** The subscription list plus create / edit / delete. `slug` null = a new subscription. */
export function useSubscriptions() {
  const loadList = useCallback((s: AbortSignal) => listSubscriptions(s), []);
  const loadConfig = useCallback((s: AbortSignal) => rootConfig(s), []);
  const list = useAsync(loadList);
  const config = useAsync(loadConfig);
  const { reload } = list;
  const { busy, run } = useToastAction();

  const save = useCallback((slug: string | null, input: SubscriptionInput) => run(async () => {
    if (slug === null) await createSubscription(input); else await updateSubscription(slug, input);
    reload();
  }, { success: 'Subscription saved.', failure: 'Could not save the subscription' }), [run, reload]);

  const remove = useCallback((slug: string) => run(async () => { await deleteSubscription(slug); reload(); },
    { success: 'Subscription deleted.', failure: 'Could not delete the subscription' }), [run, reload]);

  return { list, limitKeys: config.data?.limit_keys ?? null, configError: config.error, busy, save, remove };
}
