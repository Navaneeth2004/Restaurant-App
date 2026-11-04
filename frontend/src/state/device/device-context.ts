import { createContext } from 'react';
import type { DeviceStatus } from 'types/core/auth';

export interface DeviceValue {
  /** null until the first answer arrives. */
  status: DeviceStatus | null;
  /** Server unreachable and no answer yet. */
  offline: boolean;
  /** Server text from a restaurant_suspended response, if that is why the device is unlinked. */
  suspendedMessage: string | null;
  refresh: () => void;
}

export const DeviceContext = createContext<DeviceValue>({ status: null, offline: false, suspendedMessage: null, refresh: () => undefined });
