import Icon from 'components/ui/base/Icon';
import { todayStr } from 'lib/format/local-time';
import { PRESETS, Preset, Range } from '../../hooks/range';

interface Props {
  /** Heading of the card; GST screens keep "Filing Period". */
  title?: string;
  range: Range; error: string; preset: Preset | null; loading: boolean;
  onRange: (r: Range) => void; onPreset: (p: Preset) => void; onRefresh: () => void; refreshLabel: string;
}

export default function PeriodPicker({ title = 'Filing Period', range, error, preset, loading, onRange, onPreset, onRefresh, refreshLabel }: Props) {
  const today = todayStr();
  const bad = error ? 'border-red-500/60' : '';
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <h4 className="font-semibold text-zinc-500 text-xs uppercase tracking-widest mb-4">{title}</h4>
      <div className="flex gap-2 mb-4">
        {PRESETS.map(p => (
          <button key={p.key} type="button" aria-pressed={preset === p.key} onClick={() => onPreset(p.key)}
            className={`px-4 py-2 rounded-lg border text-xs font-semibold transition-all ${preset === p.key ? 'bg-brand-500 border-brand-600 text-white' : 'border-surface-border text-zinc-400 hover:text-white hover:border-zinc-600'}`}>{p.label}</button>
        ))}
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <div><label className="label" htmlFor="gst-from">From</label><input id="gst-from" type="date" className={`input w-44 ${bad}`} value={range.from} max={today} onChange={e => onRange({ ...range, from: e.target.value })} /></div>
        <div><label className="label" htmlFor="gst-to">To</label><input id="gst-to" type="date" className={`input w-44 ${bad}`} value={range.to} max={today} onChange={e => onRange({ ...range, to: e.target.value })} /></div>
        <button type="button" className="btn btn-sm mb-0.5" onClick={onRefresh} disabled={loading || !!error}>{loading ? 'Loading…' : refreshLabel}</button>
      </div>
      {error && <div role="alert" className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs mt-3"><Icon name="alert" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}</div>}
    </div>
  );
}
