import { useCallback } from 'react';
import { getFeatureAdmin } from 'api/platform/root.api';
import { useAsync } from 'hooks/async/useAsync';

/** Every switchable feature, plus the global switches that are currently off. */
export function useFeatureCatalog() {
  const load = useCallback((s: AbortSignal) => getFeatureAdmin(s), []);
  return useAsync(load);
}
