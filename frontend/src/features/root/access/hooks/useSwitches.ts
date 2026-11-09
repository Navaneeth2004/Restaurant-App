import { useCallback } from 'react';
import { setFeatureSwitch } from 'api/platform/root.api';
import { useToastAction } from 'hooks/async/useToastAction';
import { useFeatureCatalog } from './useFeatureCatalog';

/** Global kill switches: off = no restaurant can use the feature (they see `message`). */
export function useSwitches() {
  const catalog = useFeatureCatalog();
  const { reload } = catalog;
  const { busy, run } = useToastAction();
  const set = useCallback((feature: string, off: boolean, message: string) => run(async () => { await setFeatureSwitch(feature, off, message); reload(); },
    { success: off ? 'Switched off for every restaurant.' : 'Switched back on.', failure: 'Could not change the switch' }), [run, reload]);
  return { catalog, busy, set };
}
