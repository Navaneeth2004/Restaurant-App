import { Suspense, useCallback, useMemo, useState } from 'react';
import TopBar from 'components/layout/TopBar';
import EmptyState from 'components/ui/feedback/EmptyState';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import LoginScreen from 'features/auth/components/LoginScreen';
import { useAdminLock } from 'state/admin-lock/useAdminLock';
import { useAuth } from 'state/auth/useAuth';
import { PreviousViewContext } from 'state/nav/previous-view';
import { viewsForRole } from './views';

export default function Shell() {
  const { user } = useAuth();
  const { ensureUnlocked, lock, touch, config } = useAdminLock();
  const [selected, setSelected] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);

  const views = useMemo(() => (user ? viewsForRole(user.role) : []), [user]);
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
          <EmptyState title="No screens available for your role in this build" hint="This part of the app has not been migrated yet." />
        )}
      </main>
    </div>
  );
}
