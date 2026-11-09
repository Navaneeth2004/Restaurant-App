import { Suspense, useCallback, useMemo, useState } from 'react';
import TopBar from 'components/layout/TopBar';
import EmptyState from 'components/ui/feedback/EmptyState';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import LoginScreen from 'features/auth/components/LoginScreen';
import { useAdminLock } from 'state/admin-lock/useAdminLock';
import { useAuth } from 'state/auth/useAuth';
import { useFeatures } from 'state/features/useFeatures';
import { PreviousViewContext } from 'state/nav/previous-view';
import { viewsForRole } from './views';

export default function Shell() {
  const { user } = useAuth();
  const { anyOn } = useFeatures();
  const { ensureUnlocked, lock, touch, config } = useAdminLock();
  const [selected, setSelected] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);

  // A screen root switched off disappears; if it was the open one, `current` falls back to the first screen left.
  const views = useMemo(() => (user ? viewsForRole(user.role).filter(v => anyOn(v.features)) : []), [user, anyOn]);
  const current = views.find(v => v.key === selected) ?? views[0] ?? null;

  const select = useCallback(async (key: string) => {
    const target = views.find(v => v.key === key);
    if (!target) return;
    if (target.adminLocked && !(await ensureUnlocked())) return;
    if (current?.adminLocked && !target.adminLocked) {
      touch();
      if (config.timeout_mins === 0) lock(); // "Always ask": lock as soon as admin is left
    }
    if (key !== current?.key) setPrevious(current?.key ?? null);
    setSelected(key);
  }, [views, current, ensureUnlocked, touch, lock, config.timeout_mins]);

  if (!user) return <LoginScreen />;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface">
      <TopBar items={views.map(v => ({ key: v.key, label: v.label, locked: !!v.adminLocked }))} active={current?.key ?? ''} onSelect={k => { void select(k); }} />
      <main className="flex-1 overflow-hidden">
        {current ? (
          <PreviousViewContext.Provider value={previous}><Suspense fallback={<PageSpinner />}><current.Component /></Suspense></PreviousViewContext.Provider>
        ) : (
          <EmptyState title="No screens are available for your account right now" hint="Some screens are switched off for this restaurant. Contact support if this is a mistake." />
        )}
      </main>
    </div>
  );
}
