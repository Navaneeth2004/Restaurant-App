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
  return `${formatDate(trialEndsAt)} (${left <= 0 ? 'ended' : `${left} day${left === 1 ? '' : 's'} left`})`;
}

/** The restaurant's own plan, status, end date and limits, with a link to the plans screen. */
export default function SubscriptionCard({ onPlans }: { onPlans: () => void }) {
  const { data: d, error, reload } = useSubscription();
  return (
    <SectionCard title="Subscription" badge={d?.plan.name} desc="Your current plan, its status and when it ends.">
      <ErrorNotice error={error} onRetry={reload} fallback="Could not load your subscription" />
      {d === null ? (!error && <Spinner className="w-4 h-4 border-zinc-700 border-t-brand-500" />) : (
        <dl className="grid grid-cols-[auto,1fr] gap-x-5 gap-y-1.5 text-xs">
          <dt className="text-zinc-500">Plan</dt><dd className="text-zinc-200 text-right">{d.plan.name}</dd>
          <dt className="text-zinc-500">Status</dt><dd className="text-right"><Badge tone="green">Active</Badge></dd>
          <dt className="text-zinc-500">Ends</dt><dd className="text-zinc-200 text-right">{endText(d.trial_ends_at)}</dd>
          {limitRows(d.limits).map(([label, text]) => (
            <div key={label} className="contents"><dt className="text-zinc-500">{label}</dt><dd className="text-zinc-200 text-right">{text}</dd></div>
          ))}
        </dl>
      )}
      <button type="button" className="text-xs text-brand-400 hover:underline mt-3" onClick={onPlans}>See all plans and prices</button>
    </SectionCard>
  );
}