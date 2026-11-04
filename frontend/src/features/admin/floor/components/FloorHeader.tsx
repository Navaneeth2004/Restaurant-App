import type { FloorMetrics } from '../hooks/floor-metrics';

const LEGEND = [{ c: '#10b981', l: '< 30m' }, { c: '#f59e0b', l: '30–60m' }, { c: '#ef4444', l: '> 1hr' }, { c: '#818cf8', l: 'Bill' }];

export default function FloorHeader({ m }: { m: FloorMetrics }) {
  const chip = (bg: string, border: string, color: string): React.CSSProperties => ({ padding: '2px 8px', borderRadius: 99, background: bg, border: `1px solid ${border}`, color, fontSize: 10, fontWeight: 700 });
  return (
    <div className="flex items-center gap-2 flex-wrap px-5 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--fl-border)', background: 'var(--fl-bg)' }}>
      <p className="fl-text font-bold text-[13px] m-0">Floor View</p>
      <span className="inline-flex items-center gap-[5px]" style={chip('rgba(16,185,129,0.1)', 'rgba(16,185,129,0.2)', 'var(--fl-green)')}><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Live</span>
      {m.overdue > 0 && <span style={chip('rgba(239,68,68,0.12)', 'rgba(239,68,68,0.3)', 'var(--fl-red)')}>{m.overdue} table{m.overdue > 1 ? 's' : ''} over 1hr</span>}
      {m.billPending > 0 && <span style={chip('rgba(129,140,248,0.12)', 'rgba(129,140,248,0.3)', 'var(--fl-indigo)')}>{m.billPending} awaiting bill</span>}
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        {LEGEND.map(x => <span key={x.l} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--fl-muted2)' }}><span className="w-[7px] h-[7px] rounded-full" style={{ background: x.c }} />{x.l}</span>)}
      </div>
    </div>
  );
}
