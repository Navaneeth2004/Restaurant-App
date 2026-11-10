import { DEMO_PLAN_PRICES } from 'config/payment';
import { formatMoney } from 'lib/format/money';
import type { PlanInfo } from 'types/core/subscription';
import { limitRows } from '../../hooks/subscription-view';

interface Props { plan: PlanInfo; current: boolean; sym: string; onChoose: (p: PlanInfo) => void }

function priceText(slug: string, sym: string): string {
  const price = DEMO_PLAN_PRICES[slug];
  if (price === undefined) return 'Contact us';
  return price === 0 ? 'Free' : `${formatMoney(price, sym)} / month`;
}

export default function PlanCard({ plan, current, sym, onChoose }: Props) {
  return (
    <section className={`rounded-xl border p-4 flex flex-col ${current ? 'border-brand-500/50 bg-brand-500/5' : 'border-surface-border bg-surface-card'}`}>
      <div className="flex items-center gap-2"><h4 className="text-white font-bold text-sm">{plan.name}</h4>{current && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/25">Current</span>}</div>
      <p className="font-mono font-bold text-white text-lg mt-1">{priceText(plan.slug, sym)}</p>
      {plan.description && <p className="text-zinc-500 text-xs mt-1">{plan.description}</p>}
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-xs mt-3">
        {limitRows(plan.limits).map(([label, text]) => (
          <div key={label} className="contents"><dt className="text-zinc-500">{label}</dt><dd className="text-zinc-200 text-right">{text}</dd></div>
        ))}
      </dl>
      <p className="text-zinc-500 text-[11px] mt-2">{plan.features_off === 0 ? 'All features included' : `${plan.features_off} feature${plan.features_off === 1 ? '' : 's'} not included`}</p>
      <button type="button" className="btn btn-brand btn-sm w-full pt-0 mt-4" disabled={current} onClick={() => onChoose(plan)}>{current ? 'Current plan' : 'Choose plan'}</button>
    </section>
  );
}