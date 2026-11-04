import SectionCard from 'components/ui/base/SectionCard';
import { LIMITS, OVERDUE_PRESETS } from 'config/constants';
import { clampField } from '../../hooks/settings-form';
import type { SettingsFormState } from '../../hooks/useSettingsForm';

export default function OverdueSection({ s }: { s: SettingsFormState }) {
  const { form, set } = s;
  const current = Number.parseInt(form.kitchen_overdue_mins, 10);
  return (
    <SectionCard title="Kitchen Overdue Threshold" desc="How long an order sits in the Kitchen Display before it's flagged as overdue.">
      <div className="grid grid-cols-3 gap-2 mb-3">
        {OVERDUE_PRESETS.map(n => (
          <button key={n} type="button" aria-pressed={current === n} onClick={() => set('kitchen_overdue_mins', String(n))}
            className={`py-2 rounded-lg border text-xs font-semibold transition-all ${current === n ? 'bg-brand-500 border-brand-600 text-white' : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'}`}>{n}m</button>
        ))}
      </div>
      <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-raised border border-surface-border">
        <label htmlFor="rs-overdue" className="text-zinc-500 text-xs flex-shrink-0">Custom</label>
        <input id="rs-overdue" type="number" min={LIMITS.overdueMin} max={LIMITS.overdueMax} className="input py-1.5 text-xs font-mono flex-1" value={form.kitchen_overdue_mins}
          onChange={e => { const v = clampField(e.target.value, LIMITS.overdueMin, LIMITS.overdueMax); if (v !== null) set('kitchen_overdue_mins', v); }} />
        <span className="text-zinc-500 text-xs flex-shrink-0">minutes</span>
      </div>
    </SectionCard>
  );
}
