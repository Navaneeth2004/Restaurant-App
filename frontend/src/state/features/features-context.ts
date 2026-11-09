import { createContext } from 'react';
import type { FeatureKey } from './feature-keys';

export interface FeaturesValue {
  isOn: (key: FeatureKey) => boolean;
  /** True while at least one of the features is on. */
  anyOn: (keys: ReadonlyArray<FeatureKey>) => boolean;
  refresh: () => void;
}

/** Everything is on until the server says a feature is off (so a new feature never disappears by accident). */
export const FeaturesContext = createContext<FeaturesValue>({ isOn: () => true, anyOn: () => true, refresh: () => undefined });
