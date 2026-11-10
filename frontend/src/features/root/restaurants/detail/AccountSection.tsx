import ChoicePills from 'components/ui/base/ChoicePills';
import Spinner from 'components/ui/feedback/Spinner';
import type { RestaurantDetail, RootConfig } from 'types/office/root';
import { Field, Section } from '../../ui/Layout';
import type { DetailForm } from '../hooks/patch';

interface Props {
  data: RestaurantDetail; config: RootConfig; form: DetailForm; onChange: (f: DetailForm) => void; problem: string | null; busy: boolean; onSave: () => void;
}

export default function AccountSection({ data, config, form, onChange, problem, busy, onSave }: Props) {
  const set = (patch: Partial<DetailForm>): void => onChange({ ...form, ...patch });
  return (
    <Section title="Account">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Name (your label)" htmlFor="rd-name"><input id="rd-name" className="input" value={form.name} onChange={e => set({ name: e.target.value })} /></Field>
        <Field label="Plan" htmlFor="rd-plan"><ChoicePills label="Plan" options={config.plans.map(p => ({ value: p, label: p }))} value={form.plan} onChange={plan => set({ plan })} /></Field>
        <Field label="Trial ends" htmlFor="rd-trial" hint={config.enforce_trial ? 'Trial limits are being enforced.' : 'Not enforced yet (ENFORCE_TRIAL=false).'}>
          <input id="rd-trial" className="input" type="date" value={form.trialEnds} onChange={e => set({ trialEnds: e.target.value })} /></Field>
        <Field label="Private notes" htmlFor="rd-notes"><textarea id="rd-notes" className="input resize-none" rows={2} value={form.notes} onChange={e => set({ notes: e.target.value })} /></Field>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-4 mb-2">Limits (blank = use the plan default / unlimited)</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {config.limit_keys.map(k => (
          <Field key={k.key} label={k.label} htmlFor={`rd-${k.key}`} hint={`Plan default: ${config.plan_defaults[form.plan]?.[k.key] ?? 'unlimited'} · in effect: ${data.limits_effective[k.key] ?? 'unlimited'}`}>
            <input id={`rd-${k.key}`} className="input font-mono" type="number" min={0} value={form.limits[k.key] ?? ''} onChange={e => set({ limits: { ...form.limits, [k.key]: e.target.value } })} />
          </Field>
        ))}
      </div>
      {problem && <p role="alert" className="text-red-400 text-xs mt-3">{problem}</p>}
      <button type="button" className="btn btn-brand btn-sm mt-4" onClick={onSave} disabled={busy || !!problem}>{busy ? <><Spinner />Saving…</> : 'Save changes'}</button>
    </Section>
  );
}
