import SectionCard from 'components/ui/base/SectionCard';
import Badge from 'components/ui/feedback/Badge';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import Spinner from 'components/ui/feedback/Spinner';
import { daysLeft, formatDate } from 'lib/format/local-time';
import { limitRows } from '../../hooks/subscription-view';
import { useSubscription } from '../../hooks/useSubscription';

function endText(trialEndsAt: string | null): string {
  if (!trialEndsAt) return 'No end date';
  const left = daysLeft(trialEndsAt) ?? 0;
  return `${formatDate(trialEndsAt)} · ${left <= 0 ? 'ended' : `${left}d left`}`;
}

/** Compact: the restaurant's plan, status, end date and limits, with a link to the plans screen. */
export default function SubscriptionCard({ onPlans }: { onPlans: () => void }) {
  const { data: d, error, reload } = useSubscription();
  return (
    <SectionCard title="Subscription" badge={d?.plan.name} desc="Your current plan and when it ends.">
      <ErrorNotice error={error} onRetry={reload} fallback="Could not load your subscription" />
      {d === null ? (!error && <Spinner className="w-4 h-4 border-zinc-700 border-t-brand-500" />) : (
        <dl className="text-xs divide-y divide-surface-border/60">
          <div className="flex items-center justify-between py-1.5"><dt className="text-zinc-500">Status</dt><dd><Badge tone="green">Active</Badge></dd></div>
          <div className="flex items-center justify-between py-1.5"><dt className="text-zinc-500">Ends</dt><dd className="text-zinc-200">{endText(d.trial_ends_at)}</dd></div>
          {limitRows(d.limits).map(([label, text]) => (
            <div key={label} className="flex items-center justify-between py-1.5"><dt className="text-zinc-500">{label}</dt><dd className="text-zinc-200">{text}</dd></div>
          ))}
        </dl>
      )}
      <button type="button" className="text-xs font-semibold text-brand-400 hover:underline mt-3" onClick={onPlans}>See all plans and prices →</button>
    </SectionCard>
  );
}
