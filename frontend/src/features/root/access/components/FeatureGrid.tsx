import Toggle from 'components/ui/base/Toggle';
import { groupFeatures, setFeatureOn, setGroupOn } from 'lib/access/feature-groups';
import type { FeatureDef } from 'types/office/root';

interface Props { features: ReadonlyArray<FeatureDef>; disabled: ReadonlyArray<string>; onChange: (next: string[]) => void }

/** Every feature as an on/off switch, grouped, with one switch per group. `disabled` lists what is OFF. */
export default function FeatureGrid({ features, disabled, onChange }: Props) {
  return (
    <div className="space-y-3">
      {groupFeatures(features).map(g => {
        const keys = g.items.map(i => i.key);
        const onCount = keys.filter(k => !disabled.includes(k)).length;
        const allOn = onCount === keys.length;
        return (
          <section key={g.group} className="rounded-lg border border-surface-border bg-surface-raised/40">
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-border">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{g.group}</h4>
              <span className="text-zinc-600 text-[11px]">{onCount} of {keys.length} on</span>
              <span className="ml-auto"><Toggle enabled={allOn} label={`All of ${g.group}`} onChange={() => onChange(setGroupOn(disabled, keys, !allOn))} /></span>
            </div>
            <ul className="divide-y divide-surface-border/60">
              {g.items.map(f => {
                const on = !disabled.includes(f.key);
                return (
                  <li key={f.key} className="flex items-center gap-3 px-4 py-2">
                    <span className={`text-sm flex-1 ${on ? 'text-zinc-200' : 'text-zinc-500'}`}>{f.label}</span>
                    <Toggle enabled={on} label={f.label} onChange={() => onChange(setFeatureOn(disabled, f.key, !on))} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
