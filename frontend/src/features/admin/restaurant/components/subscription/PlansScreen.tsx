import EmptyState from 'components/ui/feedback/EmptyState';
import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import Spinner from 'components/ui/feedback/Spinner';
import { useSettings } from 'state/settings/useSettings';
import { useToast } from 'state/toast/useToast';
import type { PlanInfo } from 'types/core/subscription';
import { useSubscription } from '../../hooks/useSubscription';
import PlanCard from './PlanCard';

/** Plans and prices. Prices are placeholders and choosing a plan does nothing yet (no billing). */
export default function PlansScreen({ onBack }: { onBack: () => void }) {
  const { data: d, error, reload } = useSubscription();
  const sym = useSettings().currency_symbol || '₹';
  const toast = useToast();
  const choose = (p: PlanInfo): void => toast(`Online plan changes are not available yet. Ask support to move you to ${p.name}.`, 'info');

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3"><button type="button" className="btn btn-sm" onClick={onBack}>← Back</button><h3 className="font-bold text-white text-sm">Plans and prices</h3></div>
      <p className="text-zinc-500 text-xs leading-relaxed">Prices shown here are placeholders. Online payment and plan changes are not available yet.</p>
      <ErrorNotice error={error} onRetry={reload} fallback="Could not load the plans" />
      {d === null ? (!error && <Spinner className="w-5 h-5 border-zinc-700 border-t-brand-500" />) : d.plans.length === 0 ? <EmptyState title="No plans available" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {d.plans.map(p => <PlanCard key={p.slug} plan={p} current={p.slug === d.plan.slug} sym={sym} onChoose={choose} />)}
        </div>
      )}
    </div>
  );
}