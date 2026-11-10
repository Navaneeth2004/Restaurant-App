import Icon from 'components/ui/base/Icon';
import { DEMO_PLAN_PRICES } from 'config/payment';
import { formatMoney } from 'lib/format/money';
import type { PlanInfo } from 'types/core/subscription';
import { limitRows } from '../../hooks/subscription-view';

interface Props { plan: PlanInfo; current: boolean; sym: string; onChoose: (p: PlanInfo) => void }

function price(slug: string, sym: string): { amount: string; unit: string } {
  const p = DEMO_PLAN_PRICES[slug];
  if (p === undefined) return { amount: 'Contact us', unit: '' };
  return p === 0 ? { amount: 'Free', unit: '' } : { amount: formatMoney(p, sym).replace(/\.00$/, ''), unit: '/ month' };
}

export default function PlanCard({ plan, current, sym, onChoose }: Props) {
  const { amount, unit } = price(plan.slug, sym);
  const out = plan.features_excluded ?? [];
  return (
    <section className={`rounded-xl border p-5 flex flex-col ${current ? 'border-brand-500/50 bg-brand-500/5' : 'border-surface-border bg-surface-card'}`}>
      <h4 className="text-white font-bold text-sm">{plan.name}</h4>
      <p className="mt-2 text-white"><span className="text-3xl font-extrabold tracking-tight">{amount}</span>{unit && <span className="text-zinc-500 text-xs ml-1.5">{unit}</span>}</p>
      {plan.description && <p className="text-zinc-500 text-xs mt-2">{plan.description}</p>}
      <dl className="text-xs mt-4 divide-y divide-surface-border/60 border-t border-surface-border/60">
        {limitRows(plan.limits).map(([label, text]) => (
          <div key={label} className="flex justify-between py-2"><dt className="text-zinc-500">{label}</dt><dd className="text-zinc-200">{text}</dd></div>
        ))}
      </dl>
      <p className="text-zinc-500 text-[11px] mt-2">{out.length === 0 ? 'All features included' : `${out.length} feature${out.length === 1 ? '' : 's'} not included`}</p>
      {out.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {out.map(l => (
            <li key={l} className="flex items-start gap-1.5 text-[11px] text-zinc-500">
              <Icon name="x" className="w-3 h-3 mt-0.5 text-red-400/70 flex-shrink-0" strokeWidth={2.5} />{l}
            </li>
          ))}
        </ul>
      )}
      {current
        ? <p className="mt-5 text-center text-xs font-bold text-brand-400 py-2.5 rounded-xl bg-brand-500/10 border border-brand-500/25">Your current plan</p>
        : <button type="button" className="btn btn-brand w-full mt-5" onClick={() => onChoose(plan)}>Choose plan</button>}
    </section>
  );
}