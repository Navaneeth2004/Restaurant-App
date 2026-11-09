import ErrorNotice from 'components/ui/feedback/ErrorNotice';
import PageSpinner from 'components/ui/feedback/PageSpinner';
import { groupFeatures } from 'lib/access/feature-groups';
import { useSwitches } from '../hooks/useSwitches';
import SwitchRow from './SwitchRow';

/** Emergency switches: turn one screen or feature off for EVERY restaurant at once (for example while it is buggy). */
export default function SwitchesTab() {
  const { catalog, busy, set } = useSwitches();
  const d = catalog.data;
  if (!d) return catalog.error ? <ErrorNotice error={catalog.error} onRetry={catalog.reload} fallback="Could not load the switches" /> : <PageSpinner />;
  const byFeature = new Map(d.switches.map(s => [s.feature, s]));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-white font-bold text-sm">Screen switches</h2>
        <p className="text-zinc-500 text-xs mt-0.5 max-w-xl leading-relaxed">Switch a screen or feature off for every restaurant at once. It disappears from their app within seconds and the server refuses it. This beats every subscription and restaurant setting.</p>
      </div>
      {d.switches.length > 0 && <div role="status" className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs">{d.switches.length} feature{d.switches.length === 1 ? ' is' : 's are'} switched off for everyone.</div>}
      <ErrorNotice error={catalog.error} onRetry={catalog.reload} fallback="Could not refresh the switches" />
      {groupFeatures(d.features).map(g => (
        <section key={g.group} className="rounded-xl border border-surface-border bg-surface-card overflow-hidden">
          <h3 className="px-4 py-2.5 border-b border-surface-border text-[10px] font-bold uppercase tracking-widest text-zinc-500">{g.group}</h3>
          <ul className="divide-y divide-surface-border/60">
            {g.items.map(f => <SwitchRow key={f.key} feature={f} current={byFeature.get(f.key)} busy={busy} onSet={set} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
