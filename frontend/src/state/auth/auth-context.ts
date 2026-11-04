import { createContext } from 'react';
import type { AuthUser } from 'types/core/auth';
import type { EndReason } from './session-store';

export interface AuthValue {
  user: AuthUser | null;
  /** Set when a session ended without the user asking (replaced, expired, deactivated, PIN changed). */
  sessionEnded: boolean;
  /** Why it ended, as far as the client can know (see endReason). */
  sessionEndReason: EndReason | null;
  login: (user: AuthUser, sessionToken: string) => void;
  logout: () => Promise<void>;
  dismissSessionEnded: () => void;
  currentSessionToken: () => string | null;
}

export const AuthContext = createContext<AuthValue>({
  user: null, sessionEnded: false, sessionEndReason: null,
  login: () => undefined, logout: async () => undefined, dismissSessionEnded: () => undefined, currentSessionToken: () => null,
});
