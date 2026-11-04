import { useCallback, useEffect, useState } from 'react';
import { ApiError, errorMessage } from 'api/errors';
import { MAX_PIN_LENGTH, MIN_PIN_LENGTH } from 'config/constants';
import { useBusy } from 'hooks/async/useBusy';
import { useTimeouts } from 'hooks/time/useTimeouts';

interface Options {
  /** Resolve true = accepted, false = wrong PIN. Throw ApiError for lockouts, network errors, 409 etc. */
  submit: (pin: string) => Promise<boolean>;
  onAccepted: (pin: string) => void;
}

export interface PinEntry {
  pin: string;
  busy: boolean;
  error: string;
  shake: boolean;
  lockedFor: number;
  digit: (d: string) => void;
  back: () => void;
  confirm: () => void;
}

/** PIN entry state shared by the login screen and PIN dialogs, incl. server lockout countdown (retry_after, SECONDS). */
export function usePinEntry({ submit, onAccepted }: Options): PinEntry {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [lockedFor, setLockedFor] = useState(0);
  const [busy, run] = useBusy();
  const later = useTimeouts();

  const isLocked = lockedFor > 0;
  useEffect(() => {
    if (!isLocked) return undefined;
    const id = setInterval(() => setLockedFor(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [isLocked]);

  const digit = useCallback((d: string) => {
    if (busy || lockedFor > 0) return;
    setError('');
    setPin(p => (p.length >= MAX_PIN_LENGTH ? p : p + d));
  }, [busy, lockedFor]);

  const back = useCallback(() => { if (!busy) setPin(p => p.slice(0, -1)); }, [busy]);

  const confirm = useCallback(() => {
    if (pin.length < MIN_PIN_LENGTH || lockedFor > 0) return;
    void run(async () => {
      try {
        if (await submit(pin)) { onAccepted(pin); return; }
        setError('Incorrect PIN. Try again.');
      } catch (e) {
        setError(errorMessage(e));
        if (e instanceof ApiError && e.isLocked && e.retryAfter) setLockedFor(Math.ceil(e.retryAfter));
      }
      setShake(true);
      later(() => { setPin(''); setShake(false); }, 400);
    });
  }, [pin, lockedFor, run, submit, onAccepted, later]);

  return { pin, busy, error, shake, lockedFor, digit, back, confirm };
}
