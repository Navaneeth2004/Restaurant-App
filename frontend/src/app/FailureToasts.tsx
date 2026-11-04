import { useEffect } from 'react';
import { WINDOW_EVENTS } from 'config/events';
import { useToast } from 'state/toast/useToast';

/** Turns the http client's 403 `forbidden` event into a toast (the user stays logged in). */
export default function FailureToasts() {
  const toast = useToast();
  useEffect(() => {
    const onForbidden = (): void => toast('You do not have permission to do that.', 'error');
    window.addEventListener(WINDOW_EVENTS.forbidden, onForbidden);
    return () => window.removeEventListener(WINDOW_EVENTS.forbidden, onForbidden);
  }, [toast]);
  return null;
}
