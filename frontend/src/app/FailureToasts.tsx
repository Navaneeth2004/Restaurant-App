import { useEffect } from 'react';
import type { FailureDetail } from 'api/http';
import { WINDOW_EVENTS } from 'config/events';
import { useToast } from 'state/toast/useToast';

/** Turns the http client's 403 `forbidden` and `feature_disabled` events into a toast (the user stays logged in). */
export default function FailureToasts() {
  const toast = useToast();
  useEffect(() => {
    const onForbidden = (): void => toast('You do not have permission to do that.', 'error');
    const onFeatureOff = (e: Event): void => {
      const detail = (e as CustomEvent<FailureDetail>).detail;
      toast(detail?.message || 'This feature is not available right now.', 'error');
    };
    window.addEventListener(WINDOW_EVENTS.forbidden, onForbidden);
    window.addEventListener(WINDOW_EVENTS.featureDisabled, onFeatureOff);
    return () => {
      window.removeEventListener(WINDOW_EVENTS.forbidden, onForbidden);
      window.removeEventListener(WINDOW_EVENTS.featureDisabled, onFeatureOff);
    };
  }, [toast]);
  return null;
}
