import { createContext } from 'react';
import type { AdminLockConfig } from './lock-logic';
import { DEFAULT_LOCK } from './lock-logic';

export interface AdminLockValue {
  config: AdminLockConfig;
  isLocked: boolean;
  setConfig: (c: AdminLockConfig) => Promise<void>;
  lock: () => void;
  /** Called when leaving an admin area, so the idle timeout counts from the last visit. */
  touch: () => void;
  /** Resolves true if the admin area may be entered (asks for the PIN if needed). */
  ensureUnlocked: () => Promise<boolean>;
  /** Always asks for the admin PIN (when the lock is enabled) before a sensitive action. */
  requirePin: (onSuccess: () => void, title?: string, subtitle?: string) => void;
}

export const AdminLockContext = createContext<AdminLockValue>({
  config: DEFAULT_LOCK, isLocked: false,
  setConfig: async () => undefined, lock: () => undefined, touch: () => undefined,
  ensureUnlocked: async () => true, requirePin: onSuccess => onSuccess(),
});
