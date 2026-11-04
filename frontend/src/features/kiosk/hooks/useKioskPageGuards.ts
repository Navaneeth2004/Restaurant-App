import { useEffect } from 'react';

/**
 * A customer's phone: the Back button must not walk out of the ordering page, and a page restored from the
 * browser's back/forward cache is stale, so it is reloaded.
 */
export function useKioskPageGuards(): void {
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const trap = (): void => { window.history.pushState(null, '', window.location.href); };
    const onShow = (e: PageTransitionEvent): void => { if (e.persisted) window.location.reload(); };
    window.addEventListener('popstate', trap);
    window.addEventListener('pageshow', onShow);
    return () => { window.removeEventListener('popstate', trap); window.removeEventListener('pageshow', onShow); };
  }, []);
}
