import { useState } from 'react';
import ConfirmDialog from 'components/ui/base/ConfirmDialog';
import EmptyState from 'components/ui/feedback/EmptyState';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { useConfirmAction } from 'hooks/async/useConfirmAction';
import type { Subscription } from 'types/office/root';
import { emptyForm, SubForm, toForm } from '../hooks/subscription-form';
import { useFeatureCatalog } from '../hooks/useFeatureCatalog';
import { useSubscriptions } from '../hooks/useSubscriptions';
import SubscriptionEditor from './SubscriptionEditor';
import SubscriptionRow from './SubscriptionRow';

interface Editing { title: string; slug: string | null; form: SubForm }

/** Subscriptions: choose which screens and features each kind of customer sees. */
export default function SubscriptionsTab() {
  const s = useSubscriptions();
  const catalog = useFeatureCatalog();
  const confirm = useConfirmAction();
  const [editing, setEditing] = useState<Editing | null>(null);
  const ready = s.limitKeys !== null && catalog.data !== null;
  const subs = s.list.data;

  const open = (title: string, slug: string | null, make: (limitKeys: { key: string }[]) => SubForm): void => {
    if (s.limitKeys) setEditing({ title, slug, form: make(s.limitKeys) });
  };
  const askDelete = (sub: Subscription): void => confirm.ask({
    title: 'Delete subscription?', message: `Delete "${sub.name}"? This cannot be undone. A subscription that restaurants still use cannot be deleted.`,
    confirmLabel: 'Delete', danger: true, action: async () => { await s.remove(sub.slug); },
  });

  return (
    <div className="space-y-4">
      {confirm.dialog && <ConfirmDialog {...confirm.dialog} />}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <h2 className="text-white font-bold text-sm">Subscriptions</h2>
          <p className="text-zinc-500 text-xs mt-0.5 max-w-xl leading-relaxed">A subscription decides what a kind of customer can use. Put a restaurant on one in Restaurants → open it → Plan. Changes reach their devices straight away.</p>
        </div>
        <button type="button" className="btn btn-brand btn-sm" disabled={!ready} onClick={() => open('New subscription', null, emptyForm)}>+ New subscription</button>
      </div>
      <ErrorNotice error={s.list.error ?? catalog.error ?? s.configError} onRetry={() => { s.list.reload(); catalog.reload(); }} fallback="Could not load the subscriptions" />
      {subs === null ? (!s.list.error && <PageSpinner />) : subs.length === 0 ? <EmptyState title="No subscriptions yet" /> : (
        <ul className="rounded-xl border border-surface-border bg-surface-card divide-y divide-surface-border overflow-hidden">
          {subs.map(sub => (
            <SubscriptionRow key={sub.slug} sub={sub} totalFeatures={catalog.data?.features.length ?? 0}
              onEdit={() => open(`Edit ${sub.name}`, sub.slug, keys => toForm(sub, keys))}
              onCopy={() => open('New subscription', null, keys => toForm(sub, keys, true))} onDelete={() => askDelete(sub)} />
          ))}
        </ul>
      )}
      {editing && catalog.data && s.limitKeys && (
        <SubscriptionEditor title={editing.title} initial={editing.form} features={catalog.data.features} limitKeys={s.limitKeys} busy={s.busy}
          onClose={() => setEditing(null)} onSave={input => { void s.save(editing.slug, input).then(ok => { if (ok) setEditing(null); }); }} />
      )}
    </div>
  );
}
