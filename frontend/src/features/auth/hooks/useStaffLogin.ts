import { useCallback } from 'react';
import { verifyPin } from 'api/access/staff.api';
import { useAuth } from 'state/auth/useAuth';

/** Returns a submit function for usePinEntry. Throws ApiError (409 staffName, 429 locked...) for the entry hook to display. */
export function useStaffLogin(): (pin: string) => Promise<boolean> {
  const { login, currentSessionToken } = useAuth();
  return useCallback(async (pin: string) => {
    const { sessionToken, ...user } = await verifyPin(pin, currentSessionToken());
    login(user, sessionToken);
    return true;
  }, [login, currentSessionToken]);
}
